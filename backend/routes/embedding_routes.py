from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import logging
from services.embeddings import EmbeddingService

logger = logging.getLogger("rag_backend.routes.embeddings")
router = APIRouter()
embedding_service = EmbeddingService()

class EmbeddingRequest(BaseModel):
    text: str

class EmbeddingResponse(BaseModel):
    embedding: list[float]

@router.post("/embeddings", response_model=EmbeddingResponse)
async def generate_embedding(request: EmbeddingRequest):
    """
    Generates a local nomic-embed-text embedding vector for a given query text.
    """
    text_content = request.text
    if not text_content or not text_content.strip():
        raise HTTPException(status_code=400, detail="Request text cannot be empty.")

    logger.info(f"Generating embedding for text query (length: {len(text_content)} chars)...")
    
    try:
        embedding = await embedding_service.get_embedding(text_content)
        return EmbeddingResponse(embedding=embedding)
    except Exception as e:
        logger.error(f"Failed to generate embedding: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate local embedding: {str(e)}"
        )
