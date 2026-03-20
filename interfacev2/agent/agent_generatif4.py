import os
import asyncio
import json
import requests
from datetime import datetime
from google import genai
from google.genai import types
from PIL import Image
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_classic.agents import AgentExecutor, create_tool_calling_agent
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage, AIMessage
from langchain_mcp_adapters.tools import load_mcp_tools
from langchain_core.tools import tool
from supabase import create_client
from langchain_community.utilities.dalle_image_generator import DallEAPIWrapper

# Ton connecteur MCP Supabase
from supabase_mcp import create_supabase_client

load_dotenv()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY1")

# --- INITIALISATION CLIENT SUPABASE (STORAGE) ---
# --- INITIALISATION CLIENT SUPABASE (STORAGE) ---
SUPABASE_URL = os.getenv("SUPABASE_URL") 
# On utilise la vraie clé d'API Supabase (qui commence par eyJ)
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")


supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)


# ==========================================
# 1. FONCTIONS INTERNES (Non visibles par l'IA)
# ==========================================

async def get_database_schema(tools):
    sql_tool = next((t for t in tools if "execute_sql" in t.name), None)
    if not sql_tool: return ""
    query = "SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = 'public';"
    result = await sql_tool.ainvoke({"query": query})
    return f"SCHEMA DB:\n{result}"

def get_thumbnail_urls(folder_name: str, limit: int = 10) -> list:
    """Récupère les URLs depuis le bucket Supabase."""
    files = supabase_client.storage.from_("thumbnails").list(path=folder_name, options={"limit": limit * 2})
    urls = []
    for file in files:
        filename = file.get('name', '')
        if filename and not filename.startswith(".") and filename.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')):
            urls.append(supabase_client.storage.from_("thumbnails").get_public_url(f"{folder_name}/{filename}"))
        if len(urls) >= limit: break
    return urls if urls else ["ERREUR_AUCUNE_IMAGE"]

def analyze_image_with_vision(image_url: str) -> str:
    """Analyse visuelle chirurgicale d'une image."""
    print(f"Analyse visuelle HD : {image_url}")
    vision_llm = ChatOpenAI(model="gpt-5-mini", api_key=OPENAI_API_KEY, max_tokens=500)
    msg = HumanMessage(content=[
        {
            "type": "text", 
            "text": "Fais une description chirurgicale et ultra-précise de cette miniature YouTube. Je veux absolument ces détails : 1. Les expressions et la forme exacte du visage du créateur. 2. Le placement précis de CHAQUE objet et texte dans l'espace (premier plan, arrière-plan, gauche, droite). 3. L'ambiance visuelle, l'atmosphère générale et la colorimétrie."
        },
        {"type": "image_url", "image_url": {"url": image_url}}
    ])
    return vision_llm.invoke([msg]).content

def save_creator_style(creator_name: str, descriptions: list[str]) -> str:
    """Sauvegarde le JSON initial des 10 descriptions."""
    safe_name = "".join([c for c in creator_name if c.isalpha() or c.isdigit()]).lower()
    filename = f"{safe_name}_descriptions.json"
    if isinstance(descriptions, str): descriptions = [descriptions]
    try:
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump({"creator": creator_name, "descriptions": descriptions}, f, indent=4, ensure_ascii=False)
        print(f"\n✅ JSON INITIAL SAUVEGARDÉ : {filename}")
        return f"Succès : 10 descriptions sauvegardées dans {filename}."
    except Exception as e:
        return f"Erreur de sauvegarde : {e}"


# ==========================================
# 2. OUTILS LANGCHAIN (Visibles et utilisables par l'IA)
# ==========================================

