import os
from supabase import create_client, Client

# Initialisation de la connexion

url: str = "https://rtztgwuqzaoytkyencei.supabase.co"
key: str = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0enRnd3VxemFveXRreWVuY2VpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3NzEwODQsImV4cCI6MjA3ODM0NzA4NH0.bwFTvxRYJGGJag4SI1TVk8i0bjb-xiA4rhcmM6SR3PY"
supabase: Client = create_client(url, key)

# Récupération des données de la table "transcripts"

def get_all_transcript_metadata():
    # On récupère l'id de la vidéo et le chemin de stockage
    response = supabase.table("transcripts").select("video_id, storage_path").execute()
    return response.data

metadata_list = get_all_transcript_metadata()

# Téléchargement du JSON depuis le Storage
import json

def download_transcript(storage_path):
    try:
        file_content = supabase.storage.from_("Transcription").download(storage_path)
        
        # Transformation des octets en dictionnaire Python
        return json.loads(file_content)
    except Exception as e:
        print(f"Erreur lors du téléchargement de {storage_path}: {e}")
        return None

"""
if metadata_list:
    first_path = metadata_list[0]['storage_path']
    transcript_data = download_transcript(first_path)
    
    # On retrouve bien ici la structure de ton fichier
    print(f"ID Vidéo: {transcript_data['video_id']}")
    print(f"Nombre de segments: {len(transcript_data['segments'])}")
"""

# Étape suivante : Le "Chunking" intelligent
"""
Pour chaque transcription, nous allons créer des "chunks" qui regroupent plusieurs segments. 
Si on envoyait chaque petit segment individuellement dans la base de données vectorielle, l'IA manquerait de contexte (une phrase seule est souvent trop courte).
"""
def create_smart_chunks(transcript_data, max_words=120):
    segments = transcript_data['segments']
    video_id = transcript_data['video_id']
    
    chunks = []
    current_text = ""
    current_start = segments[0]['start']
    word_count = 0
    
    for seg in segments:
        words = seg['text'].split()
        
        # Si l'ajout du segment dépasse la limite, on enregistre le chunk actuel
        if word_count + len(words) > max_words and current_text:
            chunks.append({
                "text": current_text.strip(),
                "metadata": {
                    "video_id": video_id,
                    "start_time": current_start,
                    "timestamp_url": f"https://youtu.be/{video_id}?t={int(current_start)}"
                }
            })
            # Réinitialisation pour le nouveau chunk
            current_text = ""
            current_start = seg['start']
            word_count = 0
            
        current_text += " " + seg['text']
        word_count += len(words)
        
    # Ne pas oublier le dernier morceau
    if current_text:
        chunks.append({
            "text": current_text.strip(),
            "metadata": {"video_id": video_id, "start_time": current_start}
        })
        
    return chunks

"""
mes_chunks = create_smart_chunks(transcript_data)
print(f"Nombre de chunks créés : {len(mes_chunks)}")
print(f"Exemple de métadonnées du premier chunk : {mes_chunks[0]['metadata']}")
"""
# Mise en place de la base de données vectorielle (avec ChromaDB)
import chromadb
from chromadb.utils import embedding_functions

# 1. Configuration de la persistance locale
client = chromadb.PersistentClient(path="./db_youtube")

# 2. Choix du modèle d'embedding (local)
embedding_fn = embedding_functions.SentenceTransformerEmbeddingFunction(model_name="all-MiniLM-L6-v2")

# 3. Création ou récupération de la collection
# On l'appelle 'transcriptions_youtube'
collection = client.get_or_create_collection(
    name="transcriptions_youtube", 
    embedding_function=embedding_fn
)

def ingest_chunks_to_chroma(chunks):
    if not chunks:
        return
    ids = [f"{c['metadata']['video_id']}_{i}" for i, c in enumerate(chunks)]
    documents = [c['text'] for c in chunks]
    metadatas = [c['metadata'] for c in chunks]
    
    collection.add(ids=ids, documents=documents, metadatas=metadatas)

def process_all_videos():
    print("Récupération de la liste des vidéos...")
    metadata_list = get_all_transcript_metadata()
    print(f"{len(metadata_list)} vidéos trouvées dans Supabase.")

    for item in metadata_list:
        video_id = item['video_id']
        path = item['storage_path']
        
        print(f"Traitement de la vidéo : {video_id}...")
        
        # 1. Téléchargement
        data = download_transcript(path)
        if not data: continue
        
        # 2. Chunking
        chunks = create_smart_chunks(data)
        
        # 3. Ingestion
        ingest_chunks_to_chroma(chunks)
        print(f"   -> {len(chunks)} blocs ajoutés pour {video_id}.")

    print("\nTraitement terminé ! Votre base de données vectorielle est prête.")
    print(f"Nombre total de documents en base : {collection.count()}")

def search_videos(query, video_id=None, n_results=5):
    """
    Recherche sémantique avec option de filtrage par vidéo.
    """
    # Préparation du filtre si un video_id est fourni
    search_filter = {"video_id": video_id} if video_id else None
    
    results = collection.query(
        query_texts=[query],
        n_results=n_results,
        where=search_filter  # Filtrage sur les métadonnées
    )
    
    # Formatage propre pour l'Agent / MCP
    output = []
    if results['documents']:
        for i in range(len(results['documents'][0])):
            output.append({
                "content": results['documents'][0][i],
                "video_id": results['metadatas'][0][i]['video_id'],
                "timestamp": results['metadatas'][0][i]['start_time'],
                "url": results['metadatas'][0][i].get('timestamp_url', "")
            })
    
    return output

if __name__ == "__main__":
    process_all_videos()