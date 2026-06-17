import os
import asyncio
import logging
import httpx
from typing import List

logger = logging.getLogger("rag_backend.embeddings")

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "nomic-embed-text")

class EmbeddingService:
    def __init__(self):
        self.base_url = OLLAMA_BASE_URL
        self.model = OLLAMA_MODEL
        logger.info(f"Initialized EmbeddingService with Ollama at {self.base_url} using model {self.model}")

    async def _post_with_retry(self, client: httpx.AsyncClient, endpoint: str, json_data: dict, max_retries: int = 5) -> httpx.Response:
        """
        Helper method to perform POST requests to Ollama with exponential backoff retry logic.
        """
        url = f"{self.base_url}{endpoint}"
        delay = 1.0  # initial delay in seconds
        
        for attempt in range(1, max_retries + 1):
            try:
                response = await client.post(url, json=json_data, timeout=30.0)
                if response.status_code == 200:
                    return response
                
                logger.warning(
                    f"Ollama returned status {response.status_code} on attempt {attempt}/{max_retries}. "
                    f"Response: {response.text}"
                )
            except (httpx.ConnectError, httpx.TimeoutException, httpx.RequestError) as e:
                logger.warning(f"Ollama request failed on attempt {attempt}/{max_retries}: {str(e)}")
            
            if attempt < max_retries:
                logger.info(f"Retrying Ollama in {delay:.2f} seconds...")
                await asyncio.sleep(delay)
                delay *= 2.0  # exponential backoff
                
        raise RuntimeError(f"Failed to communicate with local Ollama service after {max_retries} attempts.")

    async def get_embeddings(self, texts: List[str]) -> List[List[float]]:
        """
        Generates embeddings for a list of text chunks.
        First attempts to use Ollama's batch '/api/embed' endpoint.
        If it returns 404 (legacy Ollama version), falls back to calling '/api/embeddings' in parallel.
        """
        if not texts:
            return []
            
        async with httpx.AsyncClient() as client:
            # Try the batch API endpoint first (introduced in recent Ollama versions)
            try:
                logger.debug(f"Attempting batch embedding for {len(texts)} chunks using /api/embed")
                payload = {
                    "model": self.model,
                    "input": texts
                }
                
                response = await self._post_with_retry(client, "/api/embed", payload)
                data = response.json()
                
                if "embeddings" in data:
                    embeddings = data["embeddings"]
                    if len(embeddings) == len(texts):
                        return embeddings
                    logger.warning(f"Batch embed returned {len(embeddings)} items, expected {len(texts)}. Falling back to individual embedding calls.")
            except Exception as e:
                # If it's a 404 or other request error, fall back to individual calls
                logger.info(f"Batch /api/embed failed or is unsupported, falling back to individual calls. Details: {e}")

            # Fallback: Process chunks individually (concurrently)
            logger.debug(f"Generating embeddings individually for {len(texts)} chunks")
            
            async def get_single_embedding(text: str) -> List[float]:
                payload = {
                    "model": self.model,
                    "prompt": text
                }
                res = await self._post_with_retry(client, "/api/embeddings", payload)
                res_data = res.json()
                if "embedding" in res_data:
                    return res_data["embedding"]
                raise ValueError(f"Ollama response missing 'embedding' field: {res_data}")

            # Run individual embedding generation concurrently
            tasks = [get_single_embedding(t) for t in texts]
            return await asyncio.gather(*tasks)

    async def get_embedding(self, text: str) -> List[float]:
        """
        Generates an embedding vector for a single query text string.
        """
        embeddings = await self.get_embeddings([text])
        if not embeddings or not embeddings[0]:
            raise ValueError("Failed to generate embedding vector.")
        return embeddings[0]
