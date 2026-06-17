import logging
from typing import List, Dict, Any

logger = logging.getLogger("rag_backend.ocr_benchmark.report_generator")

def generate_markdown_report(
    document_name: str,
    results: List[Dict[str, Any]],
    recommendation: Dict[str, Any]
) -> str:
    """
    Generates a formatted markdown report outlining benchmark findings.
    """
    if not results or not recommendation:
        return "# OCR Benchmark Report\nNo results available."

    markdown = []
    
    # 1. Header & Executive Summary
    markdown.append(f"# OCR Benchmark Report: {document_name}")
    markdown.append("\n## Executive Summary")
    markdown.append(f"An OCR and document extraction benchmark was run on **{document_name}** comparing multiple extraction engines.")
    markdown.append(f"The best overall engine for this file was determined to be **{recommendation['best_overall']}**.")
    markdown.append(f"\n> 🔬 **Recommendation**: {recommendation['recommendation_text']}")
    
    # 2. Winner Categories list
    markdown.append("\n### Winner Categories")
    markdown.append(f"*   **Best Overall Engine**: `{recommendation['best_overall']}`")
    markdown.append(f"*   **Best Retrieval Engine (RAG)**: `{recommendation['best_retrieval']}`")
    markdown.append(f"*   **Fastest Processing Engine**: `{recommendation['fastest']}`")
    markdown.append(f"*   **Most Resource Efficient Engine**: `{recommendation['most_efficient']}`")
    
    # 3. Summary comparison table
    markdown.append("\n## Score Comparisons")
    markdown.append("| Engine | Overall Score | Retrieval Score (40%) | Chunk Quality (20%) | Speed Score (15%) | Resource Score (10%) |")
    markdown.append("| :--- | :---: | :---: | :---: | :---: | :---: |")
    
    for r in results:
        scores = r["scores"]
        name_bold = f"**{r['engine_name']}**" if r["engine_name"] == recommendation["best_overall"] else r["engine_name"]
        markdown.append(
            f"| {name_bold} | {scores['overall_score']:.1f} | {scores['retrieval_score']:.1f} | "
            f"{scores['chunk_quality_score']:.1f} | {scores['speed_score']:.1f} | {scores['resource_score']:.1f} |"
        )
        
    # 4. Detailed metrics table
    markdown.append("\n## Detailed Metrics")
    markdown.append("| Engine | Time (s) | Speed (pg/s) | Chars Extracted | Chunks Created | Memory (MB) | CPU (%) |")
    markdown.append("| :--- | :---: | :---: | :---: | :---: | :---: | :---: |")
    
    for r in results:
        metrics = r["metrics"]
        name = r["engine_name"]
        processing_time = metrics["processing_time"]
        pages = metrics["pages_processed"]
        pg_per_sec = pages / processing_time if processing_time > 0 else 0
        
        markdown.append(
            f"| {name} | {processing_time:.2f}s | {pg_per_sec:.2f} pg/s | {metrics['character_count']:,} | "
            f"{metrics['chunk_count']} | {metrics['memory_usage']:.1f} MB | {metrics['cpu_usage']:.1f}% |"
        )
        
    # 5. Strengths and Weaknesses section
    markdown.append("\n## Per-Engine Analysis")
    
    strengths_weaknesses = {
        "PyMuPDF": {
            "strengths": "Instant processing, zero character errors on digital layers, extremely low CPU/RAM consumption.",
            "weaknesses": "Cannot extract text from scanned images or images inside PDFs."
        },
        "Surya OCR": {
            "strengths": "Highly accurate layout-aware text recognition, preserves reading order, handles multi-column pages cleanly.",
            "weaknesses": "Significant processing time, requires PyTorch weights, higher memory usage."
        },
        "PaddleOCR": {
            "strengths": "Good processing speed balance, highly efficient on CPU resources.",
            "weaknesses": "Lacks structure/layout hierarchy detection, occasionally fragments sentences."
        },
        "Tesseract OCR": {
            "strengths": "Lightweight deployment, low RAM usage.",
            "weaknesses": "Lower character recognition confidence, easily confused by multi-column formats or background noise."
        },
        "DocTR": {
            "strengths": "Good layout-aware segmentation, accurate text alignments.",
            "weaknesses": "Slower speed, high resource usage during model inference."
        }
    }
    
    for r in results:
        name = r["engine_name"]
        analysis = strengths_weaknesses.get(name, {"strengths": "Not evaluated.", "weaknesses": "Not evaluated."})
        markdown.append(f"\n### {name}")
        markdown.append(f"*   **Key Strength**: {analysis['strengths']}")
        markdown.append(f"*   **Weakness**: {analysis['weaknesses']}")
        
    return "\n".join(markdown)
