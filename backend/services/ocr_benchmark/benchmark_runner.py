import os
import tempfile
import logging
from typing import List, Dict, Any

from services.vector_store import get_supabase_client, download_file_from_storage
from services.ocr_benchmark.engine_runner import (
    PyMuPDFEngine, SuryaOCREngine, PaddleOCREngine, TesseractOCREngine, DocTREngine
)
from services.ocr_benchmark.metrics import (
    calculate_speed_score, calculate_extraction_score, calculate_chunk_quality_score, calculate_resource_score
)
from services.ocr_benchmark.retrieval_eval import RetrievalEvaluator
from services.ocr_benchmark.scoring import compute_overall_score, determine_winners_and_recommendations
from services.ocr_benchmark.report_generator import generate_markdown_report
from services.chunker import chunk_text
from services.embeddings import EmbeddingService

logger = logging.getLogger("rag_backend.ocr_benchmark.benchmark_runner")

class BenchmarkRunner:
    def __init__(self):
        self.evaluator = RetrievalEvaluator()
        self.embedding_service = EmbeddingService()

    async def run_benchmark(
        self, 
        document_id: str, 
        storage_path: str, 
        chat_id: str, 
        user_id: str, 
        auth_token: str = None
    ) -> str:
        """
        Orchestrates the execution of the full OCR Benchmark Suite on a document.
        Saves the benchmark results to the database and returns the benchmark_id.
        """
        logger.info(f"Starting OCR benchmark for document {document_id} (user: {user_id})")
        supabase = get_supabase_client(auth_token)

        # 1. Create a run record in the ocr_benchmarks table
        run_res = supabase.table("ocr_benchmarks").insert({
            "document_id": document_id,
            "user_id": user_id
        }).execute()
        
        if not run_res.data:
            raise RuntimeError("Failed to create ocr_benchmarks run record in Supabase.")
            
        benchmark_id = run_res.data[0]["id"]
        logger.info(f"Created benchmark run with ID: {benchmark_id}")

        # Fetch document metadata for classification
        doc_meta = supabase.table("documents").select("name").eq("id", document_id).single().execute()
        document_name = doc_meta.data.get("name", "Document") if doc_meta.data else "Document"

        # 2. Download PDF bytes
        file_bytes = await download_file_from_storage(storage_path, auth_token=auth_token)
        
        # Save bytes to temporary file path
        tmp_path = None
        extracted_texts = {}
        engine_metrics = {}
        
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_file:
                tmp_file.write(file_bytes)
                tmp_path = tmp_file.name
                
            logger.info(f"Downloaded document path for benchmark: {tmp_path}")

            # 3. Define and run engines
            engines = [
                PyMuPDFEngine(),
                SuryaOCREngine(),
                PaddleOCREngine(),
                TesseractOCREngine(),
                DocTREngine()
            ]
            
            for engine in engines:
                logger.info(f"Running engine: {engine.name}")
                text, metrics = engine.run(tmp_path)
                extracted_texts[engine.name] = text
                engine_metrics[engine.name] = metrics
                logger.info(f"Engine {engine.name} completed in {metrics['processing_time']:.2f} seconds.")

            # 4. Generate evaluation questions based on the best baseline text
            # Prefer PyMuPDF text if it contains digital content, otherwise fall back to Surya OCR
            baseline_text = extracted_texts["PyMuPDF"]
            if len(baseline_text.strip()) < 100:
                baseline_text = extracted_texts["Surya OCR"]
                
            logger.info("Generating evaluation QA questions from baseline text...")
            qa_pairs = await self.evaluator.generate_evaluation_questions(baseline_text)

            # 5. Process scores for each engine
            max_chars = max(len(text) for text in extracted_texts.values())
            max_chars = max(1, max_chars) # avoid divide by zero
            
            results_to_insert = []
            results_summary_for_rec = []
            
            for engine in engines:
                text = extracted_texts[engine.name]
                metrics = engine_metrics[engine.name]
                
                # Chunk text
                chunks = chunk_text(text, size=1000, overlap=200)
                
                # To speed up benchmarking, we only embed the top 8 chunks for retrieval evaluation
                chunks_subset = chunks[:8]
                if chunks_subset:
                    chunk_embeddings = await self.embedding_service.get_embeddings(chunks_subset)
                else:
                    chunk_embeddings = []

                # Calculate Category Scores
                speed_score = calculate_speed_score(metrics["processing_time"], metrics["pages_processed"], engine.is_ocr)
                extraction_score = calculate_extraction_score(text, max_chars)
                chunk_quality_score = calculate_chunk_quality_score(chunks)
                
                # Run retrieval evaluation using nomic embeddings
                retrieval_score = await self.evaluator.evaluate_retrieval(chunks_subset, chunk_embeddings, qa_pairs)
                
                # Resource score
                resource_score = calculate_resource_score(metrics["memory_usage"], metrics["cpu_usage"])
                
                # Overall score (weighted final)
                overall_score = compute_overall_score(
                    retrieval_score=retrieval_score,
                    chunk_quality_score=chunk_quality_score,
                    extraction_score=extraction_score,
                    speed_score=speed_score,
                    resource_score=resource_score
                )
                
                # Save data for bulk database insert
                results_to_insert.append({
                    "benchmark_id": benchmark_id,
                    "engine_name": engine.name,
                    "speed_score": speed_score,
                    "extraction_score": extraction_score,
                    "chunk_quality_score": chunk_quality_score,
                    "retrieval_score": retrieval_score,
                    "resource_score": resource_score,
                    "overall_score": overall_score,
                    "processing_time": metrics["processing_time"],
                    "character_count": len(text),
                    "word_count": len(text.split()),
                    "chunk_count": len(chunks),
                    "memory_usage": metrics["memory_usage"],
                    "cpu_usage": metrics["cpu_usage"]
                })
                
                results_summary_for_rec.append({
                    "engine_name": engine.name,
                    "scores": {
                        "speed_score": speed_score,
                        "extraction_score": extraction_score,
                        "chunk_quality_score": chunk_quality_score,
                        "retrieval_score": retrieval_score,
                        "resource_score": resource_score,
                        "overall_score": overall_score
                    },
                    "metrics": {
                        "processing_time": metrics["processing_time"],
                        "character_count": len(text),
                        "word_count": len(text.split()),
                        "chunk_count": len(chunks),
                        "memory_usage": metrics["memory_usage"],
                        "cpu_usage": metrics["cpu_usage"],
                        "pages_processed": metrics["pages_processed"]
                    }
                })

            # 6. Bulk Insert results into ocr_benchmark_results table
            logger.info(f"Inserting benchmark results for {len(results_to_insert)} engines...")
            insert_res = supabase.table("ocr_benchmark_results").insert(results_to_insert).execute()
            if not insert_res.data:
                raise RuntimeError("Failed to save benchmark results to PostgreSQL.")
                
            logger.info("Successfully inserted all benchmark results to Supabase.")
            return benchmark_id

        finally:
            # Clean up the downloaded temporary file
            if tmp_path and os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                    logger.debug(f"Cleaned up temporary benchmark file: {tmp_path}")
                except Exception as e:
                    logger.warning(f"Failed to delete temporary file {tmp_path}: {e}")
