import os
import sys
from typing import Optional
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client

# LangChain Imports
from langchain_openai import ChatOpenAI
from langchain_core.tools import tool
from langchain_core.messages import SystemMessage, HumanMessage, ToolMessage

# Configuration
env_path = Path(__file__).parent / '.env'
load_dotenv(dotenv_path=env_path)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

if not all([SUPABASE_URL, SUPABASE_KEY, OPENAI_API_KEY]):
    sys.exit("❌ Clés manquantes dans le .env")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# ============================================================
# L'OUTIL DE DÉFINITION DE STYLE
# ============================================================

@tool
def get_channel_style_guidelines(channel_name: Optional[str] = None):
    """
    Récupère le 'Guide de Style' complet de la chaîne YouTube.
    Analyse les TITRES et les DESCRIPTIONS COMPLÈTES (structure, liens, tags).
    
    Args:
        channel_name (str, optional): Le nom de la chaîne.
    """
    print(f"   🎨 [STYLE] Analyse approfondie (Titres + Descriptions complètes)...")
    
    try:
        # 1. On récupère les 5 dernières vidéos (on réduit le nombre car le texte sera plus long)
        query = supabase.table("videos") \
            .select("title, description") \
            .order("published_at", desc=True) \
            .limit(5)
            
        if channel_name:
            query = query.ilike("channel_title", f"%{channel_name}%")
            
        response = query.execute()
        videos = response.data

        if not videos:
            return "Pas de données trouvées."

        # 2. Construction du Prompt d'analyse de structure
        style_prompt = "--- ANALYSE DE STRUCTURE ET DE STYLE ---\n"
        style_prompt += f"Voici les {len(videos)} dernières vidéos complètes du créateur.\n"
        style_prompt += "Tu dois repérer les patterns récurrents dans la description complète (Intro, Liens, Appels à l'action, Signature, Hashtags).\n\n"
        
        for i, vid in enumerate(videos):
            title = vid.get('title', 'Sans titre')
            # ICI : On prend TOUTE la description, sans coupure [:150]
            full_description = vid.get('description', '')
            
            style_prompt += f"=== VIDÉO {i+1} ===\n"
            style_prompt += f"TITRE : {title}\n"
            style_prompt += f"DESCRIPTION :\n{full_description}\n"
            style_prompt += "==================\n\n"
            
        style_prompt += "\nCONSIGNES POUR L'AGENT :\n"
        style_prompt += "1. Si tu dois générer une description, reprends EXACTEMENT la même structure (Même ordre des liens, même signature).\n"
        style_prompt += "2. Garde le même ton (Tutoiement/Vouvoiement, usage des Emojis).\n"
        style_prompt += "3. Réutilise les blocs de texte fixes s'ils apparaissent partout (ex: liens d'affiliation).\n"
        
        return style_prompt

    except Exception as e:
        return f"Erreur lors de l'analyse du style : {e}"
# ============================================================
# CONFIGURATION DE L'AGENT
# ============================================================

tools = [get_channel_style_guidelines]

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.7) # Un peu de créativité pour le style
llm_with_tools = llm.bind_tools(tools)

# Le Prompt Système force l'utilisation de l'outil
sys_msg = SystemMessage(content="""
Tu es l'IA créative d'un YouTuber spécifique.
TA RÈGLE D'OR : Tu ne dois JAMAIS inventer un style. Tu dois MIMER le créateur.

PROCESSUS OBLIGATOIRE :
1. Dès qu'on te demande de créer du contenu (titre, script, idée), appelle `get_channel_style_guidelines`.
2. Analyse les exemples reçus.
3. Génère la réponse en appliquant strictement ce style.

Si l'utilisateur dit "Génère un titre sur X", ne réponds pas tout de suite. Va chercher le style d'abord.
""")

# ============================================================
# BOUCLE D'EXÉCUTION
# ============================================================

def run_style_agent():
    print("🎨 Agent de Style YouTube Initialisé.")
    print("Exemple : 'Fais-moi 3 titres pour une vidéo sur l'IA'")
    
    chat_history = [sys_msg]
    
    while True:
        user_input = input("\n👤 Toi : ")
        if user_input.lower() in ["exit", "quit"]:
            break
            
        chat_history.append(HumanMessage(content=user_input))
        
        # 1er Appel LLM (Décision)
        response = llm_with_tools.invoke(chat_history)
        chat_history.append(response)
        
        # Gestion des appels d'outils
        if response.tool_calls:
            for call in response.tool_calls:
                tool_name = call["name"]
                if tool_name == "get_channel_style_guidelines":
                    # Exécution de l'outil
                    tool_output = get_channel_style_guidelines.invoke(call["args"])
                    
                    # Renvoi du résultat à l'IA
                    chat_history.append(ToolMessage(tool_output, tool_call_id=call["id"]))
                    
                    # 2ème Appel LLM (Génération finale avec le style en mémoire)
                    final_response = llm_with_tools.invoke(chat_history)
                    print(f"🤖 Agent (Stylisé) : {final_response.content}")
                    chat_history.append(final_response)
        else:
            print(f"🤖 Agent : {response.content}")

if __name__ == "__main__":
    run_style_agent()