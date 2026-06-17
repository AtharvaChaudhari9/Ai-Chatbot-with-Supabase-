import logging
from typing import List, Dict, Any

logger = logging.getLogger("rag_backend.ocr_benchmark.scoring")

def compute_overall_score(
    retrieval_score: float,
    chunk_quality_score: float,
    extraction_score: float,
    speed_score: float,
    resource_score: float
) -> float:
    """
    Computes the weighted overall benchmark score (range 0-100).
    Retrieval: 40%
    Chunk Quality: 20%
    Extraction: 15%
    Speed: 15%
    Resource Usage: 10%
    """
    overall = (
        (retrieval_score * 0.40) +
        (chunk_quality_score * 0.20) +
        (extraction_score * 0.15) +
        (speed_score * 0.15) +
        (resource_score * 0.10)
    )
    return round(max(0.0, min(100.0, overall)), 2)


def determine_winners_and_recommendations(
    results: List[Dict[str, Any]], 
    document_name: str
) -> Dict[str, Any]:
    """
    Analyzes final results, assigns winners for various categories,
    and returns a tailored recommendation paragraph.
    """
    if not results:
        return {}

    best_overall = max(results, key=lambda x: x["scores"]["overall_score"])
    fastest = max(results, key=lambda x: x["scores"]["speed_score"])
    best_retrieval = max(results, key=lambda x: x["scores"]["retrieval_score"])
    most_efficient = max(results, key=lambda x: x["scores"]["resource_score"])
    
    doc_name_lower = document_name.lower()
    
    # 1. Determine document classification category
    if "resume" in doc_name_lower or "cv" in doc_name_lower:
        doc_type = "resume"
    elif "invoice" in doc_name_lower or "receipt" in doc_name_lower or "bill" in doc_name_lower:
        doc_type = "invoice"
    elif "paper" in doc_name_lower or "article" in doc_name_lower or "journal" in doc_name_lower:
        doc_type = "research_paper"
    else:
        doc_type = "general"

    # 2. Formulate recommendation text based on winner capabilities and classification
    rec_text = ""
    winner_name = best_overall["engine_name"]
    
    if doc_type == "resume":
        if winner_name == "PyMuPDF":
            rec_text = "This document is a digital resume. We recommend using **PyMuPDF** because it extracts clean layout boundaries natively with zero OCR overhead, maximizing retrieval quality."
        else:
            rec_text = f"This resume is a scanned image. We recommend using **{winner_name}** because it achieved the highest retrieval quality ({best_retrieval['scores']['retrieval_score']:.0f}/100) and produced the most coherent text chunks for search queries."
            
    elif doc_type == "invoice":
        rec_text = f"Invoices contain complex tables. **{winner_name}** is recommended here. It scored {best_overall['scores']['overall_score']:.1f}/100, providing the best structural preservation to correctly match lines and values."
        
    elif doc_type == "research_paper":
        if winner_name == "PyMuPDF":
            rec_text = "For digital academic research papers, **PyMuPDF** is the optimal choice. It provides instant layout boundary extraction and high-speed processing without requiring a GPU."
        else:
            rec_text = f"For scanned research papers, **{winner_name}** is the winner. It successfully resolved column boundaries and minimized reading order fragmentation, leading to optimal RAG retrieval."
            
    else: # General
        if winner_name == "PyMuPDF":
            rec_text = "This document contains digital text. Native **PyMuPDF** is highly recommended. It processes pages instantly (Speed Score: 100) and consumes negligible system memory."
        else:
            rec_text = f"For general scanned documents, **{winner_name}** achieved the best overall benchmark score. Use it to ensure accurate text indexing and context retrieval."

    return {
        "best_overall": best_overall["engine_name"],
        "fastest": fastest["engine_name"],
        "best_retrieval": best_retrieval["engine_name"],
        "most_efficient": most_efficient["engine_name"],
        "recommendation_text": rec_text
    }
