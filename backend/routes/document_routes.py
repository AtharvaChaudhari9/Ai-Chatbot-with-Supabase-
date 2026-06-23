import os
import tempfile
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel

from services.pdf_extractor import extract_text_from_pdf
from services.chunker import chunk_text
from services.embeddings import EmbeddingService
from services.vector_store import download_file_from_storage, save_document_chunks

logger = logging.getLogger("rag_backend.routes.documents")
router = APIRouter()
embedding_service = EmbeddingService()

class DocumentProcessRequest(BaseModel):
    document_id: str
    storage_path: str
    chat_id: str
    user_id: str
    mime_type: Optional[str] = None

class DocumentProcessResponse(BaseModel):
    success: bool
    document_id: str
    chunks_count: int

@router.post("/process-document", response_model=DocumentProcessResponse)
async def process_document(request: DocumentProcessRequest, authorization: Optional[str] = Header(None)):
    """
    Downloads a document from storage, extracts text (using PyMuPDF or Surya OCR),
    chunks the text, generates vector embeddings, and stores them in the database.
    """
    logger.info(f"Received request to process document {request.document_id} (path: {request.storage_path})")
    
    # 1. Download file bytes from Supabase Storage
    try:
        file_bytes = await download_file_from_storage(request.storage_path, auth_token=authorization)
    except Exception as e:
        logger.error(f"Error downloading document: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch document from storage: {str(e)}")

    tmp_path = None
    try:
        # Check if the document is a PDF
        is_pdf = False
        if request.mime_type:
            is_pdf = request.mime_type == "application/pdf"
        else:
            is_pdf = request.storage_path.lower().endswith(".pdf")

        extracted_text = ""

        if is_pdf:
            # Create a temporary file to allow PyMuPDF to read/render it
            with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_file:
                tmp_file.write(file_bytes)
                tmp_path = tmp_file.name
            
            logger.info(f"PDF downloaded to temporary path: {tmp_path}")
            # Extract PDF text (PyMuPDF with Surya OCR fallback)
            extracted_text = extract_text_from_pdf(tmp_path)
        else:
            # Treat as plain text / code file
            logger.info("Treating document as standard plain text file.")
            extracted_text = file_bytes.decode("utf-8", errors="replace")

        if not extracted_text.strip():
            raise ValueError("Document does not contain any extractable text.")

        # 2. Chunk the extracted text
        logger.info("Chunking extracted text...")
        chunks = chunk_text(extracted_text, size=1000, overlap=200)
        if not chunks:
            raise ValueError("Document content is empty after chunking.")
        logger.info(f"Text split into {len(chunks)} chunks.")

        # 3. Generate embeddings for all chunks locally
        logger.info("Generating embeddings locally using nomic-embed-text...")
        embeddings = await embedding_service.get_embeddings(chunks)
        logger.info(f"Generated {len(embeddings)} embedding vectors.")

        # Resolve the original filename from Supabase documents table if possible
        file_name = "document"
        try:
            from services.vector_store import get_supabase_client
            supabase = get_supabase_client(authorization)
            doc_res = supabase.table("documents").select("name").eq("id", request.document_id).single().execute()
            if doc_res.data and "name" in doc_res.data:
                file_name = doc_res.data["name"]
                logger.info(f"Retrieved document name '{file_name}' from database.")
        except Exception as db_err:
            logger.warning(f"Could not retrieve document name from database: {db_err}. Falling back to storage path.")
            if request.storage_path:
                file_name = os.path.basename(request.storage_path)

        import datetime
        uploaded_at = datetime.datetime.utcnow().isoformat() + "Z"

        # 4. Save chunks and vectors to Qdrant
        logger.info("Inserting document chunks and vector embeddings into Qdrant...")
        from services.qdrant_service import QdrantService
        qdrant_service = QdrantService()
        qdrant_count = qdrant_service.insert_chunks(
            user_id=request.user_id,
            document_id=request.document_id,
            file_name=file_name,
            chunks=chunks,
            embeddings=embeddings,
            uploaded_at=uploaded_at
        )
        logger.info(f"Successfully inserted {qdrant_count} points into Qdrant.")

        return DocumentProcessResponse(
            success=True,
            document_id=request.document_id,
            chunks_count=qdrant_count
        )


    except Exception as e:
        logger.error(f"Error processing document {request.document_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process and vectorize document: {str(e)}"
        )
    finally:
        # Safe cleanup of temporary PDF files
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
                logger.debug(f"Cleaned up temporary file: {tmp_path}")
            except Exception as e:
                logger.warning(f"Failed to delete temporary file {tmp_path}: {e}")

class RetrieveChunksRequest(BaseModel):
    query: str
    user_id: str
    chat_id: Optional[str] = None
    document_id: Optional[str] = None
    k: int = 5

class RetrieveChunksResponse(BaseModel):
    chunks: list[dict]

class DocumentDeleteRequest(BaseModel):
    document_id: str

class DocumentDeleteResponse(BaseModel):
    success: bool

@router.post("/retrieve-chunks", response_model=RetrieveChunksResponse)
async def retrieve_chunks(request: RetrieveChunksRequest, authorization: Optional[str] = Header(None)):
    """
    Retrieves top-k document chunks relevant to the query from Qdrant,
    filtering by user_id and optionally document_id or chat_id's associated document_ids.
    """
    logger.info(f"Retrieving chunks for query: '{request.query}' (user_id: {request.user_id}, chat_id: {request.chat_id}, document_id: {request.document_id})")
    
    try:
        # 1. Generate query embedding
        query_vector = await embedding_service.get_embedding(request.query)
        
        # 2. Resolve document IDs
        document_ids = None
        if request.document_id:
            document_ids = [request.document_id]
        elif request.chat_id:
            try:
                from services.vector_store import get_supabase_client
                supabase = get_supabase_client(authorization)
                doc_res = supabase.table("documents").select("id").eq("chat_id", request.chat_id).eq("user_id", request.user_id).execute()
                if doc_res.data:
                    document_ids = [d["id"] for d in doc_res.data]
                    logger.info(f"Resolved document IDs for chat {request.chat_id}: {document_ids}")
                else:
                    document_ids = []
                    logger.info(f"No documents registered for chat {request.chat_id}.")
            except Exception as db_err:
                logger.error(f"Error fetching document metadata from Supabase: {db_err}")
                raise HTTPException(status_code=500, detail=f"Failed to query document metadata: {str(db_err)}")
        
        # If chat has no documents, return empty chunks
        if document_ids is not None and len(document_ids) == 0:
            return RetrieveChunksResponse(chunks=[])
            
        # 3. Query Qdrant
        from services.qdrant_service import QdrantService
        qdrant_service = QdrantService()
        matched_chunks = qdrant_service.search_chunks(
            user_id=request.user_id,
            query_vector=query_vector,
            document_ids=document_ids,
            k=request.k
        )
        
        return RetrieveChunksResponse(chunks=matched_chunks)
        
    except Exception as e:
        logger.error(f"Error retrieving chunks: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/delete-document", response_model=DocumentDeleteResponse)
async def delete_document(request: DocumentDeleteRequest):
    """
    Deletes all vector points associated with the given document_id in Qdrant.
    """
    logger.info(f"Received request to delete Qdrant vectors for document: {request.document_id}")
    try:
        from services.qdrant_service import QdrantService
        qdrant_service = QdrantService()
        success = qdrant_service.delete_document_chunks(request.document_id)
        return DocumentDeleteResponse(success=success)
    except Exception as e:
        logger.error(f"Failed to delete document vectors in Qdrant: {e}")
        raise HTTPException(status_code=500, detail=str(e))

