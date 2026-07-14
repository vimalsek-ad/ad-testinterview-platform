"""Interview Response API — stored in PostgreSQL."""

import os
import uuid

from fastapi import APIRouter, UploadFile, File, Form, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.models.interview_response import InterviewResponse

router = APIRouter(prefix="/api/v1/interview", tags=["interview"])

RECORDINGS_DIR = "/tmp/interview-recordings"
os.makedirs(RECORDINGS_DIR, exist_ok=True)


@router.post("/responses", status_code=status.HTTP_201_CREATED)
async def upload_response(
    file: UploadFile = File(...),
    question_id: str = Form(...),
    session_id: str = Form(...),
    db: AsyncSession = Depends(get_db),
):
    """Upload a video/audio recording — metadata stored in PostgreSQL, file on disk."""
    ext = file.filename.split(".")[-1] if file.filename else "webm"
    filename = f"{session_id}_{question_id}_{uuid.uuid4().hex[:8]}.{ext}"
    filepath = os.path.join(RECORDINGS_DIR, filename)

    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)

    response = InterviewResponse(
        session_id=uuid.UUID(session_id),
        question_id=uuid.UUID(question_id),
        filename=filename,
        filepath=filepath,
        file_size_bytes=len(content),
        content_type=file.content_type,
    )
    db.add(response)
    await db.flush()

    return {
        "response_id": str(response.id),
        "filename": filename,
        "size_mb": round(len(content) / (1024 * 1024), 2),
        "message": "Recording saved successfully",
    }


@router.get("/responses/{session_id}")
async def get_responses(session_id: str, db: AsyncSession = Depends(get_db)):
    """Get all interview responses for a session."""
    result = await db.execute(
        select(InterviewResponse).where(InterviewResponse.session_id == uuid.UUID(session_id))
    )
    responses = result.scalars().all()

    return {
        "session_id": session_id,
        "total_responses": len(responses),
        "responses": [
            {
                "id": str(r.id),
                "question_id": str(r.question_id),
                "filename": r.filename,
                "file_size_bytes": r.file_size_bytes,
                "content_type": r.content_type,
                "submitted_at": r.submitted_at.isoformat(),
            }
            for r in responses
        ],
    }
