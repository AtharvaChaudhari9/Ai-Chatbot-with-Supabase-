import os
import logging
from typing import List, Dict, Any, Optional
from qdrant_client import QdrantClient
from qdrant_client.http import models

logger = logging.getLogger("rag_backend.qdrant_service")

class QdrantService:
    _instance = None

    def __new__(cls, *args, **kwargs):
        if not cls._instance:
            cls._instance = super(QdrantService, cls).__new__(cls, *args, **kwargs)
        return cls._instance

    def __init__(self):
        # Prevent re-initialization if already initialized
        if hasattr(self, "initialized") and self.initialized:
            return
        
        host = os.getenv("QDRANT_HOST", "localhost")
        port = int(os.getenv("QDRANT_PORT", "6333"))
        self.collection_name = os.getenv("QDRANT_COLLECTION", "documents")
        
        url = f"http://{host}:{port}"
        logger.info(f"Initializing Qdrant client at {url}...")
        self.client = QdrantClient(url=url)
        self.initialized = True

    def recreate_or_ensure_collection(self, vector_size: int):
        """
        Ensures that the Qdrant collection exists and has the correct vector size.
        If it does not exist, creates it.
        """
        try:
            # Check if collection exists
            exists = self.client.collection_exists(self.collection_name)
            if not exists:
                logger.info(f"Collection '{self.collection_name}' does not exist. Creating it with vector size {vector_size}...")
                self.client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=models.VectorParams(
                        size=vector_size,
                        distance=models.Distance.COSINE
                    )
                )
                logger.info(f"Collection '{self.collection_name}' created successfully.")
            else:
                logger.info(f"Collection '{self.collection_name}' already exists.")
        except Exception as e:
            logger.error(f"Failed to ensure Qdrant collection existence: {e}")
            raise e

    def insert_chunks(
        self,
        user_id: str,
        document_id: str,
        file_name: str,
        chunks: List[str],
        embeddings: List[List[float]],
        uploaded_at: str
    ) -> int:
        """
        Inserts document chunks and vector embeddings into Qdrant collection.
        Returns the number of successfully inserted points.
        """
        import uuid
        from qdrant_client.http.models import PointStruct
        
        points = []
        for idx, chunk_text in enumerate(chunks):
            point_id = str(uuid.uuid4())
            payload = {
                "user_id": user_id,
                "document_id": document_id,
                "file_name": file_name,
                "chunk_text": chunk_text,
                "chunk_index": idx,
                "page_number": 1,  # Default to 1
                "uploaded_at": uploaded_at
            }
            points.append(
                PointStruct(
                    id=point_id,
                    vector=embeddings[idx],
                    payload=payload
                )
            )
            
        logger.info(f"Inserting {len(points)} chunks into Qdrant collection '{self.collection_name}' for document {document_id}...")
        try:
            operation_info = self.client.upsert(
                collection_name=self.collection_name,
                wait=True,
                points=points
            )
            logger.info(f"Qdrant upsert completed. Operation status: {operation_info.status}")
            return len(points)
        except Exception as e:
            logger.error(f"Failed to upsert points to Qdrant: {e}")
            raise RuntimeError(f"Qdrant upsert failed: {str(e)}") from e

    def search_chunks(
        self,
        user_id: str,
        query_vector: List[float],
        document_ids: Optional[List[str]] = None,
        k: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Performs similarity search in Qdrant, filtering by user_id and optionally document_ids.
        Returns a list of dicts with chunk content and similarity score.
        """
        # Build filter conditions
        must_filters = [
            models.FieldCondition(
                key="user_id",
                match=models.MatchValue(value=user_id)
            )
        ]
        
        if document_ids is not None:
            if not document_ids:
                logger.info("No document IDs provided for search filter. Returning empty result.")
                return []
            
            must_filters.append(
                models.FieldCondition(
                    key="document_id",
                    match=models.MatchAny(any=document_ids)
                )
            )
            
        query_filter = models.Filter(must=must_filters)
        
        logger.info(f"Searching Qdrant collection '{self.collection_name}' (k={k}) for user_id={user_id} and document_ids={document_ids}...")
        
        try:
            query_response = self.client.query_points(
                collection_name=self.collection_name,
                query=query_vector,
                query_filter=query_filter,
                limit=k
            )
            
            results = []
            for hit in query_response.points:
                payload = hit.payload or {}
                results.append({
                    "content": payload.get("chunk_text", ""),
                    "similarity": hit.score,
                    "document_id": payload.get("document_id", ""),
                    "file_name": payload.get("file_name", ""),
                    "chunk_index": payload.get("chunk_index", 0),
                    "page_number": payload.get("page_number", 1)
                })
            
            logger.info(f"Retrieved {len(results)} chunks from Qdrant similarity search.")
            return results
        except Exception as e:
            logger.error(f"Failed to search Qdrant: {e}")
            raise RuntimeError(f"Qdrant search failed: {str(e)}") from e

    def delete_document_chunks(self, document_id: str) -> bool:
        """
        Deletes all vector points associated with the given document_id.
        """
        logger.info(f"Deleting Qdrant chunks for document_id={document_id}...")
        try:
            delete_result = self.client.delete(
                collection_name=self.collection_name,
                points_selector=models.FilterSelector(
                    filter=models.Filter(
                        must=[
                            models.FieldCondition(
                                key="document_id",
                                match=models.MatchValue(value=document_id)
                            )
                        ]
                    )
                )
            )
            logger.info(f"Qdrant deletion completed. Result: {delete_result}")
            return True
        except Exception as e:
            logger.error(f"Failed to delete Qdrant chunks for document {document_id}: {e}")
            raise RuntimeError(f"Qdrant deletion failed: {str(e)}") from e
