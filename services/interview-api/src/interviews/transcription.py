"""Transcription service — uploads video to S3 and uses AWS Transcribe for speech-to-text.

Pipeline: Video file → S3 bucket → AWS Transcribe job → Transcribed text
Replaces the local Whisper approach with a managed AWS service.
"""

import os
import uuid
import time
import logging
from typing import Optional

import boto3
from botocore.exceptions import ClientError

from src.config.settings import settings

logger = logging.getLogger(__name__)

# AWS clients (lazy-loaded)
_s3_client = None
_transcribe_client = None


def _get_s3_client():
    """Get or create S3 client."""
    global _s3_client
    if _s3_client is None:
        kwargs = {"region_name": settings.aws_region}
        if settings.aws_access_key_id:
            kwargs["aws_access_key_id"] = settings.aws_access_key_id
            kwargs["aws_secret_access_key"] = settings.aws_secret_access_key
            if settings.aws_session_token:
                kwargs["aws_session_token"] = settings.aws_session_token
        _s3_client = boto3.client("s3", **kwargs)
    return _s3_client


def _get_transcribe_client():
    """Get or create Transcribe client."""
    global _transcribe_client
    if _transcribe_client is None:
        kwargs = {"region_name": settings.aws_region}
        if settings.aws_access_key_id:
            kwargs["aws_access_key_id"] = settings.aws_access_key_id
            kwargs["aws_secret_access_key"] = settings.aws_secret_access_key
            if settings.aws_session_token:
                kwargs["aws_session_token"] = settings.aws_session_token
        _transcribe_client = boto3.client("transcribe", **kwargs)
    return _transcribe_client


def upload_to_s3(filepath: str, filename: str) -> str:
    """Upload a file to S3 and return the S3 URI.
    
    Args:
        filepath: Local path to the file
        filename: Desired S3 key name
        
    Returns:
        S3 URI (s3://bucket/key)
    """
    s3 = _get_s3_client()
    bucket = settings.s3_recordings_bucket
    s3_key = f"interview-recordings/{filename}"

    logger.info(f"[S3] Uploading {filepath} → s3://{bucket}/{s3_key}")
    s3.upload_file(filepath, bucket, s3_key)
    logger.info(f"[S3] ✅ Upload complete")

    return f"s3://{bucket}/{s3_key}"


def transcribe_file(filepath: str) -> str:
    """Transcribe an audio/video file using AWS Transcribe.
    
    Pipeline:
    1. Upload file to S3
    2. Start AWS Transcribe job
    3. Poll until complete
    4. Return transcribed text
    
    Args:
        filepath: Path to the audio/video file
        
    Returns:
        Transcribed text string.
    """
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"File not found: {filepath}")

    filename = os.path.basename(filepath)

    # Step 1: Upload to S3
    s3_uri = upload_to_s3(filepath, filename)

    # Step 2: Start transcription job
    transcribe = _get_transcribe_client()
    job_name = f"interview-{uuid.uuid4().hex[:12]}"

    # Determine media format from extension
    ext = filename.rsplit(".", 1)[-1].lower()
    media_format_map = {
        "webm": "webm",
        "mp4": "mp4",
        "m4a": "mp4",
        "wav": "wav",
        "flac": "flac",
        "ogg": "ogg",
        "mp3": "mp3",
    }
    media_format = media_format_map.get(ext, "webm")

    logger.info(f"[Transcribe] Starting job '{job_name}' for {s3_uri} (format: {media_format})")

    transcribe.start_transcription_job(
        TranscriptionJobName=job_name,
        Media={"MediaFileUri": s3_uri},
        MediaFormat=media_format,
        LanguageCode=settings.transcribe_language_code,
        OutputBucketName=settings.s3_recordings_bucket,
        OutputKey=f"transcriptions/{job_name}.json",
    )

    # Step 3: Poll until complete (max ~5 minutes)
    max_wait = 300  # 5 minutes
    poll_interval = 5  # seconds
    elapsed = 0

    while elapsed < max_wait:
        time.sleep(poll_interval)
        elapsed += poll_interval

        status_response = transcribe.get_transcription_job(TranscriptionJobName=job_name)
        job_status = status_response["TranscriptionJob"]["TranscriptionJobStatus"]

        if job_status == "COMPLETED":
            logger.info(f"[Transcribe] ✅ Job '{job_name}' completed in {elapsed}s")
            break
        elif job_status == "FAILED":
            reason = status_response["TranscriptionJob"].get("FailureReason", "Unknown")
            logger.error(f"[Transcribe] ❌ Job '{job_name}' failed: {reason}")
            raise RuntimeError(f"Transcription job failed: {reason}")
        else:
            logger.debug(f"[Transcribe] Job '{job_name}' status: {job_status} ({elapsed}s elapsed)")
    else:
        raise TimeoutError(f"Transcription job '{job_name}' timed out after {max_wait}s")

    # Step 4: Get transcript text from output
    transcript_text = _get_transcript_text(job_name)
    logger.info(f"[Transcribe] Transcription: {len(transcript_text)} characters")

    return transcript_text


def _get_transcript_text(job_name: str) -> str:
    """Retrieve the transcript text from the completed job output in S3."""
    import json

    s3 = _get_s3_client()
    bucket = settings.s3_recordings_bucket
    key = f"transcriptions/{job_name}.json"

    try:
        response = s3.get_object(Bucket=bucket, Key=key)
        content = json.loads(response["Body"].read().decode("utf-8"))
        
        # AWS Transcribe output format
        transcripts = content.get("results", {}).get("transcripts", [])
        if transcripts:
            return transcripts[0].get("transcript", "")
        return ""
    except ClientError as e:
        logger.error(f"[Transcribe] Failed to read transcript from S3: {e}")
        # Fallback: try getting from job details
        transcribe = _get_transcribe_client()
        job = transcribe.get_transcription_job(TranscriptionJobName=job_name)
        transcript_uri = job["TranscriptionJob"].get("Transcript", {}).get("TranscriptFileUri")
        if transcript_uri:
            import httpx
            resp = httpx.get(transcript_uri)
            content = resp.json()
            transcripts = content.get("results", {}).get("transcripts", [])
            if transcripts:
                return transcripts[0].get("transcript", "")
        return ""
