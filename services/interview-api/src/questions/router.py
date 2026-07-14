"""Question Bank API — CRUD for coding questions and test cases."""

from uuid import UUID
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.auth.dependencies import get_current_user
from src.models.user import UserAccount
from src.models.question import Question, TestCase
from src.models.team import Team

router = APIRouter(prefix="/api/v1", tags=["questions"])


# ─── Schemas ──────────────────────────────────────────────────

class QuestionCreate(BaseModel):
    team_id: Optional[UUID] = None
    type: str = "coding"
    title: str
    description: str
    difficulty: str = "medium"
    tags: list[str] = []
    supported_languages: list[str] = ["python"]
    reference_solution: Optional[str] = None


class TestCaseCreate(BaseModel):
    input_data: str
    expected_output: str
    time_limit_ms: int = 2000
    memory_limit_mb: int = 128
    is_hidden: bool = False


class QuestionResponse(BaseModel):
    id: str
    title: str
    type: str
    difficulty: str
    tags: list[str]
    supported_languages: list[str]
    description: str

    class Config:
        from_attributes = True


class TestCaseResponse(BaseModel):
    id: str
    input_data: str
    expected_output: str
    time_limit_ms: int
    memory_limit_mb: int
    is_hidden: bool
    order_index: int

    class Config:
        from_attributes = True


# ─── Endpoints ────────────────────────────────────────────────

@router.post("/questions", status_code=status.HTTP_201_CREATED)
async def create_question(
    payload: QuestionCreate,
    user: UserAccount = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new coding or interview question. Auto-assigns to user's team if not specified."""
    from src.models.team import TeamMembership

    team_id = payload.team_id
    # If no team_id provided, auto-assign to user's first team
    if not team_id and not user.is_platform_admin:
        user_teams_result = await db.execute(
            select(TeamMembership.team_id).where(TeamMembership.user_id == user.id)
        )
        first_team = user_teams_result.first()
        if first_team:
            team_id = first_team[0]

    question = Question(
        team_id=team_id,
        created_by=user.id,
        type=payload.type,
        title=payload.title,
        description=payload.description,
        difficulty=payload.difficulty,
        tags=payload.tags,
        supported_languages=payload.supported_languages,
        reference_solution=payload.reference_solution,
    )
    db.add(question)
    await db.flush()
    return {"id": str(question.id), "title": question.title}


@router.get("/questions")
async def list_questions(
    team_id: Optional[UUID] = None,
    user: UserAccount = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List questions filtered by team membership. Platform admins see all."""
    from sqlalchemy import or_
    from src.models.team import TeamMembership

    stmt = select(Question).where(Question.is_active == True)

    if team_id:
        # Explicit team filter — use it directly
        stmt = stmt.where(Question.team_id == team_id)
    elif not user.is_platform_admin:
        # Non-admin users see:
        # 1. Questions belonging to their teams
        # 2. Questions they personally created (regardless of team_id)
        user_teams_stmt = select(TeamMembership.team_id).where(
            TeamMembership.user_id == user.id
        )
        user_teams_result = await db.execute(user_teams_stmt)
        user_team_ids = [row[0] for row in user_teams_result.all()]

        conditions = [Question.created_by == user.id]
        if user_team_ids:
            conditions.append(Question.team_id.in_(user_team_ids))

        stmt = stmt.where(or_(*conditions))

    result = await db.execute(stmt)
    questions = result.scalars().all()
    return [
        QuestionResponse(
            id=str(q.id), title=q.title, type=q.type,
            difficulty=q.difficulty, tags=q.tags,
            supported_languages=q.supported_languages,
            description=q.description,
        )
        for q in questions
    ]


@router.get("/questions/{question_id}")
async def get_question(
    question_id: UUID,
    user: UserAccount = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a question with its test cases."""
    result = await db.execute(select(Question).where(Question.id == question_id))
    question = result.scalar_one_or_none()
    if not question:
        raise HTTPException(404, "Question not found")

    tc_result = await db.execute(
        select(TestCase).where(TestCase.question_id == question_id).order_by(TestCase.order_index)
    )
    test_cases = tc_result.scalars().all()

    return {
        "id": str(question.id),
        "title": question.title,
        "type": question.type,
        "description": question.description,
        "difficulty": question.difficulty,
        "tags": question.tags,
        "supported_languages": question.supported_languages,
        "test_cases": [
            TestCaseResponse(
                id=str(tc.id), input_data=tc.input_data,
                expected_output=tc.expected_output,
                time_limit_ms=tc.time_limit_ms,
                memory_limit_mb=tc.memory_limit_mb,
                is_hidden=tc.is_hidden, order_index=tc.order_index,
            )
            for tc in test_cases
        ],
    }


@router.post("/questions/{question_id}/test-cases", status_code=status.HTTP_201_CREATED)
async def add_test_case(
    question_id: UUID,
    payload: TestCaseCreate,
    user: UserAccount = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a test case to a question."""
    # Verify question exists
    result = await db.execute(select(Question).where(Question.id == question_id))
    if not result.scalar_one_or_none():
        raise HTTPException(404, "Question not found")

    # Get current count for order_index
    count_result = await db.execute(
        select(TestCase).where(TestCase.question_id == question_id)
    )
    current_count = len(count_result.scalars().all())

    tc = TestCase(
        question_id=question_id,
        input_data=payload.input_data,
        expected_output=payload.expected_output,
        time_limit_ms=payload.time_limit_ms,
        memory_limit_mb=payload.memory_limit_mb,
        is_hidden=payload.is_hidden,
        order_index=current_count,
    )
    db.add(tc)
    await db.flush()
    return {"id": str(tc.id), "order_index": tc.order_index}
