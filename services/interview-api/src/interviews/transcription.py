"""Transcription service — converts video/audio recordings to text using Whisper."""

import os
import whisper
import logging

logger = logging.getLogger(__name__)

# Load Whisper model once at module level (downloads ~150MB on first run)
_model = None


def get_model():
    """Lazy-load Whisper model."""
    global _model
    if _model is None:
        logger.info("Loading Whisper 'base' model (first time may download ~150MB)...")
        _model = whisper.load_model("base")
        logger.info("Whisper model loaded successfully")
    return _model


def transcribe_file(filepath: str) -> str:
    """Transcribe an audio/video file to text.
    
    Args:
        filepath: Path to the video/audio file (.webm, .mp4, .wav, etc.)
    
    Returns:
        Transcribed text string.
    """
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"Recording file not found: {filepath}")

    model = get_model()
    logger.info(f"Transcribing: {filepath}")

    result = model.transcribe(filepath, language="en")
    text = result["text"].strip()

    logger.info(f"Transcription complete: {len(text)} characters")
    return text
