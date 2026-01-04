import os
import json
import chromadb
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client
from chromadb.utils import embedding_functions
from transformers import pipeline

# --- CONFIGURATION ---
env_path = Path(__file__).parent / '.env'
load_dotenv(dotenv_path=env_path)

URL = os.getenv("SUPABASE_URL")
KEY = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(URL, KEY)

client = chromadb.PersistentClient(path="./db_youtube")
embedding_fn = embedding_functions.SentenceTransformerEmbeddingFunction(model_name="all-MiniLM-L6-v2")

# --- MODÈLE HUGGING FACE (Analyse de Sentiment) ---
print("⏳ Chargement du modèle de sentiment Hugging Face...")
sentiment_task = pipeline(
    "sentiment-analysis", 
    model="lxyuan/distilbert-base-multilingual-cased-sentiments-student"
)

def get_sentiment_hf(text):
    if not text or len(text.strip()) < 5:
        return "neutre"
    try:
        result = sentiment_task(text[:512])[0]
        mapping = {"positive": "positif", "negative": "négatif", "neutral": "neutre"}
        return mapping.get(result['label'], "neutre")
    except:
        return "neutre"

# --- 1. TRAITEMENT DES VIDÉOS (Transcriptions) ---
def process_videos():
    print("\n📹 Ingestion des transcriptions vidéos...")
    col = client.get_or_create_collection("transcriptions_youtube", embedding_function=embedding_fn)
    
    # Récupération des chemins de fichiers depuis la table 'transcripts'
    vids = supabase.table("transcripts").select("video_id, storage_path").execute().data
    
    for v in vids:
        print(f"   Traitement vidéo : {v['video_id']}")
        try:
            # Téléchargement du JSON depuis le bucket Storage
            content = supabase.storage.from_("Transcription").download(v['storage_path'])
            data = json.loads(content)
            
            ids, docs, metas = [], [], []
            for i, s in enumerate(data.get('segments', [])):
                ids.append(f"{v['video_id']}_{i}")
                docs.append(s['text'])
                metas.append({
                    "video_id": v['video_id'], 
                    "start_time": s['start'], 
                    "type": "video",
                    "timestamp_url": f"https://youtube.com/watch?v={v['video_id']}&t={int(s['start'])}s"
                })
            
            if ids:
                col.add(ids=ids, documents=docs, metadatas=metas)
        except Exception as e:
            print(f" Erreur sur la vidéo {v['video_id']} : {e}")

# --- 2. TRAITEMENT DES COMMENTAIRES (20k avec Pagination) ---
def process_comments():
    print("\n Ingestion des commentaires (IA Sentiment)...")
    col = client.get_or_create_collection("commentaires_youtube", embedding_function=embedding_fn)
    batch_size, offset = 1000, 0
    
    while True:
        res = supabase.table("comments").select("comment_id, video_id, text").range(offset, offset + batch_size - 1).execute()
        data = res.data
        if not data: break
        
        ids, docs, metas = [], [], []
        for c in data:
            sentiment = get_sentiment_hf(c['text'])
            ids.append(f"comm_{c['comment_id']}")
            docs.append(c['text'])
            metas.append({
                "video_id": c['video_id'], 
                "sentiment": sentiment, 
                "type": "comment"
            })
        
        col.add(ids=ids, documents=docs, metadatas=metas)
        offset += len(data)
        print(f"{offset} commentaires traités...")
        if len(data) < batch_size: break

# --- LANCEMENT GLOBAL ---
if __name__ == "__main__":
    process_videos() 
    process_comments()
    print("\n Base de données RAG mise à jour avec succès !")