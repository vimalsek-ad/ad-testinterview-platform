"""Candidate Session & Code Execution API."""

import secrets
from uuid import UUID
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.auth.dependencies import get_current_user
from src.models.user import UserAccount
from src.models.assessment import Assessment, AssessmentQuestion, CandidateSession
from src.models.question import Question, TestCase
from src.models.submission import CodeSubmission
from src.execution.service import run_and_wait

router = APIRouter(prefix="/api/v1", tags=["sessions"])


# ─── Schemas ──────────────────────────────────────────────────

class AssessmentCreate(BaseModel):
    team_id: Optional[UUID] = None
    title: str
    description: Optional[str] = None
    total_time_limit_minutes: int = 60
    question_ids: list[UUID] = []


class CandidateAssign(BaseModel):
    candidate_email: str
    candidate_name: Optional[str] = None


class ExecuteCodeRequest(BaseModel):
    question_id: UUID
    source_code: str
    language: str = "python"


class SubmitCodeRequest(BaseModel):
    question_id: UUID
    source_code: str
    language: str = "python"


# ─── Assessment Endpoints ─────────────────────────────────────

@router.post("/assessments", status_code=status.HTTP_201_CREATED)
async def create_assessment(
    payload: AssessmentCreate,
    user: UserAccount = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create an assessment and link questions to it."""
    assessment = Assessment(
        team_id=payload.team_id,
        created_by=user.id,
        title=payload.title,
        description=payload.description,
        total_time_limit_minutes=payload.total_time_limit_minutes,
        status="published",
    )
    db.add(assessment)
    await db.flush()

    # Link questions
    for idx, qid in enumerate(payload.question_ids):
        db.add(AssessmentQuestion(
            assessment_id=assessment.id,
            question_id=qid,
            order_index=idx,
            weight=1.0,
        ))

    await db.flush()
    return {"id": str(assessment.id), "title": assessment.title, "status": "published"}


@router.post("/assessments/{assessment_id}/assign", status_code=status.HTTP_201_CREATED)
async def assign_candidate(
    assessment_id: UUID,
    payload: CandidateAssign,
    user: UserAccount = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Assign a candidate to an assessment — generates a unique session token."""
    token = secrets.token_urlsafe(32)
    session = CandidateSession(
        assessment_id=assessment_id,
        candidate_email=payload.candidate_email,
        candidate_name=payload.candidate_name,
        session_token=token,
        status="invited",
    )
    db.add(session)
    await db.flush()
    return {
        "session_id": str(session.id),
        "session_token": token,
        "link": f"http://localhost:5173/assessment/{token}",
    }


# ─── Candidate Session Endpoints ─────────────────────────────

@router.get("/sessions/{session_token}")
async def start_session(session_token: str, db: AsyncSession = Depends(get_db)):
    """Candidate opens their assessment — returns questions (no auth required, token is the auth)."""
    result = await db.execute(
        select(CandidateSession).where(CandidateSession.session_token == session_token)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(404, "Session not found or expired")

    # Mark as started
    if session.status == "invited":
        session.status = "in_progress"
        session.started_at = datetime.utcnow()

    # Get assessment
    assess_result = await db.execute(select(Assessment).where(Assessment.id == session.assessment_id))
    assessment = assess_result.scalar_one()

    # Get questions
    aq_result = await db.execute(
        select(AssessmentQuestion)
        .where(AssessmentQuestion.assessment_id == assessment.id)
        .order_by(AssessmentQuestion.order_index)
    )
    assessment_questions = aq_result.scalars().all()

    questions = []
    for aq in assessment_questions:
        q_result = await db.execute(select(Question).where(Question.id == aq.question_id))
        q = q_result.scalar_one()

        # Get visible test cases only
        tc_result = await db.execute(
            select(TestCase)
            .where(TestCase.question_id == q.id, TestCase.is_hidden == False)
            .order_by(TestCase.order_index)
        )
        visible_tests = tc_result.scalars().all()

        questions.append({
            "id": str(q.id),
            "title": q.title,
            "description": q.description,
            "difficulty": q.difficulty,
            "supported_languages": q.supported_languages,
            "test_cases": [
                {"input": tc.input_data, "expected_output": tc.expected_output}
                for tc in visible_tests
            ],
        })

    await db.commit()
    return {
        "session_id": str(session.id),
        "assessment_title": assessment.title,
        "time_limit_minutes": assessment.total_time_limit_minutes,
        "status": session.status,
        "started_at": session.started_at.isoformat() if session.started_at else None,
        "questions": questions,
    }


@router.post("/sessions/{session_id}/execute")
async def execute_code(
    session_id: UUID,
    payload: ExecuteCodeRequest,
    db: AsyncSession = Depends(get_db),
):
    """Run candidate's code against VISIBLE test cases only (the 'Run' button)."""
    # Get visible test cases
    tc_result = await db.execute(
        select(TestCase)
        .where(TestCase.question_id == payload.question_id, TestCase.is_hidden == False)
        .order_by(TestCase.order_index)
    )
    test_cases = tc_result.scalars().all()

    if not test_cases:
        raise HTTPException(400, "No test cases found for this question")

    # Run against each visible test case
    results = []
    for tc in test_cases:
        result = await run_and_wait(
            source_code=payload.source_code,
            language=payload.language,
            stdin=tc.input_data,
            expected_output=tc.expected_output,
        )
        results.append({
            "test_case_index": tc.order_index,
            "passed": result["passed"],
            "status": result["status"],
            "stdout": result["stdout"],
            "time": result.get("time"),
            "memory": result.get("memory"),
        })

    return {
        "results": results,
        "passed": sum(1 for r in results if r["passed"]),
        "total": len(results),
    }


@router.post("/sessions/{session_id}/submit")
async def submit_code(
    session_id: UUID,
    payload: SubmitCodeRequest,
    db: AsyncSession = Depends(get_db),
):
    """Final submission — runs against ALL test cases (visible + hidden) and scores."""
    # Get ALL test cases
    tc_result = await db.execute(
        select(TestCase)
        .where(TestCase.question_id == payload.question_id)
        .order_by(TestCase.order_index)
    )
    test_cases = tc_result.scalars().all()

    # Run against all test cases
    results = []
    for tc in test_cases:
        result = await run_and_wait(
            source_code=payload.source_code,
            language=payload.language,
            stdin=tc.input_data,
            expected_output=tc.expected_output,
        )
        results.append({
            "test_case_index": tc.order_index,
            "passed": result["passed"],
            "status": result["status"],
            "is_hidden": tc.is_hidden,
            "time": result.get("time"),
            "memory": result.get("memory"),
        })

    passed = sum(1 for r in results if r["passed"])
    total = len(results)
    score = (passed / total * 100) if total > 0 else 0

    # Save submission
    submission = CodeSubmission(
        session_id=session_id,
        question_id=payload.question_id,
        source_code=payload.source_code,
        language=payload.language,
        is_final=True,
        status="completed",
        score=score,
        tests_passed=passed,
        tests_total=total,
        test_results={"results": results},
    )
    db.add(submission)

    # Update session
    session_result = await db.execute(select(CandidateSession).where(CandidateSession.id == session_id))
    session = session_result.scalar_one_or_none()
    if session:
        session.status = "submitted"
        session.submitted_at = datetime.utcnow()
        session.composite_score = score

    await db.flush()

    return {
        "submission_id": str(submission.id),
        "score": score,
        "passed": passed,
        "total": total,
        "results": results,
    }
