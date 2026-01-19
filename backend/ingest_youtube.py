# ingest_youtube.py — pipeline + transcripts intégrés + anti-ban
import os, itertools, sys, time, random
from typing import List, Dict, Any, Optional
from pathlib import Path

from dotenv import load_dotenv
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from supabase import create_client

# --- charge .env
ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / ".env", override=True)

# --- ENV requis
API_KEY         = os.getenv("YOUTUBE_API_KEY")
SUPABASE_URL    = os.getenv("SUPABASE_URL")
SUPABASE_KEY    = os.getenv("SUPABASE_ANON_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_BUCKET = os.getenv("SUPABASE_BUCKET", "Transcription")
TRANSCRIPT_PREFIX = os.getenv("TRANSCRIPT_PREFIX", "transcripts")

# --- Anti-ban (tout réglable via .env)
SLEEP_BASE      = float(os.getenv("TRANSCRIPT_SLEEP", "2.0"))   # pause fixe (s) entre vidéos transcrites
SLEEP_JITTER    = float(os.getenv("TRANSCRIPT_JITTER", "1.0"))  # jitter aléatoire 0..JITTER
ERR_STREAK_LIM  = int(os.getenv("YTA_ERR_STREAK_LIMIT", "5"))   # erreurs d'affilée avant pause longue
ERR_COOLDOWN    = float(os.getenv("YTA_ERR_COOLDOWN", "900"))   # pause longue (s) quand limite atteinte

assert API_KEY, "Missing YOUTUBE_API_KEY"
assert SUPABASE_URL and SUPABASE_KEY, "Missing Supabase URL/key"

yt = build("youtube", "v3", developerKey=API_KEY)
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# --- importe la fonction transcript(url_or_id, ...) depuis transcript.py
#     (assure-toi que transcript.py est dans le même dossier)
sys.path.insert(0, str(ROOT))
from transcript import transcript as transcript_fn  # noqa: E402

MAX_COMMENTS_PER_VIDEO = 100  # ajuste selon ton quota

# ---------- Helpers
def chunked(iterable, size):
    it = iter(iterable)
    while True:
        batch = list(itertools.islice(it, size))
        if not batch:
            return
        yield batch

def iso8601_duration_to_seconds(iso_dur: str) -> int:
    total, num = 0, ""
    for ch in iso_dur.replace("PT",""):
        if ch.isdigit(): num += ch
        else:
            if ch == "H" and num: total += int(num)*3600
            if ch == "M" and num: total += int(num)*60
            if ch == "S" and num: total += int(num)
            num = ""
    return total

def is_short(duration_seconds: int) -> bool:
    return duration_seconds < 60

# ---------- YouTube
def resolve_channel(identifier: str) -> Dict[str, Any]:
    """@handle ou UC... → infos + uploads playlist id"""
    params = {"part": "id,snippet,contentDetails,statistics"}
    if identifier.startswith("UC"):
        params["id"] = identifier
    else:
        params["forHandle"] = identifier if identifier.startswith("@") else f"@{identifier}"
    resp = yt.channels().list(**params).execute()
    items = resp.get("items", [])
    if not items:
        raise ValueError(f"Channel introuvable pour {identifier}")
    ch = items[0]
    return {
        "channel_id": ch["id"],
        "uploads_playlist_id": ch["contentDetails"]["relatedPlaylists"]["uploads"],
        "title": ch["snippet"]["title"],
        "description": ch["snippet"].get("description",""),
        "published_at": ch["snippet"]["publishedAt"],
        "handle": identifier if identifier.startswith("@") else f"@{identifier}",
        "subscriber_count": int(ch["statistics"].get("subscriberCount",0)),
        "video_count": int(ch["statistics"].get("videoCount",0)),
        "view_count": int(ch["statistics"].get("viewCount",0)),
        "thumbnails": ch["snippet"].get("thumbnails",{})
    }

def list_all_upload_video_ids(uploads_playlist_id: str) -> List[str]:
    ids, page = [], None
    while True:
        resp = yt.playlistItems().list(
            part="contentDetails", playlistId=uploads_playlist_id, maxResults=50, pageToken=page
        ).execute()
        ids += [it["contentDetails"]["videoId"] for it in resp.get("items",[])]
        page = resp.get("nextPageToken")
        if not page: break
    return ids

def fetch_video_details(video_ids: List[str]) -> List[Dict[str, Any]]:
    out = []
    for batch in chunked(video_ids, 50):
        resp = yt.videos().list(
            part="snippet,contentDetails,statistics,topicDetails",
            id=",".join(batch), maxResults=50
        ).execute()
        for v in resp.get("items", []):
            snip, stats, cdet = v["snippet"], v.get("statistics",{}), v.get("contentDetails",{})
            dur_s = iso8601_duration_to_seconds(cdet.get("duration","PT0S"))
            out.append({
                "video_id": v["id"],
                "published_at": snip["publishedAt"],
                "title": snip["title"],
                "description": snip.get("description",""),
                "duration_seconds": dur_s,
                "is_short": is_short(dur_s),
                "view_count": int(stats.get("viewCount",0)),
                "like_count": int(stats.get("likeCount",0)),
                "comment_count": int(stats.get("commentCount",0)),
                "category_id": snip.get("categoryId"),
                "tags": snip.get("tags",[]),
                "topic_categories": v.get("topicDetails",{}).get("topicCategories",[]),
                "thumbnails": snip.get("thumbnails",{})
            })
    return out

def fetch_top_comments(video_id: str, max_count: int = 100) -> List[Dict[str, Any]]:
    if max_count <= 0:
        return []
    acc, page = [], None
    while len(acc) < max_count:
        try:
            resp = yt.commentThreads().list(
                part="snippet", videoId=video_id,
                maxResults=min(100, max_count - len(acc)),
                order="relevance", textFormat="plainText", pageToken=page
            ).execute()
        except HttpError:
            break
        for it in resp.get("items", []):
            top = it["snippet"]["topLevelComment"]["snippet"]
            acc.append({
                "comment_id": it["snippet"]["topLevelComment"]["id"],
                "video_id": video_id,
                "author_display_name": top.get("authorDisplayName"),
                "like_count": int(top.get("likeCount",0)),
                "published_at": top.get("publishedAt"),
                "text": top.get("textDisplay") or top.get("textOriginal")
            })
        page = resp.get("nextPageToken")
        if not page: break
    return acc

# ---------- Supabase upserts
def upsert_channel(ch: Dict[str, Any]):
    supabase.table("channels").upsert({
        "channel_id": ch["channel_id"],
        "handle": ch["handle"],
        "title": ch["title"],
        "description": ch["description"],
        "published_at": ch["published_at"],
        "uploads_playlist_id": ch["uploads_playlist_id"],
        "subscriber_count": ch["subscriber_count"],
        "video_count": ch["video_count"],
        "view_count": ch["view_count"],
        "thumbnails": ch["thumbnails"]
    }).execute()

def upsert_videos(channel_id: str, vids: List[Dict[str, Any]]):
    payload = []
    for v in vids:
        row = dict(v)
        row["channel_id"] = channel_id
        row["tags"] = row.get("tags") or []
        row["topic_categories"] = row.get("topic_categories") or []
        payload.append(row)
    if payload:
        supabase.table("videos").upsert(payload).execute()

def upsert_comments(comments: List[Dict[str, Any]]):
    if comments:
        supabase.table("comments").upsert(comments).execute()

# ---------- Storage check (skip si JSON déjà en bucket)
def transcript_json_exists(video_id: str) -> bool:
    """
    True si <SUPABASE_BUCKET>/<TRANSCRIPT_PREFIX>/<video_id>.json existe déjà.
    Nécessite SELECT sur Storage (ou bucket public). Fallback: signed URL 1s.
    """
    directory = os.getenv("TRANSCRIPT_PREFIX", "transcripts")
    filename  = f"{video_id}.json"
    path      = f"{directory}/{filename}"

    try:
        # list() avec "search" est supporté par supabase-py v2
        items = supabase.storage.from_(SUPABASE_BUCKET).list(
            directory, {"limit": 1000, "search": filename}
        )
        return any(i.get("name") == filename for i in (items or []))
    except Exception:
        # Si SELECT est restreint par RLS, tente une URL signée ultra-courte
        try:
            supabase.storage.from_(SUPABASE_BUCKET).create_signed_url(path, 1)
            return True
        except Exception:
            return False

# ---------- Circuit breaker
def throttle_ok(err_streak: int) -> int:
    """Retourne le nouveau err_streak (0 si on vient de cooldown)."""
    if ERR_STREAK_LIM > 0 and err_streak >= ERR_STREAK_LIM:
        print(f"[transcripts] trop d'erreurs d'affilée ({err_streak}) -> cooldown {ERR_COOLDOWN:.0f}s")
        time.sleep(ERR_COOLDOWN)
        return 0
    return err_streak

# ---------- Orchestration
def ingest_creator(identifier: str, limit: Optional[int] = 100, fetch_comments: bool = True):
    """
    Ingère une chaîne YouTube :
      - upsert channel + videos (+ comments optionnels) en base
      - pour chaque vidéo : tente la transcription via transcript_fn()
        * skip si le JSON existe déjà dans le Storage (zéro hit YouTube)
        * tempo anti-ban : sleep aléatoire 30s–3min après chaque tentative

    Les paramètres anti-ban sont lus dans l'environnement :
      TRANSCRIPT_SLEEP_MIN (défaut 30)
      TRANSCRIPT_SLEEP_MAX (défaut 180)
      YTA_ERR_STREAK_LIMIT (défaut 2)
      YTA_ERR_COOLDOWN (défaut 0, donc pas de pause longue)
    """
    # --- Anti-ban (locaux, lis depuis .env avec défauts sûrs)
    SLEEP_MIN = float(os.getenv("TRANSCRIPT_SLEEP_MIN", "30"))
    SLEEP_MAX = float(os.getenv("TRANSCRIPT_SLEEP_MAX", "180"))
    ERR_STREAK_LIM = int(os.getenv("YTA_ERR_STREAK_LIMIT", "2"))
    ERR_COOLDOWN = float(os.getenv("YTA_ERR_COOLDOWN", "0"))

    ch = resolve_channel(identifier)
    print(f"[channel] {ch['title']} ({ch['channel_id']})")
    upsert_channel(ch)

    ids = list_all_upload_video_ids(ch["uploads_playlist_id"])
    if limit:
        ids = ids[:limit]
    print(f"[videos] {len(ids)} vidéos à traiter")

    details = fetch_video_details(ids)
    upsert_videos(ch["channel_id"], details)

    err_streak = 0
    ok = skipped = empty = 0

    for i, v in enumerate(details, 1):
        vid = v["video_id"]

        # 1) commentaires
        if fetch_comments:
            coms = fetch_top_comments(vid, MAX_COMMENTS_PER_VIDEO)
            upsert_comments(coms)

        # 2) transcripts — pré-skip si le JSON existe déjà dans le bucket
        if transcript_json_exists(vid):
            print(f"- {vid}: transcript déjà présent -> skip")
            skipped += 1
        else:
            try:
                url = transcript_fn(
                    vid,
                    upload_if_empty=False,        # n'upload pas de JSON vide
                    prefix=TRANSCRIPT_PREFIX,     # ex: 'transcripts'
                    skip_if_exists=True,          # double sécurité côté transcript.py
                    return_url_if_exists=True
                )
                if url:
                    ok += 1
                else:
                    # transcript indisponible (pas de CC publics)
                    empty += 1

                # tempo anti-ban (30s–3min aléatoire) UNIQUEMENT si tentative faite
                sleep_s = random.uniform(SLEEP_MIN, SLEEP_MAX)
                time.sleep(sleep_s)

                err_streak = 0  # succès → reset

            except Exception as e:
                err_streak += 1
                msg = (str(e) or "").lower()
                print(f"[transcript:{vid}] erreur: {e} (streak={err_streak})")

                # Si YouTube signale un blocage explicite
                if ("blocking requests from your ip" in msg) or ("too many requests" in msg) or ("429" in msg):
                    if ERR_COOLDOWN > 0:
                        print(f"[transcripts] blocage IP détecté -> cooldown {int(ERR_COOLDOWN)}s")
                        time.sleep(ERR_COOLDOWN)
                    err_streak = 0
                else:
                    # Circuit breaker générique
                    if ERR_STREAK_LIM > 0 and err_streak >= ERR_STREAK_LIM:
                        if ERR_COOLDOWN > 0:
                            print(f"[transcripts] trop d'erreurs ({err_streak}) -> cooldown {int(ERR_COOLDOWN)}s")
                            time.sleep(ERR_COOLDOWN)
                        err_streak = 0

        if i % 20 == 0:
            print(f"  progress {i}/{len(details)} | ok:{ok} skip:{skipped} empty:{empty} errstreak:{err_streak}")

    print(f"[done] total:{len(details)} | ok:{ok} | skip:{skipped} | empty:{empty}")
    # (optionnel) retourne un petit résumé exploitable par la suite
    return {"total": len(details), "ok": ok, "skip": skipped, "empty": empty}


if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("identifier", help="@handle (entre quotes sous PowerShell) ou channelId UC…")
    p.add_argument("--limit", type=int, default=100, help="Nombre de vidéos à ingérer (défaut: 100)")
    p.add_argument("--no-comments", action="store_true", help="Ne pas ingérer les commentaires")
    args = p.parse_args()

    ingest_creator(args.identifier, limit=args.limit, fetch_comments=not args.no_comments)
