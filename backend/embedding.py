import os
import json
import uuid
from dotenv import load_dotenv
from supabase import create_client, Client
from openai import OpenAI
from tqdm import tqdm

# --- CONFIGURATION ---
load_dotenv()
supabase: Client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
client_ai = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# --- FONCTIONS DE VÉRIFICATION ---

def is_already_indexed(source_id, source_type="comment"):
    """
    Vérifie si l'élément existe déjà dans le nouveau schéma 'vecs'.
    """
    if source_type == "comment":
        res = supabase.schema("vecs").table("comment_vectors") \
            .select("id").eq("id", source_id).execute()
    else:
        # Recherche par video_id dans les métadonnées
        res = supabase.schema("vecs").table("video_vectors") \
            .select("id").eq("metadata->>video_id", source_id).limit(1).execute()
    
    return len(res.data) > 0

# --- OUTILS DE TRAITEMENT ---

def get_embedding(text):
    """Génère un vecteur via l'API OpenAI"""
    text = text.replace("\n", " ")
    return client_ai.embeddings.create(input=[text], model="text-embedding-3-small").data[0].embedding

def create_smart_chunks(segments, target_word_count=120):
    """Découpe les transcriptions en blocs logiques d'environ 120 mots"""
    chunks = []
    current_chunk_text = ""
    current_start_time = segments[0]['start'] if segments else 0
    current_word_count = 0

    for s in segments:
        text = s['text'].strip()
        words = text.split()
        current_chunk_text += " " + text
        current_word_count += len(words)

        if current_word_count >= target_word_count:
            chunks.append({
                'text': " ".join(current_chunk_text.split()),
                'start': current_start_time
            })
            current_chunk_text = ""
            current_word_count = 0
            current_start_time = s['start']

    if current_chunk_text.strip():
        chunks.append({
            'text': " ".join(current_chunk_text.split()),
            'start': current_start_time
        })
    return chunks

# --- LOGIQUE D'INGESTION ---

def ingest_videos():
    print(" Vérification des nouvelles vidéos...")
    vids = supabase.table("transcripts").select("video_id, storage_path").execute().data
    
    for v in vids:
        if is_already_indexed(v['video_id'], "video"):
            print(f" Vidéo {v['video_id']} déjà indexée. Sautée.")
            continue

        print(f" Traitement de la vidéo : {v['video_id']}")
        
        try:
            content = supabase.storage.from_("Transcription").download(v['storage_path'])
            data = json.loads(content)
            chunks = create_smart_chunks(data.get('segments', []))
            
            video_batch = []
            for chunk in tqdm(chunks, desc="Génération des embeddings"):
                emb = get_embedding(chunk['text'])
                video_batch.append({
                    "embedding": emb,
                    "content": chunk['text'], # Colonne dédiée
                    "metadata": {
                        "video_id": v['video_id'],
                        "start_time": chunk['start'],
                        "type": "video"
                    }
            })
            
            if video_batch:
                supabase.schema("vecs").table("video_vectors").insert(video_batch).execute()
                print(f"{len(video_batch)} chunks ajoutés pour la vidéo {v['video_id']}")

        except Exception as e:
            print(f"Erreur sur la vidéo {v['video_id']}: {e}")

def ingest_comments():
    print("\n Vérification des nouveaux commentaires...")
    batch_size = 500
    offset = 0
    
    while True:
        res = supabase.table("comments").select("comment_id, text, video_id").range(offset, offset + batch_size - 1).execute()
        if not res.data: break
            
        vector_batch = []
        for c in tqdm(res.data, desc=f"Batch {offset//batch_size + 1}"):
            if is_already_indexed(c['comment_id'], "comment"):
                continue

            try:
                emb = get_embedding(c['text'])
                vector_batch.append({
                    "id": c['comment_id'], 
                    "embedding": emb,
                    "content": c['text'], # CHANGEMENT ICI : ajout de 'content'
                    "metadata": {
                        "video_id": c['video_id'], 
                        "type": "comment"
                    }
                })
            except: continue

        if vector_batch:
            supabase.schema("vecs").table("comment_vectors").upsert(vector_batch).execute()
            
        offset += batch_size

if __name__ == "__main__":
    ingest_videos()
    ingest_comments()
    print("\n Base vectorielle synchronisée !")