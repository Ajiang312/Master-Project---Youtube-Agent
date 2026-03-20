"""
MCP (Model Context Protocol) Integration for Supabase
Connects to Supabase MCP server and loads tools for use with LangChain agents.
"""
import os
import asyncio
from dotenv import load_dotenv
from typing import List, Optional, Any, Dict
from langchain_core.tools import BaseTool, StructuredTool

# Enable nested event loops (needed for Streamlit and other async contexts)
try:
    import nest_asyncio
    nest_asyncio.apply()
except ImportError:
    pass  # nest_asyncio not installed, will handle errors at runtime

load_dotenv()

# Supabase MCP Server Configuration
SUPABASE_MCP_URL = "https://mcp.supabase.com/mcp?project_ref=rtztgwuqzaoytkyencei"
SUPABASE_ACCESS_TOKEN = os.environ.get("SUPABASE_ACCESS_TOKEN")  # Personal Access Token for MCP

# Global MCP client for reuse
_mcp_client = None

def _get_mcp_client():
    """Get or create the MCP client."""
    global _mcp_client
    if _mcp_client is None:
        from langchain_mcp_adapters.client import MultiServerMCPClient
        
        connection_config = {
            "transport": "http",
            "url": SUPABASE_MCP_URL
        }
        
        if SUPABASE_ACCESS_TOKEN:
            connection_config["headers"] = {
                "Authorization": f"Bearer {SUPABASE_ACCESS_TOKEN}"
            }
        
        client_config = {"supabase": connection_config}
        _mcp_client = MultiServerMCPClient(client_config)
    
    return _mcp_client


def create_supabase_client():
    """
    Compat: retourne un client MCP utilisable avec `async with client.session("supabase")`.
    `agent_generatif4.py` attend cette fonction.
    """
    return _get_mcp_client()


def load_supabase_mcp_tools() -> List[BaseTool]:
    """
    Load tools from the Supabase MCP server.
    
    Returns:
        List[BaseTool]: List of LangChain tools from the MCP server
        
    Raises:
        ImportError: If langchain_mcp_adapters is not installed
        Exception: If connection to MCP server fails
    """
    try:
        from langchain_mcp_adapters.client import MultiServerMCPClient
        from langchain_mcp_adapters.tools import load_mcp_tools
        
        # Build connection configuration
        connection_config = {
            "transport": "http",
            "url": SUPABASE_MCP_URL
        }
        
        # Add authentication headers if access token is available
        if SUPABASE_ACCESS_TOKEN:
            connection_config["headers"] = {
                "Authorization": f"Bearer {SUPABASE_ACCESS_TOKEN}"
            }
        
        # Create MCP client configuration
        client_config = {
            "supabase": connection_config
        }
        
        # Get the MCP client (will be created if needed)
        client = _get_mcp_client()
        
        # Create a session and load tools
        # Note: We need to maintain the session context for the tools to work
        async def _load_tools():
            async with client.session("supabase") as session:
                tools = await load_mcp_tools(session=session, server_name="supabase")
                return tools, session
        
        # Run the async function to load tools
        # Note: The session will be closed after this, so we need to recreate it for each call
        tools, _ = asyncio.run(_load_tools())
        
        # Convert async tools to sync-compatible tools
        # Each tool will create its own session when called
        sync_tools = []
        for tool in tools:
            # Create a wrapper that creates a session for each call
            sync_tool = _make_sync_tool_with_session(tool, client)
            sync_tools.append(sync_tool)
        
        print(f"✅ Successfully loaded {len(sync_tools)} tools from Supabase MCP server (converted to sync-compatible)")
        return sync_tools
    
    except ImportError as e:
        print("❌ langchain_mcp_adapters not installed or import failed.")
        print(f"   Error: {e}")
        print("💡 Install it with: pip install langchain-mcp-adapters")
        raise ImportError(
            "langchain_mcp_adapters is required for MCP integration. "
            "Install it with: pip install langchain-mcp-adapters"
        )
    except Exception as e:
        print(f"⚠️  Error loading MCP tools: {e}")
        print(f"   Error type: {type(e).__name__}")
        raise

