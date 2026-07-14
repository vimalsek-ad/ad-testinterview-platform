"""Review Dashboard API — view candidates, scores, proctoring, and make decisions."""

from uuid import UUID
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.auth.dependencies import get_current_user
from src.models.user import UserAccount
from src.models.assessment import Assessment, CandidateSession
from src.models.submission import CodeSubmission
from src.proctoring.router import _flag_store
from src.interviews.router import _responses

router = APIRouter(prefix="/api/v1/reviews", tags=["reviews"])


# In-memory decision store for prototype
_decisions: dict[str, dict] = {}


class DecisionRequest(BaseModel):
    decision: str  # select | reject | hold
    notes: Optional[str] = None


class DecisionResponse(BaseModel):
    session_id: str
    decision: str
    notes: Optional[str]
    reviewer_email: str
    decided_at: str


@router.get("/assessments/{assessment_id}/candidates")
async def list_candidates(
    assessment_id: UUID,
    user: UserAccount = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all candidates for an assessment with their scores and flag counts."""
    # Get all sessions for this assessment
    result = await db.execute(
        select(CandidateSession)
        .where(CandidateSession.assessment_id == assessment_id)
        .order_by(CandidateSession.composite_score.desc().nulls_last())
    )
    sessions = result.scalars().all()

    candidates = []
    for session in sessions:
        session_key = str(session.id)
        flags = _flag_store.get(session_key, [])
        decision = _decisions.get(session_key)

        # Count severity
        critical = sum(1 for f in flags if f.get("severity") == "critical")
        high = sum(1 for f in flags if f.get("severity") == "high")

        candidates.append({
            "session_id": session_key,
            "candidate_email": session.candidate_email,
            "candidate_name": session.candidate_name,
            "status": session.status,
            "score": session.composite_score,
            "started_at": session.started_at.isoformat() if session.started_at else None,
            "submitted_at": session.submitted_at.isoformat() if session.submitted_at else None,
            "total_flags": len(flags),
            "critical_flags": critical,
            "high_flags": high,
            "decision": decision.get("decision") if decision else None,
        })

    return {
        "assessment_id": str(assessment_id),
        "total_candidates": len(candidates),
        "candidates": candidates,
    }


@router.get("/candidates/{session_id}")
async def get_candidate_detail(
    session_id: UUID,
    user: UserAccount = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get full detail for a candidate — code submissions, proctoring, interview responses."""
    session_key = str(session_id)

    # Get session
    result = await db.execute(select(CandidateSession).where(CandidateSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(404, "Session not found")

    # Get code submissions
    sub_result = await db.execute(
        select(CodeSubmission)
        .where(CodeSubmission.session_id == session_id)
        .order_by(CodeSubmission.submitted_at.desc())
    )
    submissions = sub_result.scalars().all()

    # Get proctoring flags
    flags = _flag_store.get(session_key, [])

    # Get interview responses
    responses = _responses.get(session_key, [])

    # Get decision
    decision = _decisions.get(session_key)

    # Calculate integrity score
    severity_weights = {"low": 1, "medium": 2, "high": 3, "critical": 5}
    severity_score = sum(severity_weights.get(f.get("severity", "low"), 1) for f in flags)
    integrity_score = max(0, 100 - severity_score * 2)

    return {
        "session_id": session_key,
        "candidate_email": session.candidate_email,
        "candidate_name": session.candidate_name,
        "status": session.status,
        "composite_score": session.composite_score,
        "started_at": session.started_at.isoformat() if session.started_at else None,
        "submitted_at": session.submitted_at.isoformat() if session.submitted_at else None,
        "code_submissions": [
            {
                "id": str(s.id),
                "question_id": str(s.question_id),
                "language": s.language,
                "source_code": s.source_code,
                "score": s.score,
                "tests_passed": s.tests_passed,
                "tests_total": s.tests_total,
                "test_results": s.test_results,
                "submitted_at": s.submitted_at.isoformat(),
            }
            for s in submissions
        ],
        "proctoring": {
            "total_flags": len(flags),
            "integrity_score": integrity_score,
            "flags": flags,
        },
        "interview_responses": responses,
        "decision": decision,
    }


@router.post("/candidates/{session_id}/decision", status_code=status.HTTP_201_CREATED)
async def make_decision(
    session_id: UUID,
    payload: DecisionRequest,
    user: UserAccount = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Record a hiring decision for a candidate (select/reject/hold)."""
    if payload.decision not in ("select", "reject", "hold"):
        raise HTTPException(400, "Decision must be: select, reject, or hold")

    session_key = str(session_id)

    # Verify session exists
    result = await db.execute(select(CandidateSession).where(CandidateSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(404, "Session not found")

    # Store decision
    decision_record = {
        "session_id": session_key,
        "decision": payload.decision,
        "notes": payload.notes,
        "reviewer_id": str(user.id),
        "reviewer_email": user.email,
        "decided_at": datetime.utcnow().isoformat(),
    }
    _decisions[session_key] = decision_record

    # Update session status
    session.status = "reviewed"
    await db.flush()

    return decision_record
