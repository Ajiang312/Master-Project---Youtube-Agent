#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Récupère la transcription d'une vidéo YouTube et l'upload dans Supabase Storage,
en ignorant l'upload si le fichier existe déjà.

Import:
    from transcript import transcript
    url = transcript("Vj4474vTtQ8")            # ID ou URL

CLI:
    python transcript.py <youtube_url_or_id>
"""

import re
import sys
import json
import os
from typing import Optional
from youtube_transcript_api import YouTubeTranscriptApi

from dotenv import load_dotenv, find_dotenv
from supabase import create_client

# --- ENV & client Supabase
load_dotenv(find_dotenv(".env"), override=True)
SUPABASE_URL    = os.getenv("SUPABASE_URL")
SUPABASE_KEY    = os.getenv("SUPABASE_ANON_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_BUCKET = os.getenv("SUPABASE_BUCKET", "Transcription")
assert SUPABASE_URL and SUPABASE_KEY, "Manque SUPABASE_URL ou clé (ANON/SERVICE_ROLE) dans .env"
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# ---------- Helpers Storage
def object_exists(bucket: str, path: str) -> bool:
    """Retourne True si l'objet existe déjà dans Storage."""
    directory = os.path.dirname(path) or ""
    filename  = os.path.basename(path)
    try:
        items = supabase.storage.from_(bucket).list(
            directory, {"limit": 1000, "search": filename}
        )
        return any(i.get("name") == filename for i in (items or []))
    except Exception:
        # Si SELECT est restreint par RLS, on tente une URL signée 1s
        try:
            supabase.storage.from_(bucket).create_signed_url(path, 1)
            return True
        except Exception:
            return False

def get_object_url(bucket: str, path: str, ttl: int = 3600) -> str:
    """Renvoie publicUrl si bucket public, sinon une signed URL."""
    try:
        url = supabase.storage.from_(bucket).get_public_url(path).get("publicUrl")
        if url:
            return url
    except Exception:
        pass
    try:
        return supabase.storage.from_(bucket).create_signed_url(path, ttl).get("signedURL", "")
    except Exception:
        return ""

def upload_json_supabase(bucket: str,
                         path: str,
                         data: dict,
                         upsert: bool = True,
                         prefer_public_url: bool = True,
                         signed_ttl: int = 3600) -> str:
    """
    Envoie `data` (dict) en JSON vers Supabase Storage.
    Retourne une URL publique si dispo, sinon une URL signée.
    """
    payload = json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8")

    # Compat supabase-py v2 / fallback x-upsert="true" (string, pas bool)
    try:
        from supabase.storage.types import FileOptions  # supabase-py v2
        opts = FileOptions(content_type="application/json", upsert=upsert)
    except Exception:
        opts = {"content-type": "application/json"}
        if upsert:
            opts["x-upsert"] = "true"

    supabase.storage.from_(bucket).upload(path, payload, file_options=opts)

    if prefer_public_url:
        try:
            url = supabase.storage.from_(bucket).get_public_url(path).get("publicUrl")
            if url:
                return url
        except Exception:
            pass
    return supabase.storage.from_(bucket).create_signed_url(path, signed_ttl).get("signedURL", "")

# ---------- YouTube
def extract_video_id(url_or_id: str) -> str:
    """Extrait l'ID depuis une URL YouTube ou retourne l'ID directement."""
    patterns = [
        r'(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+)',
        r'^([a-zA-Z0-9_-]+)$'
    ]
    for pattern in patterns:
        m = re.search(pattern, url_or_id)
        if m:
            return m.group(1)
    raise ValueError(f"Impossible d'extraire l'ID vidéo depuis: {url_or_id}")

def get_transcript(video_id: str, languages: Optional[list] = None) -> dict:
    """Récupère la transcription publique (si dispo). Lève Exception si autre erreur."""
    if languages is None:
        languages = ['fr', 'fr-FR', 'en', 'en-US', 'es', 'de', 'it', 'pt']
    api = YouTubeTranscriptApi()
    transcript = api.fetch(video_id, languages=languages)
    segments = [{"text": s.text, "start": s.start, "duration": s.duration}
                for s in transcript.snippets]
    return {
        "video_id": video_id,
        "video_url": f"https://www.youtube.com/watch?v={video_id}",
        "language": transcript.language,
        "language_code": transcript.language_code,
        "segments": segments,
        "full_text": " ".join(s["text"] for s in segments)
    }

# -------------------------
#  FONCTION APPELABLE
# -------------------------
def transcript(url_or_id: str,
               upload_if_empty: bool = False,
               prefix: str = "transcripts",
               skip_if_exists: bool = True,
               return_url_if_exists: bool = True) -> Optional[str]:
    """
    Récupère la transcription et l'upload dans Supabase Storage.

    Retourne l'URL (publique ou signée) du JSON si upload/présent,
    ou None si skip sans URL.

    - upload_if_empty=False : n'upload PAS quand 0 segment
    - skip_if_exists=True   : ne ré-uploade pas si déjà présent dans Storage
    - return_url_if_exists=True : retourne l'URL de l'objet existant
    """
    video_id = extract_video_id(url_or_id)
    path = f"{prefix}/{video_id}.json"

    # 1) Skip si déjà présent
    if skip_if_exists and object_exists(SUPABASE_BUCKET, path):
        print(f"- {video_id}: déjà présent -> skip")
        return get_object_url(SUPABASE_BUCKET, path) if return_url_if_exists else None

    # 2) Récupération du transcript
    try:
        data = get_transcript(video_id)
    except Exception as e:
        # Pas de transcript public ou autre erreur -> selon upload_if_empty
        if not upload_if_empty:
            print(f"- {video_id}: transcript indisponible -> skip (aucun upload) [{e}]")
            return None
        data = {
            "video_id": video_id,
            "video_url": f"https://www.youtube.com/watch?v={video_id}",
            "language": None,
            "language_code": None,
            "segments": [],
            "full_text": ""
        }

    # 3) Si vide et upload_if_empty=False -> skip
    if not data.get("segments") and not upload_if_empty:
        print(f"- {video_id}: 0 segment -> skip (aucun upload)")
        return None

    # 4) Upload
    url = upload_json_supabase(
        bucket=SUPABASE_BUCKET,
        path=path,
        data=data,
        upsert=True
    )
    print(f"+ {video_id}: upload OK -> {url}")
    return url

# --- CLI de secours
def _main():
    if len(sys.argv) < 2:
        print("Usage: python transcript.py <youtube_url_or_id>")
        sys.exit(1)
    try:
        transcript(sys.argv[1])
    except Exception as e:
        print(f"Erreur: {e}")
        sys.exit(1)

if __name__ == "__main__":
    _main()
