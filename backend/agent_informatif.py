import os
from dotenv import load_dotenv
from supabase import create_client, Client
from openai import OpenAI
from langchain_openai import ChatOpenAI
from langchain_classic.agents import AgentExecutor, create_openai_functions_agent
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.tools import tool
from langchain_community.chat_message_histories import ChatMessageHistory
from langchain_core.runnables.history import RunnableWithMessageHistory

load_dotenv()

# --- CONFIGURATION ---
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
client_openai = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

# Dictionnaire global pour stocker la mémoire des sessions
store = {}

def get_session_history(session_id: str):
    """Récupère ou crée l'historique pour une session donnée."""
    if session_id not in store:
        store[session_id] = ChatMessageHistory()
    return store[session_id]

def clear_session_history(session_id: str):
    """Supprime la mémoire d'une session spécifique."""
    if session_id in store:
        del store[session_id]
        return True
    return False

# --- OUTILS (TOOLS) ---
@tool
def rechercher_transcription(query: str):
    """
    UNIQUEMENT pour rechercher le CONTENU NARRATIF des vidéos (ce qui est dit, discuté, expliqué).
    Utilise la recherche vectorielle pour trouver des segments pertinents dans les transcriptions.
    
    NE PAS utiliser pour:
    - Les statistiques (vues, likes, commentaires, engagement)
    - Les métriques ou nombres
    - Les dates de publication
    - Les requêtes sur la structure de la base de données
    
    Exemples d'utilisation correcte:
    - "Qui est Eddie Tipton ?"
    - "Que dit la vidéo sur les algorithmes de loterie ?"
    - "Explique-moi le concept de..."
    """
    try:
        # Création de l'embedding pour la recherche vectorielle
        emb = client_openai.embeddings.create(input=query, model="text-embedding-3-small").data[0].embedding
        
        # Appel de la fonction RPC SQL pour trouver les segments proches
        res = supabase.rpc('match_video_vectors', {'query_embedding': emb, 'match_threshold': 0.2, 'match_count': 5}).execute()
        
        if not res.data:
            return "Aucun contenu trouvé dans les transcriptions pour cette requête."
        
        # Formatage incluant les métadonnées pour que l'IA puisse citer ses sources
        resultats = []
        for d in res.data:
            v_id = d.get('video_id', 'Inconnu')
            v_title = d.get('title', 'Sans titre')
            v_content = d.get('content', '')
            similarity = d.get('similarity', 0.0)
            
            resultats.append(
                f"[METADATA | ID: {v_id} | Titre: {v_title} | Similarité: {similarity:.2f}]\n{v_content}"
            )
        
        return "\n---\n".join(resultats)
    except Exception as e:
        return f"Erreur lors de la recherche: {str(e)}"

# NOTE: Les outils calculer_statistiques_videos et analyser_video_specifique ont été remplacés
# par les outils MCP Supabase (execute_sql) qui offrent plus de flexibilité pour les requêtes SQL.
# Ces fonctions sont conservées en commentaire pour référence historique.

