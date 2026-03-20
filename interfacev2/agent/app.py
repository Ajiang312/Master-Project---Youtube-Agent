from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import sys
import re
import jwt  # pip install pyjwt
import asyncio

# ==============================
# GESTION DES CHEMINS
# ==============================
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PARENT_DIR = os.path.dirname(CURRENT_DIR)

# Cas possibles selon ton projet :
# - app.py dans /agent
# - agent_informatif.py dans /agent
# - agent_generatif4.py à la racine
POSSIBLE_PATHS = [
    CURRENT_DIR,
    PARENT_DIR,
    os.path.join(CURRENT_DIR, "agent"),
    os.path.join(PARENT_DIR, "agent"),
]

for path in POSSIBLE_PATHS:
    if path and path not in sys.path and os.path.isdir(path):
        sys.path.append(path)

# ==============================
# IMPORTS AGENTS
# ==============================
from agent_informatif import (
    get_agent_executor as get_informative_agent_executor,
    clear_session_history,
)

import agent_generatif4 as generative_module

app = Flask(__name__)

# ==============================
# CONFIGURATION CORS
# ==============================
CORS(app, resources={
    r"/api/*": {
        "origins": [
            "http://localhost:8000",
            "http://127.0.0.1:8000",
            "http://localhost:5001",
            "http://127.0.0.1:5001",
            "http://localhost:5500",
            "http://127.0.0.1:5500",
            "null"
        ],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    },
    r"/chat": {
        "origins": [
            "http://localhost:8000",
            "http://127.0.0.1:8000",
            "http://localhost:5001",
            "http://127.0.0.1:5001",
            "http://localhost:5500",
            "http://127.0.0.1:5500",
            "null"
        ],
        "methods": ["POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

# ==============================
# STORES / CACHES
# ==============================
informative_agents_cache = {}
generative_history_store = {}


# ==============================
# OUTILS JWT
# ==============================
def _clean_token_string(token: str) -> str:
    if token is None:
        return ""
    return "".join(str(token).split()).strip()


def is_fake_token(token: str) -> bool:
    token = _clean_token_string(token).lower()
    return token in {
        "",
        "null",
        "undefined",
        "none",
        "false",
        "bearernull",
        "bearerundefined",
        "bearernone",
        "bearerfalse",
    }


def extract_and_clean_jwt(auth_header: str) -> str:
    """
    Extrait et nettoie le JWT depuis Authorization: Bearer <token>.
    Retourne un JWT valide avec exactement 3 segments.
    """
    if not auth_header or not auth_header.startswith("Bearer "):
        raise ValueError("Missing Bearer token")

    raw_token = auth_header.removeprefix("Bearer ")
    raw_token = _clean_token_string(raw_token)

    if is_fake_token(raw_token):
        raise ValueError("Missing Bearer token")

    jwt_match = re.match(r"^([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)", raw_token)
    if jwt_match:
        user_jwt = jwt_match.group(1)
    else:
        jwt_parts = raw_token.split(".")
        if len(jwt_parts) >= 3:
            user_jwt = ".".join(jwt_parts[:3])
            if len(jwt_parts) > 3:
                print(f"⚠️ JWT nettoyé dans app.py: {len(jwt_parts)} parties détectées, utilisation des 3 premières")
        else:
            raise ValueError(f"Format JWT invalide (attendu 3 parties, reçu {len(jwt_parts)})")

    if len(user_jwt.split(".")) != 3:
        raise ValueError(f"Format JWT invalide après nettoyage (attendu 3 parties, reçu {len(user_jwt.split('.'))})")

    return user_jwt


def extract_optional_jwt_from_request() -> str:
    """
    Essaie de récupérer un JWT depuis :
    - header Authorization
    - body token / jwt / access_token / user_jwt

    Si la valeur ressemble à null/undefined/vide => retourne "" sans erreur.
    """
    data = request.get_json(silent=True) or {}

    # 1. Header Authorization
    auth_header = request.headers.get("Authorization")
    if auth_header:
        if auth_header.startswith("Bearer "):
            candidate = _clean_token_string(auth_header.removeprefix("Bearer "))
            if not is_fake_token(candidate):
                return extract_and_clean_jwt(auth_header)
        elif not is_fake_token(auth_header):
            # Cas rare où le front met directement le token dans Authorization
            candidate = _clean_token_string(auth_header)
            if candidate.count(".") == 2:
                return extract_and_clean_jwt(f"Bearer {candidate}")

    # 2. Body JSON
    possible_keys = ["token", "jwt", "access_token", "user_jwt"]
    for key in possible_keys:
        value = data.get(key)
        if value is None:
            continue

        value = _clean_token_string(value)
        if is_fake_token(value):
            continue

        if value.startswith("Bearer "):
            return extract_and_clean_jwt(value)

        return extract_and_clean_jwt(f"Bearer {value}")

    return ""


def get_user_id_from_jwt(user_jwt: str) -> str:
    """
    Décode le JWT sans vérifier la signature pour récupérer un identifiant utilisateur.
    """
    try:
        payload = jwt.decode(user_jwt, options={"verify_signature": False})
        user_id = payload.get("sub") or payload.get("user_id") or payload.get("id") or "anonymous"
        print("JWT payload:", payload)
        return user_id
    except Exception as e:
        print(f"⚠️ Impossible de décoder le JWT: {e}")
        return "anonymous"


# ==============================
# AGENT INFORMATIF
# ==============================
def get_informative_executor(user_jwt: str):
    """
    Cache par JWT pour éviter de recréer l'agent à chaque requête.
    """
    if not user_jwt:
        raise ValueError("Aucun JWT utilisateur valide fourni pour l'agent informatif.")

    if user_jwt not in informative_agents_cache:
        informative_agents_cache[user_jwt] = get_informative_agent_executor(user_jwt=user_jwt)
        print("✅ Agent informatif initialisé")
    return informative_agents_cache[user_jwt]


# ==============================
# AGENT GÉNÉRATIF
# ==============================
def get_generative_history(session_id: str):
    if session_id not in generative_history_store:
        generative_history_store[session_id] = []
    return generative_history_store[session_id]


async def run_generative_agent(message: str, session_id: str, creator_name: str, channel_id: str) -> str:
    """
    Exécute l'agent génératif une fois, dans une session MCP ouverte.
    """
    try:
        client = generative_module.create_supabase_client()
    except Exception as e:
        raise RuntimeError(f"Erreur configuration MCP/Supabase: {e}")

    async with client.session("supabase") as session:
        print("🔌 Connexion MCP établie pour l'agent génératif...")

        mcp_tools = await generative_module.load_mcp_tools(session=session, server_name="supabase")

        custom_tools = [
            generative_module.read_creator_style,
            generative_module.analyze_and_save_thumbnails,
            generative_module.add_prompt_to_json,
            generative_module.generate_image_with_nanobanana,
        ]

        all_tools = mcp_tools + custom_tools

        schema_info = await generative_module.get_database_schema(mcp_tools)
        safe_schema_info = schema_info.replace("{", "{{").replace("}", "}}")

        final_prompt_text = generative_module.get_dynamic_system_prompt(
            safe_schema_info,
            creator_name,
            channel_id
        )

        prompt = generative_module.ChatPromptTemplate.from_messages([
            ("system", final_prompt_text),
            generative_module.MessagesPlaceholder(variable_name="chat_history"),
            ("human", "{input}"),
            generative_module.MessagesPlaceholder(variable_name="agent_scratchpad")
        ])

        llm = generative_module.ChatOpenAI(
            model="gpt-4o-mini",
            temperature=0.7,
            api_key=generative_module.OPENAI_API_KEY
        )

        agent = generative_module.create_tool_calling_agent(llm, all_tools, prompt)

        agent_executor = generative_module.AgentExecutor(
            agent=agent,
            tools=all_tools,
            verbose=False,
            handle_parsing_errors=True
        )

        history = get_generative_history(session_id)

        response = await agent_executor.ainvoke({
            "input": message,
            "chat_history": history
        })

        output = response.get("output", "")

        history.append(generative_module.HumanMessage(content=message))
        history.append(generative_module.AIMessage(content=output))

        return output


# ==============================
# ROUTES
# ==============================
@app.route('/chat', methods=['POST'])
def chat_compat():
    """
    Endpoint compatible avec l'ancien chat_api.py :
    - URL: POST /chat
    - Headers: Authorization: Bearer <jwt> (requis)
    - Body JSON: { "message": "..." }
    - Response: { "reply": "..." }
    """
    try:
        data = request.get_json(silent=True) or {}
        message = data.get("message")

        if not message:
            return jsonify({"detail": "Message requis"}), 400

        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return jsonify({"detail": "Missing Bearer token"}), 401

        try:
            user_jwt = extract_and_clean_jwt(auth_header)
        except ValueError as e:
            return jsonify({"detail": str(e)}), 401

        user_id = get_user_id_from_jwt(user_jwt) if user_jwt else "anonymous"

        agent_executor = get_informative_executor(user_jwt=user_jwt)
        response = agent_executor.invoke(
            {"input": message},
            config={"configurable": {"session_id": user_id}},
        )

        output = response.get("output", "")
        return jsonify({"reply": output})

    except Exception as e:
        print(f"❌ Erreur dans /chat: {e}")
        return jsonify({"detail": str(e)}), 500


@app.route('/api/chat', methods=['POST'])
def chat():
    """
    Endpoint pour discuter avec l'agent informatif.
    Headers:
        Authorization: Bearer <jwt> (optionnel côté front, mais requis pour l'agent informatif)
    Body JSON:
    {
        "message": "Votre question",
        "session_id": "optionnel"
    }
    """
    try:
        data = request.get_json(silent=True) or {}
        message = data.get("message")

        if not message:
            return jsonify({"error": "Message requis"}), 400

        # JWT récupéré proprement
        try:
            user_jwt = extract_optional_jwt_from_request()
        except ValueError as e:
            return jsonify({"error": str(e)}), 401

        if user_jwt:
            print(
                "JWT reçu:",
                repr(user_jwt[:50] + "..." if len(user_jwt) > 50 else user_jwt),
                "segments:",
                len(user_jwt.split("."))
            )
        else:
            print("ℹ️ Aucun JWT valide fourni pour /api/chat")

        # L'agent informatif a besoin du JWT utilisateur pour RLS
        if not user_jwt:
            return jsonify({
                "error": "Aucun JWT utilisateur valide fourni. /api/chat nécessite un vrai token de session Supabase."
            }), 401

        user_id = get_user_id_from_jwt(user_jwt)
        session_id = data.get("session_id") or user_id

        agent_executor = get_informative_executor(user_jwt=user_jwt)

        response = agent_executor.invoke(
            {"input": message},
            config={"configurable": {"session_id": session_id}}
        )

        return jsonify({
            "success": True,
            "response": response.get("output", "Aucune réponse"),
            "session_id": session_id,
            "user_id": user_id
        })

    except Exception as e:
        print(f"❌ Erreur dans /api/chat: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/generate', methods=['POST'])
def generate():
    """
    Endpoint pour l'agent génératif.
    Il NE réutilise PAS /api/chat.
    Il n'a donc pas le problème de JWT de l'agent informatif.
    """
    try:
        data = request.get_json(silent=True) or {}
        message = data.get("message")

        if not message:
            return jsonify({"error": "Message requis"}), 400

        session_id = data.get("session_id") or "generative_default"

        # Optionnel : le front peut envoyer ces infos
        creator_name = data.get("creator_name") or data.get("creator") or "micode"
        channel_id = data.get("channel_id") or "UCYnvxJ-PKiGXo_tYXpWAC-w"

        print(f"🎨 /api/generate | creator_name={creator_name} | channel_id={channel_id} | session_id={session_id}")

        output = asyncio.run(
            run_generative_agent(
                message=message,
                session_id=session_id,
                creator_name=creator_name,
                channel_id=channel_id
            )
        )

        return jsonify({
            "success": True,
            "response": output,
            "session_id": session_id,
            "creator_name": creator_name,
            "channel_id": channel_id
        })

    except Exception as e:
        print(f"❌ Erreur dans /api/generate: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/clear-history', methods=['POST'])
def clear_history():
    """
    Endpoint pour effacer l'historique d'une session
    Body JSON:
    {
        "session_id": "user_123"
    }
    """
    try:
        data = request.get_json(silent=True) or {}
        session_id = data.get("session_id", "default_session")

        informative_cleared = clear_session_history(session_id)
        generative_cleared = False

        if session_id in generative_history_store:
            del generative_history_store[session_id]
            generative_cleared = True

        success = informative_cleared or generative_cleared

        return jsonify({
            "success": success,
            "message": "Historique effacé" if success else "Session introuvable"
        })

    except Exception as e:
        print(f"❌ Erreur dans /api/clear-history: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({
        "status": "ok",
        "server": "flask",
        "port": 5001,
        "informative_agents_cached": len(informative_agents_cache),
        "generative_sessions_cached": len(generative_history_store)
    })


if __name__ == '__main__':
    print("🚀 Serveur Flask démarré sur http://localhost:5001")
    app.run(host='0.0.0.0', port=5001, debug=True)