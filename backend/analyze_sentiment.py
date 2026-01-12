import os
from dotenv import load_dotenv
from supabase import create_client, Client
from transformers import pipeline
from tqdm import tqdm

load_dotenv()
supabase: Client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

# Utilisation du GPU si disponible (MPS pour Mac M1/M2, CUDA pour NVIDIA)
sentiment_task = pipeline(
    "sentiment-analysis", 
    model="nlptown/bert-base-multilingual-uncased-sentiment"
)

def get_expert_sentiment(text):
    if not text or len(text.strip()) < 2:
        return "neutre", 3.0, 0.0
    
    results = sentiment_task(text[:512], top_k=None)
    best_choice = max(results, key=lambda x: x['score'])
    
    label_map = {"1 star": 1, "2 stars": 2, "3 stars": 3, "4 stars": 4, "5 stars": 5}
    weighted_score = sum(label_map[r['label']] * r['score'] for r in results)
    
    if weighted_score <= 2.2: label = "négatif"
    elif weighted_score >= 3.8: label = "positif"
    else: label = "neutre"
    
    return label, weighted_score, best_choice['score']

def run_sentiment_analysis():
    print(" Analyse BERT par lots (Batching optimisé)...")
    
    # On traite par blocs de 50 pour ne pas surcharger la mémoire
    batch_size = 50 
    
    while True:
        res = supabase.table("comments") \
            .select("comment_id, text") \
            .is_("sentiment_label", "null") \
            .limit(batch_size) \
            .execute()
        
        data = res.data
        if not data:
            print("✨ Analyse terminée !")
            break
            
        updates = []
        for item in tqdm(data, desc="Analyse en cours"):
            try:
                label, score, conf = get_expert_sentiment(item['text'])
                # On prépare la ligne pour un upsert (mise à jour groupée)
                updates.append({
                    "comment_id": item['comment_id'],
                    "sentiment_label": label,
                    "sentiment_score": score,
                    "sentiment_confidence": conf
                })
            except Exception as e:
                print(f"Erreur calcul : {e}")

        # ENVOI GROUPÉ : Une seule requête réseau pour tout le lot
        if updates:
            try:
                supabase.table("comments").upsert(updates).execute()
            except Exception as e:
                print(f" Erreur lors de l'envoi groupé : {e}")
                # Si l'upsert échoue, on peut essayer de réduire batch_size

if __name__ == "__main__":
    run_sentiment_analysis()