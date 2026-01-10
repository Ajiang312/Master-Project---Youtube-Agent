import os
import json
from dotenv import load_dotenv
from supabase import create_client, Client
from langchain_openai import ChatOpenAI
from langchain_classic.agents import AgentExecutor, create_tool_calling_agent
from langchain_core.tools import tool
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage, AIMessage


load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
historique_messages = []


@tool
def recup_videos(input_text: str):
    """Récupérer les 5 dernières vidéos"""
    try:
        result = supabase.table("videos").select("*").order("published_at", desc=True).limit(5).execute()
        
        if result.data:
            return json.dumps(result.data, ensure_ascii=False)
        else:
            return "Aucune vidéo trouvée dans la base de données."
            
    except Exception as e:
        return f"Erreur: {str(e)}"

tools = [recup_videos]

prompt = ChatPromptTemplate.from_messages([
    ("system", """Tu es un assistant IA spécialisé pour les créateurs YouTube.

ÉTAPES DE TRAVAIL:

1. Pour les requêtes générales sans rapport avec les vidéos:
   - Réponds directement de manière concise et utile

2. Utilise 'recup_videos' pour avoir en contexte les 5 dernières vidéos

3. Pour les demandes de TITRES:
   - Utilise les données des 5 dernières vidéos pour les étapes suivantes
   - Analyse le style des titres existants (ton, longueur, mots-clés, structure)
   - Propose EXACTEMENT 5 titres différents adaptés au nouveau sujet avec le chiffre correspondant à chaque proposition
   - Assure-toi que les titres respectent le style du créateur

4. Pour les demandes de DESCRIPTIONS:
   - Analyse BIEN le style des descriptions des 5 dernières vidéos (structure, ton, longueur, éléments récurrents)
   - Propose UNE SEULE description complète qui correspond LE PLUS FIDELEMENT POSSIBLE au style du créateur
   - Repère les patterns entre chaque descriptions et réutilisent les en les adaptant à la nouvelle idée de vidéo
   - N'ajoute à des endroits où il n'y en a pas d'habitude
   - Adapte le contenu au nouveau sujet de vidéo

5. Pour les demandes de SCÉNARIOS:
   - Analyse la durée moyenne des 5 dernières vidéos et utilise cette moyenne comme référence de durée pour la nouvelle idée de vidéo
   - Crée un scénario structuré en plusieurs parties
   - Indique des durées approximatives pour chaque partie
   - Le total doit être cohérent avec les durées habituelles des vidéos
"""),
    MessagesPlaceholder(variable_name="chat_history"),
    ("human", "{input}"),
    MessagesPlaceholder(variable_name="agent_scratchpad")
])

# Initialisation de l'agent
llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.7, api_key=OPENAI_API_KEY)
agent = create_tool_calling_agent(llm, tools, prompt)
agent_executor = AgentExecutor(
    agent=agent,
    tools=tools,
    verbose=False,
    handle_parsing_errors=True,
    max_iterations=10
)


def chat():
    """Lancer la conversation avec l'agent"""
    print("=" * 60)
    print("AGENT IA - ASSISTANT CRÉATEUR YOUTUBE")
    print("=" * 60)
    print("\nJe peux t'aider à générer des titres, descriptions et scénarios")
    print("pour tes vidéos YouTube en analysant ton style.\n")
    print("Tape 'exit' pour quitter.\n")
    print("-" * 60)
    
    while True:
        try:
            user_input = input("\n👤 Vous: ").strip()
            print("-" * 60)
            
            if user_input.lower() == 'exit':
                print("\n👋 Au revoir !")
                break
            
            if not user_input:
                continue
            
            historique_messages.append(HumanMessage(content=user_input))
            
            # Exécuter l'agent
            response = agent_executor.invoke({
                "input": user_input,
                "chat_history": historique_messages[:-1]
            })
            
            agent_response = response['output']
            historique_messages.append(AIMessage(content=agent_response))
            
            print(f"\n🤖 Agent: {agent_response}")
            print("-" * 60)
            
        except KeyboardInterrupt:
            print("\n\n👋 À bientôt !")
            break
        except Exception as e:
            print(f"\n❌ Erreur: {str(e)}\n")

if __name__ == "__main__":
    chat()