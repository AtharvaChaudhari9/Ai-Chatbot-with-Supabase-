import os
import logging
from dotenv import load_dotenv

# Load environment variables from .env file before importing services/routes
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import document_routes, embedding_routes, benchmark_routes

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("rag_backend")

app = FastAPI(
    title="Next.js Chatbot Python RAG Backend",
    description="FastAPI service for PDF text extraction (PyMuPDF & Surya OCR), text chunking, and local embedding generation.",
    version="1.0.0"
)

# Configure CORS Middleware (allowing calls from local frontend and VPS deployment)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict to specific origins in cloud production (e.g., frontend domain)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes with "/api" prefix
app.include_router(document_routes.router, prefix="/api")
app.include_router(embedding_routes.router, prefix="/api")
app.include_router(benchmark_routes.router, prefix="/api")

@app.on_event("startup")
async def startup_event():
    logger.info("FastAPI starting up. Running validation checks...")
    try:
        from services.embeddings import EmbeddingService
        from services.qdrant_service import QdrantService
        
        # 1. Dynamic embedding dimension detection
        embedding_service = EmbeddingService()
        try:
            logger.info("Detecting active embedding model dimension from Ollama...")
            test_vector = await embedding_service.get_embedding("test")
            vector_size = len(test_vector)
            logger.info(f"Ollama connection successful. Active model: '{embedding_service.model}' with dimension: {vector_size}")
        except Exception as embed_err:
            logger.warning(f"Could not connect to Ollama or generate embedding dynamically: {embed_err}. Defaulting vector size to 768.")
            vector_size = 768
            
        # 2. Qdrant Connection and Collection Verification
        qdrant_service = QdrantService()
        qdrant_service.recreate_or_ensure_collection(vector_size)
        logger.info("Qdrant startup validation succeeded. Connection verified and collection is ready.")
    except Exception as qd_err:
        logger.error(f"Qdrant startup validation failed: {qd_err}. Please ensure Qdrant is running at the configured endpoint.", exc_info=True)

@app.get("/")
def read_root():
    return {
        "status": "healthy",
        "service": "chatbot-rag-python-backend",
        "ollama_model": os.getenv("OLLAMA_MODEL", "nomic-embed-text")
    }

if __name__ == "__main__":
    import uvicorn
    # Use reload in development mode. Port 8000 is default.
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
