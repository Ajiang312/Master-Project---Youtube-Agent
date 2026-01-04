import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client

# LangChain & LangGraph Imports
from langchain_openai import ChatOpenAI
from langchain_core.tools import tool
from langchain_core.messages import SystemMessage, HumanMessage
from langgraph.graph import StateGraph, MessagesState, END
from langgraph.prebuilt import ToolNode, tools_condition

# IMPORT DU NOUVEAU SERVICE
import rag_service

# 1. CONFIGURATION
env_path = Path(__file__).parent / '.env'
load_dotenv(dotenv_path=env_path)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

MODEL_NAME = "gpt-5-nano" 

if not all([SUPABASE_URL, SUPABASE_KEY, OPENAI_API_KEY]):
    print("❌ ERREUR : Clés manquantes dans le .env")
    sys.exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# ============================================================
# 2. DÉFINITION DES NOUVEAUX OUTILS
# ============================================================

@tool
def query_supabase_metadata(table_name: str, limit: int = 5):
    """
    Outil SQL pour métadonnées brutes (titres, dates, IDs).
    Utile pour récupérer un 'video_id' avant de faire une recherche RAG précise.
    """
    try:
        print(f"   ⚡ [SQL] Lecture table '{table_name}'")
        response = supabase.table(table_name).select("*").limit(limit).execute()
        return str(response.data)
    except Exception as e:
        return f"Erreur SQL : {e}"

@tool
def search_youtube_data(query: str, source: str = "both", sentiment: str = None):
    """
    Outil RAG puissant pour chercher dans le contenu.
    
    Args:
        query (str): La question ou les mots-clés.
        source (str): Où chercher ? 'videos' (ce qui est dit), 'comments' (réaction public), ou 'both' (les deux).
        sentiment (str, optional): Seulement pour les commentaires. Choix : 'positif', 'négatif', 'neutre'.
        
    Exemples:
    - "Ce que les gens n'aiment pas" -> source='comments', sentiment='négatif'
    - "Explication du code RAG" -> source='videos'
    """
    print(f"   🔍 [RAG] Recherche '{query}' (Source: {source}, Sentiment: {sentiment})")
    
    try:
        results = rag_service.hybrid_search(
            query=query, 
            source=source, 
            sentiment=sentiment, 
            n_results=4
        )
        
        if not results:
            return "Aucun résultat trouvé."
            
        # Formatage de la réponse pour le LLM
        formatted = f"Résultats trouvés dans {source} :\n"
        for r in results:
            type_doc = "TRANSCRIPTION" if r['source'] == 'video' else "COMMENTAIRE"
            meta = r['meta']
            
            # Gestion des métadonnées variables selon la source
            if r['source'] == 'video':
                context_info = f"Vidéo ID: {meta.get('video_id')} | Lien: {meta.get('timestamp_url')}"
            else:
                context_info = f"Sentiment: {meta.get('sentiment')} | Vidéo ID: {meta.get('video_id')}"
                
            formatted += (
                f"\n--- {type_doc} ---\n"
                f"{context_info}\n"
                f"Contenu: \"{r['text']}\"\n"
            )
        return formatted

    except Exception as e:
        return f"Erreur RAG : {str(e)}"

tools = [query_supabase_metadata, search_youtube_data]

# ============================================================
# 3. CONSTRUCTION DU GRAPHE (LANGGRAPH)
# ============================================================

llm = ChatOpenAI(model=MODEL_NAME, temperature=0)
llm_with_tools = llm.bind_tools(tools)

# Mise à jour du Prompt Système pour qu'il comprenne ses nouveaux pouvoirs
sys_msg = SystemMessage(content="""Tu es un assistant expert YouTube connecté à une base de données.

TES CAPACITÉS :
1. Tu peux lire les métadonnées (titres, vues) via SQL.
2. Tu peux chercher dans ce qui est DIT dans les vidéos (Transcriptions).
3. Tu peux analyser l'avis du public via les COMMENTAIRES et leur SENTIMENT (Positif/Négatif).

CONSEILS D'UTILISATION :
- Si on te demande "Qu'est-ce que les gens pensent ?", utilise l'outil `search_youtube_data` avec source='comments'.
- Si on cherche un passage technique, utilise source='videos'.
- Si on cherche des critiques, filtre avec sentiment='négatif'.

Réponds toujours en citant tes sources (ID vidéo ou contexte).
""")

def call_model(state: MessagesState):
    messages = state["messages"]
    response = llm_with_tools.invoke(messages)
    return {"messages": [response]}

tool_node = ToolNode(tools)

builder = StateGraph(MessagesState)
builder.add_node("agent", call_model)
builder.add_node("tools", tool_node)
builder.add_edge("__start__", "agent")
builder.add_conditional_edges("agent", tools_condition)
builder.add_edge("tools", "agent")

graph = builder.compile()

# ============================================================
# 4. EXÉCUTION
# ============================================================

def run_chat():
    print(f"🔒 Agent YouTube Avancé Démarré ({MODEL_NAME})")
    print("Capacités : SQL + Transcriptions + Commentaires + Analyse de Sentiment")
    
    chat_history = [sys_msg]

    while True:
        user_input = input("💬 Question : ")
        if user_input.lower() in ["exit", "quit"]:
            break
        
        chat_history.append(HumanMessage(content=user_input))
        try:
            events = graph.invoke({"messages": chat_history})
            last_message = events["messages"][-1]
            print(f"🤖 Réponse : {last_message.content}\n")
            chat_history = events["messages"]
        except Exception as e:
            print(f"❌ Erreur : {e}")

if __name__ == "__main__":
    run_chat()