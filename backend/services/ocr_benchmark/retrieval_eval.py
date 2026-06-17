import json
import logging
import math
from typing import List, Dict, Any, Tuple
from services.ocr_benchmark.llm_helper import LLMHelper
from services.embeddings import EmbeddingService

logger = logging.getLogger("rag_backend.ocr_benchmark.retrieval_eval")

def dot_product(v1: List[float], v2: List[float]) -> float:
    return sum(x * y for x, y in zip(v1, v2))

def magnitude(v: List[float]) -> float:
    return math.sqrt(sum(x * x for x in v))

def cosine_similarity(v1: List[float], v2: List[float]) -> float:
    m1 = magnitude(v1)
    m2 = magnitude(v2)
    if m1 == 0 or m2 == 0:
        return 0.0
    return dot_product(v1, v2) / (m1 * m2)


class RetrievalEvaluator:
    def __init__(self):
        self.llm = LLMHelper()
        self.embedding_service = EmbeddingService()

    async def generate_evaluation_questions(self, baseline_text: str) -> List[Dict[str, Any]]:
        """
        Generates 3 document-specific user evaluation questions with keywords
        using the LLM based on the baseline text.
        """
        # Take a subset of baseline text to fit context window safely
        context = baseline_text[:4000]
        
        prompt = f"""
Analyze the following document excerpt and generate exactly 3 distinct user questions that could be asked about its contents.
For each question, list 3 key terms or keywords that MUST be present in the document to answer it.

Return ONLY a valid JSON array of objects with "question" and "keywords" fields. Do not include markdown wraps or extra commentary.
Example:
[
  {{"question": "What is the author's work history?", "keywords": ["experience", "history", "employed"]}}
]

Document Excerpt:
---
{context}
---
"""
        try:
            res_text = await self.llm.generate(prompt, system_instruction="You are an expert QA generator. Output raw JSON arrays only.")
            # Clean markdown wraps if the model returned them
            clean_json = res_text.strip()
            if clean_json.startswith("```json"):
                clean_json = clean_json[7:]
            if clean_json.endswith("```"):
                clean_json = clean_json[:-3]
            clean_json = clean_json.strip()
            
            questions = json.loads(clean_json)
            if isinstance(questions, list) and len(questions) > 0:
                logger.info(f"Successfully auto-generated {len(questions)} evaluation questions.")
                return questions[:3]
        except Exception as e:
            logger.error(f"Failed to generate questions: {e}. Using static default questions.")
            
        # Static defaults in case LLM is offline or returns invalid JSON
        return [
            {"question": "What is the primary topic or objective of this document?", "keywords": ["objective", "topic", "purpose"]},
            {"question": "Identify any specific key results, dates, or quantitative values mentioned.", "keywords": ["results", "date", "numbers"]},
            {"question": "Detail the main qualifications, methodologies, or structural sections defined.", "keywords": ["methodology", "qualification", "skills"]}
        ]

    async def evaluate_retrieval(
        self, 
        chunks: List[str], 
        chunk_embeddings: List[List[float]], 
        qa_pairs: List[Dict[str, Any]]
    ) -> float:
        """
        Runs local vector search on the chunks for each question,
        compares similarity, and evaluates context relevance and completeness.
        """
        if not chunks or not chunk_embeddings or not qa_pairs:
            return 0.0
            
        total_questions = len(qa_pairs)
        scores = []
        
        for qa in qa_pairs:
            question = qa["question"]
            keywords = qa.get("keywords", [])
            
            # 1. Generate query embedding
            try:
                query_vector = await self.embedding_service.get_embedding(question)
            except Exception as e:
                logger.error(f"Failed generating query embedding: {e}")
                continue
                
            # 2. Local vector search: compute cosine similarity
            chunk_scores = []
            for idx, c_emb in enumerate(chunk_embeddings):
                sim = cosine_similarity(query_vector, c_emb)
                chunk_scores.append((sim, chunks[idx]))
                
            # Sort by similarity descending
            chunk_scores.sort(key=lambda x: x[0], reverse=True)
            
            # Retrieve top 3 matching chunks
            top_matches = chunk_scores[:3]
            if not top_matches:
                scores.append(0.0)
                continue
                
            # 3. Calculate keyword presence (Relevance score)
            matched_keywords = 0
            combined_retrieved_text = " ".join([text for _, text in top_matches]).lower()
            
            for kw in keywords:
                if kw.lower() in combined_retrieved_text:
                    matched_keywords += 1
                    
            relevance_ratio = matched_keywords / len(keywords) if keywords else 1.0
            
            # 4. Calculate similarity depth (Completeness score)
            # Average similarity score of the top match (scaled up to emphasize high relevance matches)
            top_similarity = top_matches[0][0]
            similarity_factor = min(1.0, max(0.0, (top_similarity - 0.3) / 0.5))  # scale 0.3-0.8 similarity to 0.0-1.0
            
            # Combined score for this QA pair (60% keyword matching, 40% vector depth)
            qa_score = (relevance_ratio * 0.6 + similarity_factor * 0.4) * 100.0
            scores.append(qa_score)
            
        if not scores:
            return 10.0
            
        # Return average retrieval score
        return sum(scores) / len(scores)
