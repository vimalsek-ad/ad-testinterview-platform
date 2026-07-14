"""Reporting & Analytics API — aggregate stats on assessments, candidates, scores."""

from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.auth.dependencies import get_current_user
from src.models.user import UserAccount
from src.models.assessment import Assessment, CandidateSession
from src.models.submission import CodeSubmission
from src.models.question import Question
from src.proctoring.router import _flag_store
from src.reviews.router import _decisions

router = APIRouter(prefix="/api/v1/admin/analytics", tags=["reporting"])


@router.get("/overview")
async def get_overview(
    user: UserAccount = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Platform-wide analytics overview."""
    # Total counts
    users_result = await db.execute(select(func.count(UserAccount.id)))
    total_users = users_result.scalar() or 0

    questions_result = await db.execute(select(func.count(Question.id)))
    total_questions = questions_result.scalar() or 0

    assessments_result = await db.execute(select(func.count(Assessment.id)))
    total_assessments = assessments_result.scalar() or 0

    sessions_result = await db.execute(select(func.count(CandidateSession.id)))
    total_sessions = sessions_result.scalar() or 0

    submissions_result = await db.execute(select(func.count(CodeSubmission.id)))
    total_submissions = submissions_result.scalar() or 0

    # Sessions by status
    status_result = await db.execute(
        select(CandidateSession.status, func.count(CandidateSession.id))
        .group_by(CandidateSession.status)
    )
    status_counts = {row[0]: row[1] for row in status_result.all()}

    # Average score
    avg_result = await db.execute(
        select(func.avg(CandidateSession.composite_score))
        .where(CandidateSession.composite_score.isnot(None))
    )
    avg_score = avg_result.scalar()

    # Decision counts
    decisions = list(_decisions.values())
    decision_counts = {
        "select": sum(1 for d in decisions if d.get("decision") == "select"),
        "reject": sum(1 for d in decisions if d.get("decision") == "reject"),
        "hold": sum(1 for d in decisions if d.get("decision") == "hold"),
    }

    # Proctoring stats
    total_flags = sum(len(flags) for flags in _flag_store.values())
    sessions_with_flags = sum(1 for flags in _flag_store.values() if len(flags) > 0)

    return {
        "platform": {
            "total_users": total_users,
            "total_questions": total_questions,
            "total_assessments": total_assessments,
            "total_sessions": total_sessions,
            "total_submissions": total_submissions,
        },
        "sessions_by_status": status_counts,
        "scoring": {
            "average_score": round(avg_score, 1) if avg_score else None,
            "completion_rate": round(
                status_counts.get("submitted", 0) / max(total_sessions, 1) * 100, 1
            ),
        },
        "decisions": decision_counts,
        "proctoring": {
            "total_flags": total_flags,
            "sessions_with_flags": sessions_with_flags,
            "clean_sessions": total_sessions - sessions_with_flags if total_sessions else 0,
        },
    }


@router.get("/scores")
async def get_score_distribution(
    user: UserAccount = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Score distribution across all candidates."""
    result = await db.execute(
        select(CandidateSession.composite_score)
        .where(CandidateSession.composite_score.isnot(None))
    )
    scores = [row[0] for row in result.all()]

    if not scores:
        return {"total": 0, "distribution": {}, "stats": {}}

    # Create distribution buckets
    buckets = {"0-20": 0, "21-40": 0, "41-60": 0, "61-80": 0, "81-100": 0}
    for score in scores:
        if score <= 20: buckets["0-20"] += 1
        elif score <= 40: buckets["21-40"] += 1
        elif score <= 60: buckets["41-60"] += 1
        elif score <= 80: buckets["61-80"] += 1
        else: buckets["81-100"] += 1

    return {
        "total": len(scores),
        "distribution": buckets,
        "stats": {
            "min": round(min(scores), 1),
            "max": round(max(scores), 1),
            "average": round(sum(scores) / len(scores), 1),
            "median": round(sorted(scores)[len(scores) // 2], 1),
        },
    }


@router.get("/proctoring-stats")
async def get_proctoring_stats(
    user: UserAccount = Depends(get_current_user),
):
    """Proctoring flag statistics."""
    all_flags = []
    for flags in _flag_store.values():
        all_flags.extend(flags)

    if not all_flags:
        return {"total_flags": 0, "by_type": {}, "by_severity": {}}

    by_type: dict[str, int] = {}
    by_severity: dict[str, int] = {}
    for f in all_flags:
        ftype = f.get("type", "unknown")
        severity = f.get("severity", "unknown")
        by_type[ftype] = by_type.get(ftype, 0) + 1
        by_severity[severity] = by_severity.get(severity, 0) + 1

    # Sort by count descending
    by_type = dict(sorted(by_type.items(), key=lambda x: x[1], reverse=True))
    by_severity = dict(sorted(by_severity.items(), key=lambda x: x[1], reverse=True))

    return {
        "total_flags": len(all_flags),
        "by_type": by_type,
        "by_severity": by_severity,
        "most_common": list(by_type.keys())[0] if by_type else None,
    }