def _make_sync_tool_with_session(async_tool: BaseTool, client) -> BaseTool:
    """
    Create a sync-compatible wrapper for an async MCP tool.
    Creates a new session for each tool call.
    """
    async def async_func(**kwargs: Any) -> Any:
        """Async wrapper that creates a session and calls the tool."""
        # Create a new session for this call
        async with client.session("supabase") as session:
            # Reload the tool with the new session to ensure it has the right context
            from langchain_mcp_adapters.tools import load_mcp_tools
            session_tools = await load_mcp_tools(session=session, server_name="supabase")
            # Find the matching tool
            for tool in session_tools:
                if tool.name == async_tool.name:
                    return await tool.ainvoke(kwargs)
            # Fallback: try with original tool
            return await async_tool.ainvoke(kwargs)
    
    def sync_func(**kwargs: Any) -> Any:
        """Sync wrapper that runs the async function."""
        # Use nest_asyncio to handle nested event loops (needed for Streamlit)
        try:
            import nest_asyncio
            nest_asyncio.apply()
        except ImportError:
            pass  # nest_asyncio not available, will try without it
        
        # Create a new event loop for this call
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # We're in an async context (e.g., Streamlit), use thread pool
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as executor:
                    future = executor.submit(asyncio.run, async_func(**kwargs))
                    return future.result(timeout=60)
            else:
                return loop.run_until_complete(async_func(**kwargs))
        except RuntimeError:
            # No event loop exists, create one
            return asyncio.run(async_func(**kwargs))
    
    # Create a new sync-compatible tool with both sync and async support
    return StructuredTool.from_function(
        func=sync_func,
        coroutine=async_func,
        name=async_tool.name,
        description=async_tool.description,
        args_schema=async_tool.args_schema if hasattr(async_tool, 'args_schema') else None,
    )


def get_mcp_tools_info() -> dict:
    """
    Get information about available MCP tools without loading them.
    Useful for debugging and understanding what tools are available.
    
    Returns:
        dict: Information about the MCP server and available tools
    """
    return {
        "mcp_server": "Supabase MCP Server",
        "url": SUPABASE_MCP_URL,
        "project_ref": "rtztgwuqzaoytkyencei",
        "available_tools": [
            "search_docs",           # Search Supabase documentation
            "list_tables",           # List all tables in schemas
            "list_extensions",       # List database extensions
            "list_migrations",       # List database migrations
            "apply_migration",       # Apply database migrations (DDL)
            "execute_sql",           # Execute raw SQL queries
            "get_logs",              # Get project logs
            "get_advisors"           # Get advisory notices
        ],
        "authentication_required": SUPABASE_ACCESS_TOKEN is not None
    }


def get_agent_with_mcp_tools(include_mcp: bool = True) -> tuple:
    """
    Get MCP tools ready for integration with LangChain agents.
    
    Args:
        include_mcp: Whether to include MCP tools (default: True)
        
    Returns:
        tuple: (tools_list, mcp_available) where:
            - tools_list: List of tools (MCP tools + custom tools if include_mcp=True)
            - mcp_available: Boolean indicating if MCP tools were successfully loaded
    """
    mcp_tools = []
    mcp_available = False
    
    if include_mcp:
        try:
            mcp_tools = load_supabase_mcp_tools()
            mcp_available = True
            print(f"✅ MCP tools loaded: {len(mcp_tools)} tools available")
        except Exception as e:
            print(f"⚠️  MCP tools not available: {e}")
            print("💡 Agent will continue with custom tools only")
            mcp_available = False
    
    return mcp_tools, mcp_available


if __name__ == "__main__":
    """
    Test the MCP connection and list available tools.
    """
    print("🔌 Testing Supabase MCP Server Connection...")
    print("-" * 50)
    
    # Display configuration info
    info = get_mcp_tools_info()
    print(f"Server: {info['mcp_server']}")
    print(f"URL: {info['url']}")
    print(f"Project Ref: {info['project_ref']}")
    print(f"Auth Required: {info['authentication_required']}")
    print("\n📋 Expected Tools:")
    for tool in info['available_tools']:
        print(f"  - {tool}")
    
    print("\n" + "-" * 50)
    
    # Try to load tools
    try:
        tools = load_supabase_mcp_tools()
        print(f"\n✅ Successfully connected! Loaded {len(tools)} tools:")
        for i, tool in enumerate(tools, 1):
            print(f"  {i}. {tool.name}: {tool.description[:80]}...")
    except Exception as e:
        print(f"\n❌ Connection failed: {e}")
        print("\n💡 Troubleshooting:")
        print("  1. Ensure SUPABASE_ACCESS_TOKEN is set in your .env file")
        print("  2. Install langchain_mcp_adapters: pip install langchain-mcp-adapters")
        print("  3. Check your internet connection")
        print("  4. Verify the project_ref is correct")

