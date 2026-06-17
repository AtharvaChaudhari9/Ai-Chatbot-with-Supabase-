import fitz  # PyMuPDF
import io
import logging
from PIL import Image
from services.ocr import run_ocr_on_images

logger = logging.getLogger("rag_backend.pdf_extractor")

def extract_text_from_pdf(pdf_path: str, min_text_len: int = 100) -> str:
    """
    Extracts text content from a PDF file.
    Uses PyMuPDF for quick digital text extraction.
    Falls back to Surya OCR if the extracted text is shorter than min_text_len.
    """
    logger.info(f"Opening PDF file for text extraction: {pdf_path}")
    
    try:
        doc = fitz.open(pdf_path)
    except Exception as e:
        logger.error(f"Failed to open PDF file {pdf_path} using PyMuPDF: {e}")
        raise RuntimeError(f"Failed to parse PDF document structure: {str(e)}") from e
        
    extracted_text_parts = []
    
    # 1. Primary Extraction: Try PyMuPDF digital text extraction
    for page_num, page in enumerate(doc):
        text = page.get_text()
        if text.strip():
            extracted_text_parts.append(text)
            
    digital_text = "\n\n".join(extracted_text_parts).strip()
    logger.info(f"PyMuPDF digital text extraction completed. Total length: {len(digital_text)} characters.")
    
    # If the text is sufficient, return it immediately
    if len(digital_text) >= min_text_len:
        logger.info("Extracted digital text is sufficient. Returning results.")
        doc.close()
        return digital_text
        
    # 2. Fallback Extraction: Scanned PDF detected, perform Surya OCR
    logger.info(
        f"Extracted text length ({len(digital_text)}) is below threshold ({min_text_len}). "
        "Falling back to Surya OCR..."
    )
    
    images = []
    try:
        for page_num, page in enumerate(doc):
            logger.debug(f"Rendering page {page_num + 1}/{len(doc)} to image for OCR...")
            # Render page to a high-resolution pixmap (150 DPI balance)
            pix = page.get_pixmap(dpi=150)
            img_data = pix.tobytes("png")
            img = Image.open(io.BytesIO(img_data))
            # Load image fully in memory to decouple from file/pixmap stream
            img.load()
            images.append(img)
    except Exception as e:
        logger.error(f"Failed to render PDF pages to images for OCR fallback: {e}")
        doc.close()
        raise RuntimeError(f"Failed to prepare PDF pages for OCR: {str(e)}") from e
        
    doc.close()
    
    # Call the Surya OCR service
    ocr_text = run_ocr_on_images(images)
    logger.info(f"Surya OCR fallback completed. Total length: {len(ocr_text)} characters.")
    return ocr_text
