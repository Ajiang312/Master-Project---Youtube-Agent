import os, time, traceback
from supabase import create_client

from transcript import transcript as run_transcript # Notre fonction qui: récupère transcript, upload JSON dans Storage, skip si déjà présent


# ------- ENV -------
SUPABASE_URL = os.getenv("SUPABASE_URL")
SERVICE_KEY  = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
TRANSCRIPT_PREFIX = os.getenv("TRANSCRIPT_PREFIX", "transcripts")

# throttling très soft (même si on ne traite qu'1 job)
SLEEP_AFTER = float(os.getenv("WORKER_SLEEP_AFTER", "5"))

if not SUPABASE_URL or not SERVICE_KEY:
    raise SystemExit("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")

sb = create_client(SUPABASE_URL, SERVICE_KEY)


def claim_one_job():
    """Prend 1 job pending, le passe running (best-effort)."""
    res = sb.table("transcript_jobs") \
        .select("id,video_id,tries") \
        .eq("status", "pending") \
        .order("created_at", desc=False) \
        .limit(1) \
        .execute()

    jobs = res.data or []
    if not jobs:
        return None

    job = jobs[0]
    job_id = job["id"]

    # passe en running
    sb.table("transcript_jobs").update({
        "status": "running",
        "tries": int(job.get("tries") or 0) + 1,
        "last_error": None
    }).eq("id", job_id).execute()

    return job


def mark_job(job_id: int, status: str, last_error: str | None = None):
    payload = {"status": status}
    if last_error is not None:
        payload["last_error"] = last_error[:2000]
    sb.table("transcript_jobs").update(payload).eq("id", job_id).execute()


def upsert_transcripts_row(video_id: str, storage_path: str, status: str):
    """Table transcripts minimaliste : video_id, storage_path, status"""
    sb.table("transcripts").upsert({
        "video_id": video_id,
        "storage_path": storage_path,
        "status": status
    }, on_conflict="video_id").execute()


def main():
    job = claim_one_job()
    if not job:
        print("[worker] no pending job -> exit")
        return

    job_id = job["id"]
    video_id = job["video_id"]
    storage_path = f"{TRANSCRIPT_PREFIX}/{video_id}.json"

    print(f"[worker] processing job={job_id} video={video_id}")

    try:
        # Transcrit + upload (dans transcript.py)
        url = run_transcript(video_id)
        # Si None: pas de transcript dispo ou skip sans URL.
        if url:
            upsert_transcripts_row(video_id, storage_path, "present")
            mark_job(job_id, "done")
            print(f"[worker] done video={video_id} url={url}")
        else:
            # pas de transcript (ou skip sans url)
            upsert_transcripts_row(video_id, storage_path, "none")
            mark_job(job_id, "done")
            print(f"[worker] no transcript for video={video_id} -> marked none")
    except Exception as e:
        err = f"{e}\n{traceback.format_exc()}"
        upsert_transcripts_row(video_id, storage_path, "error")
        mark_job(job_id, "error", err)
        print(f"[worker] error video={video_id}: {e}")

    time.sleep(SLEEP_AFTER)

if __name__ == "__main__":
    main()
