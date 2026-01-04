import chromadb
from chromadb.utils import embedding_functions

# Connexion à la base locale
client = chromadb.PersistentClient(path="./db_youtube")
embedding_fn = embedding_functions.SentenceTransformerEmbeddingFunction(model_name="all-MiniLM-L6-v2")

col_vids = client.get_collection("transcriptions_youtube", embedding_function=embedding_fn)
col_comm = client.get_collection("commentaires_youtube", embedding_function=embedding_fn)

def hybrid_search(query, source="both", video_id=None, sentiment=None, n_results=5):
    """
    Fonction universelle pour l'Agent.
    source: 'videos', 'comments', 'both'
    """
    final_results = []

    # Recherche Vidéo
    if source in ["videos", "both"]:
        filt_v = {"video_id": video_id} if video_id else None
        res_v = col_vids.query(query_texts=[query], n_results=n_results, where=filt_v)
        for i in range(len(res_v['documents'][0])):
            final_results.append({
                "source": "video",
                "text": res_v['documents'][0][i],
                "meta": res_v['metadatas'][0][i],
                "score": res_v['distances'][0][i]
            })

    # Recherche Commentaires
    if source in ["comments", "both"]:
        filt_c = {}
        if video_id: filt_c["video_id"] = video_id
        if sentiment: filt_c["sentiment"] = sentiment
        
        # Formatage du filtre ChromaDB
        where_c = {"$and": [{k: v} for k, v in filt_c.items()]} if len(filt_c) > 1 else (filt_c if filt_c else None)
        
        res_c = col_comm.query(query_texts=[query], n_results=n_results, where=where_c)
        for i in range(len(res_c['documents'][0])):
            final_results.append({
                "source": "comment",
                "text": res_c['documents'][0][i],
                "meta": res_c['metadatas'][0][i],
                "score": res_c['distances'][0][i]
            })

    # Tri par pertinence (plus petite distance d'abord)
    final_results.sort(key=lambda x: x['score'])
    return final_results[:n_results]