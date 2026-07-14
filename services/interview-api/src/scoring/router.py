"""Scoring API — trigger AI scoring for interview responses, get scores."""

from uuid import UUID
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.auth.dependencies import get_current_user
from src.models.user import UserAccount
from src.scoring.llm_client import score_interview_response

router = APIRouter(prefix="/api/v1/scoring", tags=["scoring"])


# In-memory score store for prototype
_score_store: dict[str, dict] = {}


class ScoreRequest(BaseModel):
    question_prompt: str
    candidate_response: str
    scoring_rubric: Optional[dict] = None


class ManualScoreOverride(BaseModel):
    dimension: str  # relevance | completeness | accuracy | clarity
    new_score: int  # 0-100
    reason: str


@router.post("/interview/score")
async def score_response(
    payload: ScoreRequest,
    user: UserAccount = Depends(get_current_user),
):
    """Score an interview response using AI (LLM Gateway).
    
    This endpoint calls the Alter Domus LLM Gateway to evaluate the candidate's
    response against the question prompt and scoring rubric.
    """
    result = await score_interview_response(
        question_prompt=payload.question_prompt,
        candidate_response=payload.candidate_response,
        scoring_rubric=payload.scoring_rubric,
    )

    # Flag for human review if low confidence
    if result.get("confidence", 0) < 0.6:
        result["requires_human_review"] = True
        result["review_reason"] = "AI confidence below threshold (0.6)"
    else:
        result["requires_human_review"] = False

    return result


@router.post("/sessions/{session_id}/score-all")
async def score_all_responses(
    session_id: UUID,
    user: UserAccount = Depends(get_current_user),
):
    """Score all interview responses for a session.
    
    Retrieves all responses, scores each with AI, and returns aggregate results.
    """
    from src.interviews.router import _responses

    session_key = str(session_id)
    responses = _responses.get(session_key, [])

    if not responses:
        raise HTTPException(404, "No interview responses found for this session")

    # For prototype — score a placeholder (actual transcription would come from Whisper)
    scores = []
    for resp in responses:
        # In production, you'd transcribe the video first, then score the transcription
        result = {
            "question_id": resp["question_id"],
            "status": "pending_transcription",
            "note": "Video transcription required before AI scoring. Connect Whisper service for production.",
        }
        scores.append(result)

    _score_store[session_key] = {"scores": scores, "session_id": session_key}

    return {
        "session_id": session_key,
        "total_responses": len(responses),
        "scores": scores,
        "message": "Scoring initiated. Connect Whisper for video transcription → AI scoring pipeline.",
    }


@router.post("/text-score")
async def score_text_response(
    payload: ScoreRequest,
):
    """Score a text interview response (no auth required — for demo/testing).
    
    Directly scores a text response without needing video transcription.
    Useful for text-based interview questions.
    """
    result = await score_interview_response(
        question_prompt=payload.question_prompt,
        candidate_response=payload.candidate_response,
        scoring_rubric=payload.scoring_rubric,
    )
    return result


@router.get("/sessions/{session_id}")
async def get_session_scores(session_id: UUID):
    """Get all scores for a session."""
    session_key = str(session_id)
    scores = _score_store.get(session_key)
    if not scores:
        return {"session_id": session_key, "scores": [], "message": "No scores available yet"}
    return scores
