"""Review Dashboard API — view candidates, scores, proctoring, and make decisions (PostgreSQL)."""

from uuid import UUID
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.auth.dependencies import get_current_user
from src.models.user import UserAccount
from src.models.assessment import Assessment, CandidateSession
from src.models.submission import CodeSubmission
from src.models.proctoring import ProctoringFlag
from src.models.review import ReviewDecision
from src.models.interview_response import InterviewResponse

router = APIRouter(prefix="/api/v1/reviews", tags=["reviews"])


class DecisionRequest(BaseModel):
    decision: str  # select | reject | hold
    notes: Optional[str] = None


@router.get("/assessments/{assessment_id}/candidates")
async def list_candidates(
    assessment_id: UUID,
    user: UserAccount = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all candidates for an assessment with their scores and flag counts."""
    result = await db.execute(
        select(CandidateSession)
        .where(CandidateSession.assessment_id == assessment_id)
        .order_by(CandidateSession.composite_score.desc().nulls_last())
    )
    sessions = result.scalars().all()

    candidates = []
    for session in sessions:
        # Count flags
        flag_result = await db.execute(
            select(func.count(ProctoringFlag.id)).where(ProctoringFlag.session_id == session.id)
        )
        total_flags = flag_result.scalar() or 0

        critical_result = await db.execute(
            select(func.count(ProctoringFlag.id))
            .where(ProctoringFlag.session_id == session.id, ProctoringFlag.severity == "critical")
        )
        critical_flags = critical_result.scalar() or 0

        high_result = await db.execute(
            select(func.count(ProctoringFlag.id))
            .where(ProctoringFlag.session_id == session.id, ProctoringFlag.severity == "high")
        )
        high_flags = high_result.scalar() or 0

        # Get decision
        dec_result = await db.execute(
            select(ReviewDecision).where(ReviewDecision.session_id == session.id)
        )
        decision = dec_result.scalar_one_or_none()

        candidates.append({
            "session_id": str(session.id),
            "candidate_email": session.candidate_email,
            "candidate_name": session.candidate_name,
            "status": session.status,
            "score": session.composite_score,
            "started_at": session.started_at.isoformat() if session.started_at else None,
            "submitted_at": session.submitted_at.isoformat() if session.submitted_at else None,
            "total_flags": total_flags,
            "critical_flags": critical_flags,
            "high_flags": high_flags,
            "decision": decision.decision if decision else None,
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
    """Get full detail for a candidate."""
    result = await db.execute(select(CandidateSession).where(CandidateSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(404, "Session not found")

    # Get assessment title
    from src.models.assessment import Assessment
    assess_result = await db.execute(select(Assessment).where(Assessment.id == session.assessment_id))
    assessment = assess_result.scalar_one_or_none()

    # Code submissions
    sub_result = await db.execute(
        select(CodeSubmission).where(CodeSubmission.session_id == session_id).order_by(CodeSubmission.submitted_at.desc())
    )
    submissions = sub_result.scalars().all()

    # Get question titles for submissions
    from src.models.question import Question
    question_titles = {}
    for s in submissions:
        if s.question_id not in question_titles:
            q_result = await db.execute(select(Question.title).where(Question.id == s.question_id))
            row = q_result.first()
            question_titles[s.question_id] = row[0] if row else "Unknown"

    # Proctoring flags
    flag_result = await db.execute(
        select(ProctoringFlag).where(ProctoringFlag.session_id == session_id).order_by(ProctoringFlag.flagged_at)
    )
    flags = flag_result.scalars().all()

    # Interview responses
    resp_result = await db.execute(
        select(InterviewResponse).where(InterviewResponse.session_id == session_id)
    )
    responses = resp_result.scalars().all()

    # Decision
    dec_result = await db.execute(select(ReviewDecision).where(ReviewDecision.session_id == session_id))
    decision = dec_result.scalar_one_or_none()

    # Integrity score
    severity_weights = {"low": 1, "medium": 2, "high": 3, "critical": 5}
    severity_score = sum(severity_weights.get(f.severity, 1) for f in flags)
    integrity_score = max(0, 100 - severity_score * 2)

    return {
        "session_id": str(session.id),
        "candidate_email": session.candidate_email,
        "candidate_name": session.candidate_name,
        "status": session.status,
        "composite_score": session.composite_score,
        "assessment_title": assessment.title if assessment else "Unknown",
        "started_at": session.started_at.isoformat() if session.started_at else None,
        "submitted_at": session.submitted_at.isoformat() if session.submitted_at else None,
        "code_submissions": [
            {
                "id": str(s.id),
                "question_id": str(s.question_id),
                "question_title": question_titles.get(s.question_id, "Unknown"),
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
            "flags": [
                {"type": f.flag_type, "severity": f.severity, "description": f.description, "timestamp": f.flagged_at.isoformat()}
                for f in flags
            ],
        },
        "interview_responses": [
            {
                "id": str(r.id),
                "question_id": str(r.question_id),
                "filename": r.filename,
                "transcription": r.transcription,
                "ai_score": r.ai_score,
                "submitted_at": r.submitted_at.isoformat(),
            }
            for r in responses
        ],
        "decision": {
            "decision": decision.decision,
            "notes": decision.notes,
            "reviewer_email": decision.reviewer_email,
            "decided_at": decision.decided_at.isoformat(),
        } if decision else None,
    }


@router.post("/candidates/{session_id}/decision", status_code=status.HTTP_201_CREATED)
async def make_decision(
    session_id: UUID,
    payload: DecisionRequest,
    user: UserAccount = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Record a hiring decision for a candidate."""
    if payload.decision not in ("select", "reject", "hold"):
        raise HTTPException(400, "Decision must be: select, reject, or hold")

    result = await db.execute(select(CandidateSession).where(CandidateSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(404, "Session not found")

    decision = ReviewDecision(
        session_id=session_id,
        reviewer_id=user.id,
        reviewer_email=user.email,
        decision=payload.decision,
        notes=payload.notes,
    )
    db.add(decision)

    session.status = "reviewed"
    await db.flush()

    return {
        "session_id": str(session_id),
        "decision": decision.decision,
        "notes": decision.notes,
        "reviewer_email": decision.reviewer_email,
        "decided_at": decision.decided_at.isoformat(),
    }
