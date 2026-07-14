"""Interview Response API — receive video/audio recordings from candidates."""

import os
import uuid
from datetime import datetime

from fastapi import APIRouter, UploadFile, File, Form, status

router = APIRouter(prefix="/api/v1/interview", tags=["interview"])

# Store recordings in local folder for prototype
RECORDINGS_DIR = "/tmp/interview-recordings"
os.makedirs(RECORDINGS_DIR, exist_ok=True)

# In-memory response tracking
_responses: dict[str, list[dict]] = {}


@router.post("/responses", status_code=status.HTTP_201_CREATED)
async def upload_response(
    file: UploadFile = File(...),
    question_id: str = Form(...),
    session_id: str = Form(...),
):
    """Upload a video/audio recording for an interview question."""
    # Generate unique filename
    ext = file.filename.split(".")[-1] if file.filename else "webm"
    filename = f"{session_id}_{question_id}_{uuid.uuid4().hex[:8]}.{ext}"
    filepath = os.path.join(RECORDINGS_DIR, filename)

    # Save file
    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)

    # Track response
    if session_id not in _responses:
        _responses[session_id] = []

    response_record = {
        "id": str(uuid.uuid4()),
        "session_id": session_id,
        "question_id": question_id,
        "filename": filename,
        "filepath": filepath,
        "file_size_bytes": len(content),
        "content_type": file.content_type,
        "submitted_at": datetime.utcnow().isoformat(),
    }
    _responses[session_id].append(response_record)

    return {
        "response_id": response_record["id"],
        "filename": filename,
        "size_mb": round(len(content) / (1024 * 1024), 2),
        "message": "Recording saved successfully",
    }


@router.get("/responses/{session_id}")
async def get_responses(session_id: str):
    """Get all interview responses for a session (for reviewer)."""
    responses = _responses.get(session_id, [])
    return {
        "session_id": session_id,
        "total_responses": len(responses),
        "responses": responses,
    }