@tool
def read_creator_style(creator_name: str) -> str:
    """Vérifie si le profil visuel (JSON) du créateur existe localement et le retourne."""
    safe_name = "".join([c for c in creator_name if c.isalpha() or c.isdigit()]).lower()
    filename = f"{safe_name}_descriptions.json"
    if os.path.exists(filename):
        with open(filename, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return f"SUCCÈS : Profil local trouvé ! Descriptions : {json.dumps(data, ensure_ascii=False)}"
    return "ABSENT : Fichier de profil introuvable. Tu dois lancer l'analyse."

@tool
async def analyze_and_save_thumbnails(creator_name: str, folder_name: str) -> str:
    """Outil Tout-en-un: Récupère les 10 URLs, les analyse ultra-précisément et sauvegarde le JSON localement."""
    print(f"\nLancement de l'analyse globale pour le dossier '{folder_name}'...")
    urls = get_thumbnail_urls(folder_name=folder_name, limit=10)
    
    if "ERREUR" in urls[0]: 
        return "❌ Aucune image trouvée. Vérifie le nom du dossier dans Supabase."
    
    descriptions = [analyze_image_with_vision(url) for url in urls]
    return save_creator_style(creator_name, descriptions)

@tool
def add_prompt_to_json(creator_name: str, new_prompt: str) -> str:
    """
    Outil OBLIGATOIRE à utiliser AVANT de générer l'image.
    Il ajoute ou met à jour le prompt final comme 11ème description dans le fichier JSON.
    """
    safe_name = "".join([c for c in creator_name if c.isalpha() or c.isdigit()]).lower()
    filename = f"{safe_name}_descriptions.json"
    
    try:
        if not os.path.exists(filename):
            return "❌ Erreur : Le fichier JSON n'existe pas."
            
        with open(filename, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # --- LA MAGIE EST ICI ---
        # On garde uniquement les 10 premières descriptions (les vraies images analysées)
        # Ça efface automatiquement l'ancien prompt s'il y en avait déjà un
        data["descriptions"] = data["descriptions"][:10]
        
        # On ajoute le nouveau prompt à la fin (il sera donc toujours le 11ème élément exact)
        data["descriptions"].append(f"PROMPT FINAL (Génération) : {new_prompt}")
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
            
        print(f"\nPrompt mis à jour (11ème position) dans le fichier : {filename}")
        return "✅ Le prompt a bien été mis à jour dans le fichier JSON. Tu DOIS maintenant lancer la génération DALL-E."
        
    except Exception as e:
        return f"Erreur lors de la modification du JSON : {e}"

import requests

@tool
def generate_image_with_nanobanana(prompt: str) -> str:
    """Génère une image (miniature YouTube) en utilisant le modèle Nano Banana (Gemini Image)."""
    print(f"Nano Banana génération en cours avec le prompt : {prompt[:50]}...")
    
    try:
        # Le client détecte automatiquement GEMINI_API_KEY depuis l'environnement
        client = genai.Client()
        
        # Appel à l'API de Google
        response = client.models.generate_content(
            model="gemini-2.5-flash-image",
            contents=[prompt],
        )
        
        saved_paths = []
        
        # Parcours de la réponse pour extraire et sauvegarder l'image
        for i, part in enumerate(response.parts):
            if part.inline_data is not None:
                image = part.as_image()
                # Création d'un nom de fichier unique pour ne pas écraser les anciennes miniatures
                filename = f"miniature_{datetime.now().strftime('%H%M%S')}_{i}.png"
                image.save(filename)
                saved_paths.append(filename)
                
        if saved_paths:
            print(f"✅ Fichier sauvegardé : {', '.join(saved_paths)}")
            return f"✅ Image générée avec succès et sauvegardée localement sous : {', '.join(saved_paths)}"
        else:
            return "❌ Erreur : Le modèle a répondu mais n'a généré aucune image valide."
            
    except Exception as e:
        return f"❌ Erreur lors de la génération avec Nano Banana : {e}"

# ==========================================
# 3. LE PROMPT DYNAMIQUE
# ==========================================

def get_dynamic_system_prompt(schema_info: str, creator_name: str, channel_id: str) -> str:
    return f"""
Tu es l'assistant IA exclusif du créateur YouTube '{creator_name}'.

RÈGLES D'IDENTITÉ STRICTES :
- Le Channel ID de ton créateur est : '{channel_id}'.
- TOUTES tes requêtes SQL (execute_sql) doivent IMPÉRATIVEMENT inclure `WHERE channel_id = '{channel_id}'`.
- Tu es déjà connecté au bon compte. Ne demande JAMAIS pour quel créateur tu travailles.

RÈGLE D'OR SQL :
Utilise EXCLUSIVEMENT les tables et colonnes définies dans le SCHEMA ci-dessous. N'invente rien.

INFRASTRUCTURE:
{schema_info}
Tu as accès à une base de données Supabase et tu dois la scanner au préalable découvrir comment elle est structurée (le nom des tables et des colonnes) grâce aux outils disponibles (execute_sql, list_tables, etc.).


PROCÉDURE OBLIGATOIRE:
- Avant tout, demande de quel créateur on veut s'approprier le style et base toutes tes actions et réponses sur ce créateur. 
- ÉTAPE 1 : Utilise l'outil find_creator_channel_id avec le nom du créateur pour obtenir son channel_id. Si plusieurs créateurs sont trouvés, demande à l'utilisateur de préciser ou utilise directement le channel_id fourni.
- ÉTAPE 2 : Une fois que tu as le channel_id, toutes tes requêtes SQL DOIVENT filtrer par ce channel_id (WHERE channel_id = '...') pour récupérer uniquement les 10 dernières vidéos de ce créateur spécifique.
- C'est les 10 dernières vidéos de ce channel_id que tu dois analyser, PAS toutes les vidéos de la base de données.

ÉTAPES DE TRAVAIL:

1. Pour les requêtes générales sans rapport avec les vidéos:
   - Réponds directement de manière concise et pertinente

2. Pour toute demande concernant les vidéos (titres, descriptions, scénarios, miniatures), utilise OBLIGATOIREMENT les outils SQL Supabase (execute_sql) pour récupérer les données des 10 dernières vidéos du channel_id spécifique AVANT de générer ta réponse. N'OUBLIE JAMAIS de filtrer par channel_id dans tes requêtes SQL. Ne génère jamais de contenu sans avoir d'abord récupéré et analysé les données existantes du bon créateur.

3. Pour les demandes de TITRES:
   - ÉTAPE 1 OBLIGATOIRE : Utilise les outils SQL Supabase (execute_sql) pour récupérer les titres des 10 dernières vidéos du channel_id spécifique depuis la base de données. N'OUBLIE PAS de filtrer par channel_id dans ta requête SQL (WHERE channel_id = '...' ORDER BY published_at DESC LIMIT 10). Tu DOIS avoir ces titres en contexte avant de continuer.
   - ÉTAPE 2 : Analyse le style des titres existants (ton, longueur moyenne, mots-clés récurrents, structure, présence de chiffres/emojis, style de ponctuation)
   - ÉTAPE 3 : Propose EXACTEMENT 5 titres différents adaptés au nouveau sujet avec le chiffre correspondant à chaque proposition (1., 2., 3., 4., 5.)
   - RÈGLES IMPORTANTES :
     * Assure-toi que les titres respectent le style du créateur identifié dans l'analyse
     * Respecte la longueur moyenne des titres existants
     * Utilise les mêmes types de mots-clés et structures si c'est le style du créateur
     * Ne décrit pas ton analyse à l'utilisateur, génère seulement les propositions de titres dans le chat

4. Pour les demandes de DESCRIPTIONS:
   - ÉTAPE 1 OBLIGATOIRE : Utilise les outils SQL Supabase (execute_sql) pour récupérer les descriptions complètes des 10 dernières vidéos du channel_id spécifique depuis la base de données. N'OUBLIE PAS de filtrer par channel_id dans ta requête SQL (WHERE channel_id = '...' ORDER BY published_at DESC LIMIT 10). Tu DOIS avoir ces descriptions en contexte avant de continuer.
   - ÉTAPE 2 : Analyse BIEN le style des descriptions récupérées (structure, ton, longueur, éléments récurrents, la présence ou l'absence d'emojis, formatage, sections présentes)
   - ÉTAPE 3 : Repère les patterns entre chaque description (par exemple : structure avec sections séparées, longueur moyenne, style de ton)
   - ÉTAPE 4 : Propose UNE SEULE description complète qui correspond LE PLUS FIDELEMENT POSSIBLE au style du créateur en réutilisant les patterns identifiés.
   - RÈGLES IMPORTANTES :
     * N'ajoute pas d'éléments à des endroits où il n'y en a pas d'habitude dans les descriptions existantes
     * Respecte la longueur moyenne des descriptions existantes
     * Utilise le même style de ton (formel/informel, enthousiaste/sérieux, etc.)
     * Adapte uniquement le contenu au nouveau sujet de vidéo, mais garde la structure et le style identiques
     * Ne décrit pas ton chemin de pensée à l'utilisateur, génère seulement la description dans le chat

5. Pour les demandes de SCÉNARIOS:
   - ÉTAPE 1 OBLIGATOIRE : Utilise les outils SQL Supabase (execute_sql) pour récupérer les durées (duration_seconds) des 10 dernières vidéos du channel_id spécifique depuis la base de données. N'OUBLIE PAS de filtrer par channel_id dans ta requête SQL (WHERE channel_id = '...' ORDER BY published_at DESC LIMIT 10). Tu DOIS avoir ces durées en contexte avant de continuer.
   - ÉTAPE 2 : Calcule la durée moyenne des 10 dernières vidéos et utilise cette moyenne comme référence de durée pour la nouvelle idée de vidéo mais n'indique pas le calcul de la moyenne à l'utilisateur, on veut seulement le résultat de la moyenne.
   - ÉTAPE 3 : Crée un scénario structuré en plusieurs parties logiques
   - ÉTAPE 4 : Indique des durées approximatives pour chaque partie
   - RÈGLE IMPORTANTE : Le total des durées des parties doit être cohérent avec la durée moyenne calculée des vidéos existantes
   

6. Pour les demandes de MINIATURES:
    - ÉTAPE 1 : Utilise l'outil `read_creator_style` avec '{creator_name}' pour lire le JSON.
    - ÉTAPE 2 : Si le fichier est ABSENT : Utilise `analyze_and_save_thumbnails` avec creator_name='{creator_name}' et folder_name='{creator_name}_thumbnails'.
    - ÉTAPE 3 : Une fois les descriptions obtenues, analyse minutieusement, sur les 10 premières descriptions, ne prends pas en compte la 11ème pour cette étape, les répétitions concernant les expressions, la forme du visage, le placement de chaque objet, l'ambiance et l'atmosphère générale pour en extraire "l'ADN visuel" du créateur.
    - ÉTAPE 4 : Rédige un prompt DALL-E ultra-détaillé en ANGLAIS pour la nouvelle idée. ⚠️ RÈGLE ABSOLUE : Tu ne dois JAMAIS générer uniquement le sujet de la vidéo. Une miniature YouTube doit obligatoirement inclure le créateur. Ton prompt DOIT être structuré EXACTEMENT avec ces 3 sections :
      * [FOREGROUND / THE CREATOR] : Décris l'apparence physique du créateur, la forme exacte de son visage, ses vêtements et accessoires. Précise son placement précis (premier plan, gauche/droite) et son expression faciale exacte (choqué, concentré, souriant) en te basant STRICTEMENT sur ton analyse du JSON. Précise le plus possible les traits du visage et/ou récupère des informations du JSON pour avoir une description la plus précise possible du visage du créateur dans le prompt.
      * [BACKGROUND / THE SUBJECT] : Décris le placement précis du nouveau sujet de la vidéo et de CHAQUE objet dans l'espace (arrière-plan, éléments flottants).
      * [STYLE & ATMOSPHERE] : Impose l'ambiance visuelle, l'atmosphère générale, la colorimétrie et l'éclairage typiques des miniatures de ce créateur.
    - ÉTAPE 5 : Utilise OBLIGATOIREMENT l'outil `add_prompt_to_json` pour insérer ton prompt anglais dans le JSON.
    - ÉTAPE 6 : Une fois la confirmation de sauvegarde reçue, appelle `generate_image_with_dalle3(prompt)` avec ce même prompt en anglais.


IMPORTANT  N'oublies pas d'adapter ta requête SQL aux nom des colonnes et tables que tu a extraites de la base. IMPORTANT

"""

historique_messages = []

async def chat():
    print("\n" + "=" * 60)
    print("🤖 AGENT GENERATIF")
    print("=" * 60)
    
    # Simulation connexion utilisateur
    connected_creator_name = "micode"
    connected_channel_id = "UCYnvxJ-PKiGXo_tYXpWAC-w"
    
    print(f"✅ Connecté en tant que : {connected_creator_name}")
    print("-" * 60)
    
    try:
        client = create_supabase_client()
    except Exception as e:
        print(f"❌ Erreur config : {e}")
        return

    async with client.session("supabase") as session:
        print("🔌 Connexion MCP établie...")
        
        mcp_tools = await load_mcp_tools(session=session, server_name="supabase")
        
        # Liste épurée : l'IA n'a que les outils dont elle a VRAIMENT besoin
        custom_tools = [
            read_creator_style, 
            analyze_and_save_thumbnails,
            add_prompt_to_json,
            generate_image_with_nanobanana
        ]
        
        all_tools = mcp_tools + custom_tools
        
        schema_info = await get_database_schema(mcp_tools)
        safe_schema_info = schema_info.replace("{", "{{").replace("}", "}}")
        
        final_prompt_text = get_dynamic_system_prompt(safe_schema_info, connected_creator_name, connected_channel_id)
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", final_prompt_text),
            MessagesPlaceholder(variable_name="chat_history"),
            ("human", "{input}"),
            MessagesPlaceholder(variable_name="agent_scratchpad")
        ])

        # GPT-4o est recommandé ici pour gérer ce workflow complexe en 6 étapes sans trébucher
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.7, api_key=OPENAI_API_KEY)
        agent = create_tool_calling_agent(llm, all_tools, prompt)
        
        agent_executor = AgentExecutor(
            agent=agent, 
            tools=all_tools, 
            verbose=False, # Laisse sur True pour observer sa réflexion et vérifier l'étape 5
            handle_parsing_errors=True
        )
        
        print("\nTape 'exit' pour quitter.\n")

        while True:
            try:
                user_input = await asyncio.to_thread(input, "\n👤 Vous: ")
                if not user_input or user_input.lower() == 'exit': break
                
                historique_messages.append(HumanMessage(content=user_input))
                print("Merci de patienter...")
                
                response = await agent_executor.ainvoke({
                    "input": user_input,
                    "chat_history": historique_messages[:-1]
                })
                
                agent_resp = response['output']
                print(f"\nAgent: {agent_resp}")
                historique_messages.append(AIMessage(content=agent_resp))
                
            except Exception as e:
                print(f"❌ Erreur : {e}")

if __name__ == "__main__":
    asyncio.run(chat())