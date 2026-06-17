import re
import logging
from typing import Dict, Any, List

logger = logging.getLogger("rag_backend.ocr_benchmark.metrics")

def calculate_speed_score(processing_time: float, pages_processed: int, is_ocr: bool) -> float:
    """
    Calculates a speed score out of 100.
    Native engines are expected to be much faster than OCR.
    """
    if pages_processed <= 0:
        return 0.0
        
    time_per_page = processing_time / pages_processed
    
    if is_ocr:
        # For OCR, 0.5s per page is a 100 score, 3.0s per page is a 50 score
        score = 100.0 * (1.0 - min(0.9, (time_per_page - 0.5) / 5.0))
    else:
        # For native, 0.01s per page is 100, 0.2s is 50
        score = 100.0 * (1.0 - min(0.9, (time_per_page - 0.01) / 0.4))
        
    return max(10.0, min(100.0, score))


def calculate_extraction_score(text: str, max_chars_across_engines: int) -> float:
    """
    Calculates extraction completeness out of 100 compared to the best engine's extraction.
    Also measures the ratio of alphabetic characters and words.
    """
    if not text.strip() or max_chars_across_engines <= 0:
        return 0.0
        
    char_count = len(text)
    words = text.split()
    word_count = len(words)
    
    # 1. Volume score (how much text was retrieved compared to the maximum extracted)
    volume_ratio = min(1.0, char_count / max_chars_across_engines)
    
    # 2. Text density score (avoid garbage/noise characters if possible)
    # Check ratio of alphanumeric characters to total characters
    alnum_chars = len(re.sub(r'[^a-zA-Z0-9]', '', text))
    density_ratio = alnum_chars / char_count if char_count > 0 else 0.0
    # Expected density for clean text is usually 0.70 to 0.85 (accounting for spaces/punctuation)
    density_score = 1.0 if (0.65 <= density_ratio <= 0.90) else (1.0 - abs(0.78 - density_ratio))
    
    # 3. Word structure score (average word length should be between 3 and 10 characters)
    avg_word_len = char_count / word_count if word_count > 0 else 0.0
    word_score = 1.0 if (4.0 <= avg_word_len <= 8.0) else max(0.5, 1.0 - abs(6.0 - avg_word_len) / 10.0)
    
    # Combined score
    extraction_score = (volume_ratio * 0.6 + density_score * 0.2 + word_score * 0.2) * 100.0
    return max(0.0, min(100.0, extraction_score))


def calculate_chunk_quality_score(chunks: List[str]) -> float:
    """
    Calculates a chunking quality score based on cohesion, sentence fragmentation,
    and average size consistency.
    """
    if not chunks:
        return 0.0
        
    total_chunks = len(chunks)
    avg_size = sum(len(c) for c in chunks) / total_chunks
    
    # 1. Penalty for empty or near-empty chunks
    empty_chunks = sum(1 for c in chunks if len(c.strip()) < 20)
    empty_penalty = (empty_chunks / total_chunks) * 50.0
    
    # 2. Sentence boundary preservation score (RAG chunking should ideally break at sentences)
    # We inspect if chunks end with a sentence terminator (. ! ?) or space/punctuation
    clean_ends = 0
    for chunk in chunks:
        trimmed = chunk.strip()
        if not trimmed:
            continue
        if trimmed[-1] in ['.', '!', '?', '"', "'", '`']:
            clean_ends += 1
            
    sentence_boundary_ratio = clean_ends / total_chunks
    
    # 3. Size balance score (chunks should be around target size, e.g. 1000 characters)
    # If average size is too small (<300) or too large (>1500), score goes down
    if 600 <= avg_size <= 1100:
        size_score = 1.0
    else:
        diff = min(500.0, abs(850.0 - avg_size))
        size_score = max(0.4, 1.0 - (diff / 800.0))
        
    chunk_score = (sentence_boundary_ratio * 0.5 + size_score * 0.5) * 100.0 - empty_penalty
    return max(10.0, min(100.0, chunk_score))


def calculate_resource_score(memory_usage: float, cpu_usage: float) -> float:
    """
    Calculates resource efficiency score out of 100.
    Lower CPU and RAM consumption leads to a higher score.
    """
    # RAM: 10MB is perfect (100 score), 200MB is mediocre, 1000MB is poor
    ram_score = max(10.0, 100.0 * (1.0 - min(0.9, max(0.0, memory_usage - 10.0) / 900.0)))
    
    # CPU: 5% is perfect (100 score), 80% is high, 100% is poor
    cpu_score = max(10.0, 100.0 * (1.0 - min(0.9, max(0.0, cpu_usage - 5.0) / 95.0)))
    
    # Combined score (weighted: 60% RAM, 40% CPU)
    return (ram_score * 0.6 + cpu_score * 0.4)
