"""Interview Response API — upload video, auto-transcribe, auto-score."""

import os
import uuid
import asyncio
import logging

from fastapi import APIRouter, UploadFile, File, Form, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.models.interview_response import InterviewResponse
from src.models.question import Question

router = APIRouter(prefix="/api/v1/interview", tags=["interview"])
logger = logging.getLogger(__name__)

RECORDINGS_DIR = "/tmp/interview-recordings"
os.makedirs(RECORDINGS_DIR, exist_ok=True)


@router.post("/responses", status_code=status.HTTP_201_CREATED)
async def upload_response(
    file: UploadFile = File(...),
    question_id: str = Form(...),
    session_id: str = Form(...),
    db: AsyncSession = Depends(get_db),
):
    """Upload a video recording → auto-transcribe → auto-score.
    
    Pipeline: Video → Whisper (speech-to-text) → LLM Gateway (AI scoring)
    """
    ext = file.filename.split(".")[-1] if file.filename else "webm"
    filename = f"{session_id}_{question_id}_{uuid.uuid4().hex[:8]}.{ext}"
    filepath = os.path.join(RECORDINGS_DIR, filename)

    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)

    # Save response record
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

    # Auto-transcribe in background (non-blocking)
    response_id = response.id
    asyncio.create_task(
        _transcribe_and_score(str(response_id), filepath, question_id, session_id)
    )

    return {
        "response_id": str(response.id),
        "filename": filename,
        "size_mb": round(len(content) / (1024 * 1024), 2),
        "message": "Recording saved. Transcription + scoring started in background.",
        "status": "processing",
    }


async def _transcribe_and_score(response_id: str, filepath: str, question_id: str, session_id: str):
    """Background task: transcribe video → score with AI."""
    from src.config.database import AsyncSessionLocal
    from src.models.interview_response import InterviewResponse
    from src.models.question import Question
    from sqlalchemy import select

    try:
        # Step 1: Transcribe using AWS (S3 → Transcribe)
        logger.info(f"[Pipeline] Starting transcription for response {response_id}")
        from src.interviews.transcription import transcribe_file
        import asyncio
        # Run blocking transcription in a thread to avoid blocking the event loop
        transcription = await asyncio.get_event_loop().run_in_executor(None, transcribe_file, filepath)
        
        if not transcription or transcription.strip() == "":
            logger.warning(f"[Pipeline] Empty transcription for response {response_id} — no speech detected")
            transcription = "[No speech detected in recording]"

        logger.info(f"[Pipeline] Transcription complete: '{transcription[:100]}...'")

        # Step 2: Get question prompt for scoring context
        async with AsyncSessionLocal() as db:
            q_result = await db.execute(select(Question).where(Question.id == uuid.UUID(question_id)))
            question = q_result.scalar_one_or_none()
            question_prompt = question.description if question else "Interview question"

            # Step 3: AI Score (try LLM Gateway)
            ai_score = None
            if transcription and transcription != "[No speech detected in recording]":
                try:
                    from src.scoring.llm_client import score_interview_response
                    scores = await score_interview_response(
                        question_prompt=question_prompt,
                        candidate_response=transcription,
                    )
                    if not scores.get("error"):
                        ai_score = scores.get("composite_score", 0)
                        logger.info(f"[Pipeline] AI Score: {ai_score} (confidence: {scores.get('confidence')})")
                    else:
                        logger.warning(f"[Pipeline] AI scoring failed: {scores.get('reasoning')}")
                except Exception as score_err:
                    logger.warning(f"[Pipeline] AI scoring unavailable: {score_err}")

            # Step 4: Update database with transcription + score
            result = await db.execute(
                select(InterviewResponse).where(InterviewResponse.id == uuid.UUID(response_id))
            )
            resp = result.scalar_one_or_none()
            if resp:
                resp.transcription = transcription
                resp.ai_score = ai_score
                await db.commit()
                logger.info(f"[Pipeline] ✅ Response {response_id} updated with transcription + score")

    except Exception as e:
        logger.error(f"[Pipeline] ❌ Failed for response {response_id}: {e}")
        # Mark as failed in DB so frontend doesn't show "processing..." forever
        try:
            from src.config.database import AsyncSessionLocal
            from src.models.interview_response import InterviewResponse
            from sqlalchemy import select
            async with AsyncSessionLocal() as db:
                result = await db.execute(
                    select(InterviewResponse).where(InterviewResponse.id == uuid.UUID(response_id))
                )
                resp = result.scalar_one_or_none()
                if resp:
                    resp.transcription = f"[Transcription failed: {str(e)}]"
                    await db.commit()
        except Exception:
            pass


@router.get("/responses/{session_id}")
async def get_responses(session_id: str, db: AsyncSession = Depends(get_db)):
    """Get all interview responses for a session (with transcriptions + scores)."""
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
                "transcription": r.transcription,
                "ai_score": r.ai_score,
                "submitted_at": r.submitted_at.isoformat(),
                "status": "scored" if r.ai_score is not None else ("transcribed" if r.transcription else "processing"),
            }
            for r in responses
        ],
    }
