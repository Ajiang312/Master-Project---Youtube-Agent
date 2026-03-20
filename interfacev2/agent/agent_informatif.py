import os
from typing import List, Optional
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
# Use the publishable (anon) key; name reflects that this is safe to expose to clients
SUPABASE_KEY = os.environ.get("SUPABASE_PUBLISHABLE_KEY")

store = {}

def get_session_history(session_id: str):
    if session_id not in store:
        store[session_id] = ChatMessageHistory()
    return store[session_id]

def clear_session_history(session_id: str):
    if session_id in store:
        del store[session_id]
        return True
    return False

# --- OUTILS (TOOLS) ---

def create_rechercher_transcription_tool(user_jwt: str):
    """
    Crée l'outil de recherche avec le JWT utilisateur pré-configuré.
    Le JWT est capturé dans la closure, donc l'agent n'a pas besoin de le fournir.
    """
    import requests
    
    # Nettoyer et valider le format JWT (doit avoir exactement 3 parties séparées par des points)
    # Supprimer tous les espaces, retours à la ligne, etc.
    user_jwt_clean = "".join(user_jwt.split()).strip()
    
    # Si le JWT contient des caractères non-JWT à la fin, les supprimer
    # Un JWT valide se termine par des caractères base64url (A-Z, a-z, 0-9, -, _)
    import re
    # Extraire seulement la partie qui ressemble à un JWT (3 parties séparées par des points)
    jwt_match = re.match(r'^([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)', user_jwt_clean)
    if jwt_match:
        user_jwt_clean = jwt_match.group(1)
    else:
        # Fallback: split par points et prendre les 3 premières parties
        jwt_parts = user_jwt_clean.split(".")
        if len(jwt_parts) >= 3:
            user_jwt_clean = ".".join(jwt_parts[:3])
            if len(jwt_parts) > 3:
                print(f"⚠️ JWT nettoyé: {len(jwt_parts)} parties détectées, utilisation des 3 premières")
        else:
            raise ValueError(f"Format JWT invalide (attendu 3 parties, reçu {len(jwt_parts)})")
    
    # Validation finale: doit avoir exactement 3 parties
    jwt_parts = user_jwt_clean.split(".")
    if len(jwt_parts) != 3:
        raise ValueError(f"Format JWT invalide après nettoyage (attendu 3 parties, reçu {len(jwt_parts)})")
    
    @tool
    def rechercher_transcription(query: str):
        """
        UNIQUEMENT pour rechercher le CONTENU NARRATIF des vidéos (ce qui est dit, discuté, expliqué).
        Utilise la fonction RPC `match_video_vectors` avec les politiques RLS activées.

        - N'utilise PAS cet outil pour des statistiques, des totaux, des moyennes, etc.
        """
        # Sanity check: config côté serveur
        if not SUPABASE_URL or not SUPABASE_KEY:
            return (
                "Erreur RAG: configuration Supabase incomplète côté backend.\n"
                "- Vérifie que SUPABASE_URL et SUPABASE_PUBLISHABLE_KEY sont définis dans le .env\n"
                "- Redémarre le serveur FastAPI après modification du .env."
            )

        try:
            # 1. Embedding de la requête
            client_openai = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
            emb = client_openai.embeddings.create(
                input=query,
                model="text-embedding-3-small"
            ).data[0].embedding

            # 2. Appel de la fonction RPC via REST avec JWT utilisateur (RLS)
            base_url = SUPABASE_URL.rstrip("/")
            url = f"{base_url}/rest/v1/rpc/match_video_vectors"

            headers = {
                # anon/publishable key: identifie le projet et le rôle de base
                "apikey": SUPABASE_KEY,
                # JWT utilisateur: RLS utilisera auth.uid() à partir de ce token
                "Authorization": f"Bearer {user_jwt_clean}",
                "Content-Type": "application/json",
            }

            payload = {
                "query_embedding": emb,
                "match_threshold": 0.3,   # tu peux ajuster
                "match_count": 5,
            }

            resp = requests.post(url, json=payload, headers=headers, timeout=20)
            resp.raise_for_status()
            data = resp.json()

            if not data:
                return "Aucun contenu narratif trouvé pour cette requête."

            # 3. Formatage des résultats avec titre + similarité + timestamp
            def format_timestamp(seconds):
                """Convertit des secondes en format MM:SS ou HH:MM:SS"""
                if seconds is None:
                    return None
                try:
                    seconds = float(seconds)
                    hours = int(seconds // 3600)
                    minutes = int((seconds % 3600) // 60)
                    secs = int(seconds % 60)
                    if hours > 0:
                        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
                    else:
                        return f"{minutes:02d}:{secs:02d}"
                except (ValueError, TypeError):
                    return None

            blocs = []
            for d in data:
                v_id = d.get("video_id", "Inconnu")
                v_title = d.get("title", "Sans titre")
                v_content = d.get("content", "")
                similarity = d.get("similarity", 0.0)
                start_time = d.get("start_time")  # Peut être None si pas encore dans la RPC

                # Construire le métadata avec timestamp si disponible
                metadata_parts = [f"ID: {v_id}", f"Titre: {v_title}", f"Similarité: {similarity:.2f}"]
                if start_time is not None:
                    timestamp_str = format_timestamp(start_time)
                    if timestamp_str:
                        metadata_parts.append(f"Timestamp: {timestamp_str}")

                blocs.append(
                    f"[METADATA | {' | '.join(metadata_parts)}]\n{v_content}"
                )

            return "\n---\n".join(blocs)

        except requests.HTTPError as e:
            try:
                detail = e.response.text
            except Exception:
                detail = "Aucun détail supplémentaire."
            return f"Erreur RAG (HTTP {e.response.status_code}): {detail}"
        except Exception as e:
            return f"Erreur RAG: {str(e)}"
    
    return rechercher_transcription

def get_agent_executor(user_jwt: str):
    # Créer l'outil avec le JWT pré-configuré
    rechercher_transcription = create_rechercher_transcription_tool(user_jwt)
    tools = [rechercher_transcription]
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", f"""Tu es l'IA Creator Assistant spécialisé en recherche d'informations sur les vidéos YouTube.

        - Pour les requêtes de recherche d'informations sur les vidéos, Tu DOIS utiliser 'rechercher_transcription'.

        Tu ne dois en aucun cas citer des informations qui ne sont pas dans la base de données. 

        Tu ne dois pas utiliser "rechercher_transcription" pour des requêtes de statistiques comme "combien de vidéos".

        IMPORTANT - TIMESTAMPS : Quand tu trouves des informations dans les transcriptions, tu dois TOUJOURS indiquer le timestamp (moment dans la vidéo) où cette information apparaît. Les résultats incluent un timestamp au format MM:SS ou HH:MM:SS. Utilise-le pour dire à l'utilisateur exactement où dans la vidéo il peut trouver l'information.

        SÉCURITÉ : RLS actif. JWT: {user_jwt[:10]}..."""),
        MessagesPlaceholder(variable_name="chat_history"),
        ("human", "{input}"),
        MessagesPlaceholder(variable_name="agent_scratchpad"),
    ])
    
    # Debug: afficher tous les outils disponibles pour l'agent
    print(f"🔧 Total outils disponibles pour l'agent: {len(tools)}")
    print(f"📋 Liste complète: {[t.name for t in tools]}")
    
    agent = create_openai_functions_agent(llm, tools, prompt)
    agent_executor = AgentExecutor(agent=agent, tools=tools, verbose=True, handle_parsing_errors=True)

    return RunnableWithMessageHistory(
        agent_executor, 
        get_session_history, 
        input_messages_key="input", 
        history_messages_key="chat_history"
    )