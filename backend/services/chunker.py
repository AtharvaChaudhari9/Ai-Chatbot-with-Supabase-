def chunk_text(text: str, size: int = 1000, overlap: int = 200) -> list[str]:
    """
    Chunks a text string into smaller pieces with a specified size and overlap.
    """
    if size <= 0:
        return [text]
    
    # Clean up carriage returns
    clean_text = text.replace('\r\n', '\n')
    chunks = []
    i = 0
    
    while i < len(clean_text):
        chunk = clean_text[i : i + size]
        if chunk.strip():
            chunks.append(chunk)
            
        step = size - overlap
        if step <= 0:
            break
        i += step
        
    return chunks