# --- CONSTRUCTION DE L'AGENT ---
def get_agent_executor(include_mcp_tools: bool = True):
    """
    Configure l'agent avec gestion de mémoire intégrée et outils optimisés.
    Combine la recherche vectorielle (RAG) avec les outils MCP Supabase pour les requêtes SQL.
    
    Args:
        include_mcp_tools: Si True, inclut les outils MCP Supabase (default: True)
    
    Returns:
        RunnableWithMessageHistory: Agent exécutable avec gestion d'historique
    """
    # Outil personnalisé pour la recherche vectorielle (RAG)
    tools = [
        rechercher_transcription,      # RAG - Recherche dans transcriptions (recherche vectorielle)
    ]
    
    # Ajouter les outils MCP si demandé
    if include_mcp_tools:
        try:
            from supabase_mcp import load_supabase_mcp_tools
            mcp_tools = load_supabase_mcp_tools()
            tools.extend(mcp_tools)
            print(f"✅ {len(mcp_tools)} outils MCP chargés avec succès")
            # Debug: afficher les noms des outils disponibles
            print(f"📋 Outils disponibles: {[t.name for t in tools]}")
        except Exception as e:
            print(f"⚠️  Impossible de charger les outils MCP: {e}")
            print("💡 L'agent continuera avec l'outil de recherche vectorielle uniquement")
    
    # Configuration du LLM
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0, max_tokens=2000, timeout=30)
    
    # Construire la description des outils pour le prompt
    # Lister tous les outils disponibles avec leurs noms exacts
    tool_descriptions = []
    
    # Outil personnalisé
    tool_descriptions.append("1. rechercher_transcription : UNIQUEMENT pour le contenu narratif des vidéos (ce qui est dit)")
    
    # Outils MCP
    if include_mcp_tools and len(tools) > 1:
        mcp_tool_names = [t.name for t in tools[1:]]  # Tous sauf le premier (rechercher_transcription)
        for i, tool_name in enumerate(mcp_tool_names, start=2):
            # Trouver la description de l'outil
            tool_obj = next((t for t in tools if t.name == tool_name), None)
            if tool_obj:
                desc = tool_obj.description[:100] if hasattr(tool_obj, 'description') else tool_name
                tool_descriptions.append(f"{i}. {tool_name} : {desc}")
    
    tools_text = "\n        ".join(tool_descriptions)
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", f"""Tu es un assistant expert en analyse de vidéos YouTube et gestion de base de données Supabase.
        
        Tu as accès aux outils suivants :
        {tools_text}
        
        RÈGLES STRICTES DE SÉLECTION D'OUTILS :
        
        1. UTILISE execute_sql (MCP) pour TOUTES les questions concernant :
           - Statistiques (nombre de vidéos, total de vues, likes, commentaires)
           - Métriques (taux d'engagement, moyennes, totaux)
           - Données numériques (vues, likes, commentaires, dates de publication)
           - Structure de la base de données (tables, colonnes)
           - Requêtes SQL personnalisées
           
           Exemples : "Quel est mon engagement moyen ?", "Combien de vues au total ?", 
                      "Montre-moi les statistiques de la vidéo X", "Quelles tables existent ?"
        
        2. UTILISE rechercher_transcription UNIQUEMENT pour :
           - Questions sur le CONTENU NARRATIF des vidéos (ce qui est dit, expliqué, discuté)
           - Recherche de concepts, personnes, sujets abordés dans les transcriptions
           
           Exemples : "Qui est Eddie Tipton ?", "Que dit la vidéo sur les algorithmes ?",
                      "Explique-moi le concept de..."
        
        3. UTILISE list_tables (MCP) pour connaître la structure de la base de données
        
        IMPORTANT :
        - Si la question contient des mots comme "statistiques", "métriques", "vues", "likes", 
          "commentaires", "engagement", "nombre", "total", "moyenne" → utilise execute_sql
        - Si la question demande "qui", "quoi", "comment", "explique" sur un sujet/concept 
          → utilise rechercher_transcription
        - Ne JAMAIS utiliser rechercher_transcription pour des statistiques ou métriques
        - Le taux d'engagement se calcule : ((like_count + comment_count) / view_count) * 100
        
        EXEMPLES DE REQUÊTES SQL UTILES :
        - Statistiques globales : "SELECT COUNT(*) as total, SUM(view_count) as total_vues, SUM(like_count) as total_likes, SUM(comment_count) as total_comments FROM videos"
        - Engagement moyen : "SELECT AVG((like_count + comment_count)::float / NULLIF(view_count, 0) * 100) as engagement_moyen FROM videos WHERE view_count > 0"
        - Top 5 vidéos : "SELECT title, view_count, like_count, comment_count, ((like_count + comment_count)::float / NULLIF(view_count, 0) * 100) as engagement_rate FROM videos WHERE view_count > 0 ORDER BY engagement_rate DESC LIMIT 5"
        - Vidéo spécifique : "SELECT video_id, title, view_count, like_count, comment_count, published_at FROM videos WHERE video_id = 'VIDEO_ID'"
        
        CONSIGNE DE CITATION DES SOURCES :
        - Si l'utilisateur pose une question sur le contenu, mentionne la source si disponible dans [METADATA]
        - Si l'utilisateur demande explicitement la source, affiche : 'Cette information provient de la vidéo : [TITRE] (ID: [ID])'
        
        Sois précis, concis et toujours basé sur les données réelles."""),
        MessagesPlaceholder(variable_name="chat_history"),
        ("human", "{input}"),
        MessagesPlaceholder(variable_name="agent_scratchpad"),
    ])
    
    # Création de l'agent
    try:
        agent = create_openai_functions_agent(llm, tools, prompt)
        agent_executor = AgentExecutor(agent=agent, tools=tools, verbose=True, max_iterations=10, handle_parsing_errors=True, return_intermediate_steps=False)

        # Encapsulation avec gestion d'historique
        return RunnableWithMessageHistory(agent_executor, get_session_history, input_messages_key="input", history_messages_key="chat_history")
    except Exception as e:
        print(f"Erreur lors de la création de l'agent: {e}")
        raise


if __name__ == "__main__":
    get_agent_executor()