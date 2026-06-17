import os
import logging
from typing import List, Dict, Any
from supabase import create_client, Client
# Try importing ClientOptions from different namespaces to ensure maximum compatibility
try:
    from supabase import ClientOptions
except ImportError:
    try:
        from supabase.client import ClientOptions
    except ImportError:
        ClientOptions = None

logger = logging.getLogger("rag_backend.vector_store")

def get_supabase_client(auth_token: str = None) -> Client:
    """
    Creates and returns a Supabase Client.
    If SUPABASE_SERVICE_ROLE_KEY is set in environment, ALWAYS use it directly (RLS Bypass)
    which is the most robust and secure path for server-to-server backend tasks.
    Otherwise, falls back to using the SUPABASE_ANON_KEY (forwarding the auth_token user JWT if available).
    """
    url = os.getenv("SUPABASE_URL")
    service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    anon_key = os.getenv("SUPABASE_ANON_KEY")

    if not url:
        raise ValueError("SUPABASE_URL is missing in environment variables.")

    # 1. Use Service Role Key directly if present (RLS Bypass)
    if service_role_key and service_role_key.strip():
        logger.debug("Initializing Supabase client with Service Role Key (RLS Bypass).")
        return create_client(url, service_role_key.strip())

    # 2. Fallback to Anon Key
    client_key = anon_key.strip() if anon_key else None
    if not client_key:
        raise ValueError("Neither SUPABASE_SERVICE_ROLE_KEY nor SUPABASE_ANON_KEY is set in environment.")

    headers = {}
    if auth_token:
        # Strip Bearer prefix if it is included
        token = auth_token.replace("Bearer ", "") if auth_token.startswith("Bearer ") else auth_token
        headers["Authorization"] = f"Bearer {token}"
        logger.debug("Initializing Supabase client with Anon Key and forwarded User JWT token.")

    if headers:
        if ClientOptions is not None:
            options = ClientOptions(headers=headers)
            return create_client(url, client_key, options=options)
        else:
            # Fallback if ClientOptions is not importable
            client = create_client(url, client_key)
            client.postgrest.auth(token)
            return client
            
    logger.debug("Initializing Supabase client with Anon Key (Normal RLS).")
    return create_client(url, client_key)

async def download_file_from_storage(storage_path: str, auth_token: str = None) -> bytes:
    """
    Downloads a file from the 'documents' private bucket in Supabase storage.
    """
    logger.info(f"Downloading file from Supabase storage: {storage_path}")
    supabase = get_supabase_client(auth_token)
    
    try:
        # storage.from_('documents').download(storage_path) is blocking, wrap if needed but fast enough
        file_bytes = supabase.storage.from_("documents").download(storage_path)
        logger.info(f"File downloaded successfully. Size: {len(file_bytes)} bytes.")
        return file_bytes
    except Exception as e:
        logger.error(f"Failed to download file {storage_path} from storage: {e}")
        raise RuntimeError(f"Failed to download file from Supabase Storage: {str(e)}") from e

async def save_document_chunks(chunks: List[str], embeddings: List[List[float]], document_id: str, chat_id: str, user_id: str, auth_token: str = None) -> int:
    """
    Inserts chunks and vector embeddings into the 'document_chunks' table.
    """
    if len(chunks) != len(embeddings):
        raise ValueError("Mismatched chunks and embeddings count.")
        
    logger.info(f"Saving {len(chunks)} chunks to database for document {document_id}...")
    supabase = get_supabase_client(auth_token)
    
    # Format data for database insert
    chunk_inserts = []
    for idx, content in enumerate(chunks):
        chunk_inserts.append({
            "document_id": document_id,
            "chat_id": chat_id,
            "user_id": user_id,
            "content": content,
            "embedding": embeddings[idx]
        })
        
    try:
        # Perform bulk insert
        res = supabase.table("document_chunks").insert(chunk_inserts).execute()
        # In supabase-py, executing returns an APIResponse object containing data and count
        inserted_count = len(res.data) if res.data else 0
        logger.info(f"Successfully inserted {inserted_count} document chunks into the database.")
        return inserted_count
    except Exception as e:
        logger.error(f"Failed to insert document chunks into Supabase: {e}")
        raise RuntimeError(f"Failed to insert chunks: {str(e)}") from e
