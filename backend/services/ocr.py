import logging
import io
from typing import List

logger = logging.getLogger("rag_backend.ocr")

# Global variables to cache Surya models once loaded
_detection_model = None
_detection_processor = None
_recognition_model = None
_recognition_processor = None

def _lazy_init_surya():
    """
    Lazy-loads Surya OCR models. This prevents heavy imports and model loading
    during backend startup, and gives a helpful error if dependencies are missing.
    """
    global _detection_model, _detection_processor, _recognition_model, _recognition_processor
    
    if _detection_model is not None:
        return
        
    try:
        logger.info("Initializing Surya OCR models (loading model weights)...")
        import torch
        from surya.model.detection import model as det_model, processor as det_processor
        from surya.model.recognition import model as rec_model, processor as rec_processor
        
        device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info(f"Surya OCR using device: {device}")
        
        # Load the models into memory
        _detection_model = det_model.load_model()
        _detection_processor = det_processor.load_processor()
        _recognition_model = rec_model.load_model()
        _recognition_processor = rec_processor.load_processor()
        
        logger.info("Surya OCR models loaded successfully.")
    except ImportError as e:
        logger.error(
            "Surya OCR packages (surya-ocr, torch) are missing. "
            "Please check requirements.txt and install them to support scanned PDF OCR. "
            f"Error: {e}"
        )
        raise RuntimeError("Surya OCR dependencies missing. Cannot perform OCR on scanned files.") from e
    except Exception as e:
        logger.error(f"Unexpected error loading Surya OCR models: {e}")
        raise RuntimeError(f"Failed to load OCR models: {e}") from e

def run_ocr_on_images(images: List) -> str:
    """
    Runs Surya OCR on a list of PIL Images and returns the concatenated text.
    """
    if not images:
        return ""
        
    # Lazy load models
    _lazy_init_surya()
    
    from surya.ocr import run_ocr
    
    logger.info(f"Running Surya OCR on {len(images)} document page images...")
    
    try:
        # We default language to English ["en"] for OCR detection
        langs = [["en"]] * len(images)
        
        # Run surya OCR pipeline
        predictions = run_ocr(
            images,
            langs,
            _detection_model,
            _detection_processor,
            _recognition_model,
            _recognition_processor
        )
        
        extracted_pages = []
        for i, pred in enumerate(predictions):
            # Extract text from OCRResult
            page_text = ""
            # OCRResult usually has text_lines containing TextLine objects with text
            if hasattr(pred, "text_lines") and pred.text_lines:
                page_text = "\n".join([line.text for line in pred.text_lines])
            elif hasattr(pred, "text"):
                page_text = pred.text
                
            extracted_pages.append(page_text)
            logger.debug(f"OCR Page {i+1} completed. Extracted length: {len(page_text)} chars.")
            
        return "\n\n".join(extracted_pages)
        
    except Exception as e:
        logger.error(f"Error during Surya OCR inference: {e}")
        raise RuntimeError(f"Surya OCR execution failed: {str(e)}") from e
