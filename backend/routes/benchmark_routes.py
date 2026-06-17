import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel

from services.ocr_benchmark.benchmark_runner import BenchmarkRunner
from services.vector_store import get_supabase_client
from services.ocr_benchmark.scoring import determine_winners_and_recommendations
from services.ocr_benchmark.report_generator import generate_markdown_report

logger = logging.getLogger("rag_backend.routes.benchmark")
router = APIRouter()
benchmark_runner = BenchmarkRunner()

class BenchmarkRequest(BaseModel):
    documentId: str
    storagePath: str

class BenchmarkResponse(BaseModel):
    benchmark_id: str
    status: str

@router.post("/benchmark-document", response_model=BenchmarkResponse)
async def start_benchmark(request: BenchmarkRequest, authorization: Optional[str] = Header(None)):
    """
    Triggers the OCR Benchmarking pipeline on the document.
    """
    logger.info(f"Received request to benchmark document: {request.documentId}")
    supabase = get_supabase_client(authorization)
    
    # Resolve user_id and chat_id from the document record in database
    try:
        doc_res = supabase.table("documents").select("user_id, chat_id").eq("id", request.documentId).single().execute()
        if not doc_res.data:
            raise HTTPException(status_code=404, detail="Document metadata not found in database.")
        
        user_id = doc_res.data["user_id"]
        chat_id = doc_res.data["chat_id"]
    except Exception as e:
        logger.error(f"Failed to fetch document metadata: {e}")
        raise HTTPException(status_code=500, detail=f"Database metadata error: {str(e)}")

    # Run the benchmark orchestrator
    try:
        benchmark_id = await benchmark_runner.run_benchmark(
            document_id=request.documentId,
            storage_path=request.storagePath,
            chat_id=chat_id,
            user_id=user_id,
            auth_token=authorization
        )
        return BenchmarkResponse(benchmark_id=benchmark_id, status="completed")
    except Exception as e:
        logger.error(f"Benchmark run failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/benchmark/{id}")
async def get_benchmark_results(id: str, authorization: Optional[str] = Header(None)):
    """
    Retrieves the benchmark results, compiles the report and formatting data.
    """
    logger.info(f"Fetching benchmark results for ID: {id}")
    supabase = get_supabase_client(authorization)
    
    try:
        # Fetch run details
        run_res = supabase.table("ocr_benchmarks").select("*, documents(name)").eq("id", id).single().execute()
        if not run_res.data:
            raise HTTPException(status_code=404, detail="Benchmark run not found.")
            
        document_name = run_res.data["documents"]["name"] if run_res.data.get("documents") else "Document"
        created_at = run_res.data["created_at"]
        
        # Fetch results
        results_res = supabase.table("ocr_benchmark_results").select("*").eq("benchmark_id", id).execute()
        results = results_res.data if results_res.data else []
        
        if not results:
            raise HTTPException(status_code=404, detail="Benchmark results not found or run incomplete.")
            
        # Format structure to match scorer
        results_summary = []
        for r in results:
            results_summary.append({
                "engine_name": r["engine_name"],
                "scores": {
                    "speed_score": r["speed_score"],
                    "extraction_score": r["extraction_score"],
                    "chunk_quality_score": r["chunk_quality_score"],
                    "retrieval_score": r["retrieval_score"],
                    "resource_score": r["resource_score"],
                    "overall_score": r["overall_score"]
                },
                "metrics": {
                    "processing_time": r["processing_time"],
                    "character_count": r["character_count"],
                    "word_count": r["word_count"],
                    "chunk_count": r["chunk_count"],
                    "memory_usage": r["memory_usage"],
                    "cpu_usage": r["cpu_usage"],
                    "pages_processed": int(r["character_count"] / 1500) or 1  # estimate page count for visual consistency
                }
            })
            
        # Compute recommendation and winner details
        recommendation = determine_winners_and_recommendations(results_summary, document_name)
        report_markdown = generate_markdown_report(document_name, results_summary, recommendation)
        
        # Format chart data
        # 1. Overall ranking data (Bar Chart)
        overall_ranking = [
            {"name": r["engine_name"], "score": round(r["scores"]["overall_score"], 1)}
            for r in results_summary
        ]
        overall_ranking.sort(key=lambda x: x["score"], reverse=True)
        
        # 2. Radar Chart data
        radar_data = []
        categories = [
            ("overall_score", "Overall"),
            ("retrieval_score", "Retrieval"),
            ("chunk_quality_score", "Chunking"),
            ("extraction_score", "Extraction"),
            ("speed_score", "Speed"),
            ("resource_score", "Resources")
        ]
        
        for score_key, label in categories:
            row = {"subject": label}
            for r in results_summary:
                row[r["engine_name"]] = round(r["scores"][score_key], 1)
            radar_data.append(row)
            
        # 3. Speed Comparison (Bar Chart)
        speed_comparison = [
            {
                "name": r["engine_name"], 
                "time": round(r["metrics"]["processing_time"], 2),
                "speed": round(r["metrics"]["pages_processed"] / r["metrics"]["processing_time"], 2) if r["metrics"]["processing_time"] > 0 else 0
            }
            for r in results_summary
        ]
        
        # 4. Resource Usage
        resource_comparison = [
            {"name": r["engine_name"], "ram": round(r["metrics"]["memory_usage"], 1), "cpu": round(r["metrics"]["cpu_usage"], 1)}
            for r in results_summary
        ]

        return {
            "benchmark_id": id,
            "document_name": document_name,
            "created_at": created_at,
            "results": results_summary,
            "recommendation": recommendation,
            "report_markdown": report_markdown,
            "charts": {
                "overall_ranking": overall_ranking,
                "radar_data": radar_data,
                "speed_comparison": speed_comparison,
                "resource_comparison": resource_comparison
            }
        }
        
    except Exception as e:
        logger.error(f"Error fetching benchmark results: {e}")
        raise HTTPException(status_code=500, detail=str(e))
