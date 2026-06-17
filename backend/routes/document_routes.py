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

        # 4. Save chunks and vectors to Supabase
        logger.info("Inserting document chunks and vector embeddings into database...")
        inserted_count = await save_document_chunks(
            chunks=chunks,
            embeddings=embeddings,
            document_id=request.document_id,
            chat_id=request.chat_id,
            user_id=request.user_id,
            auth_token=authorization
        )

        return DocumentProcessResponse(
            success=True,
            document_id=request.document_id,
            chunks_count=inserted_count
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
