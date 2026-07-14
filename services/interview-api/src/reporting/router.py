"""Reporting & Analytics API — aggregate stats on assessments, candidates, scores."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.auth.dependencies import get_current_user
from src.models.user import UserAccount
from src.models.assessment import Assessment, CandidateSession
from src.models.submission import CodeSubmission
from src.models.question import Question
from src.models.proctoring import ProctoringFlag
from src.models.review import ReviewDecision

router = APIRouter(prefix="/api/v1/admin/analytics", tags=["reporting"])


@router.get("/overview")
async def get_overview(
    user: UserAccount = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Platform-wide analytics overview."""
    from src.models.team import TeamMembership

    # For non-admins, scope to their teams
    team_filter_assessment_ids = None
    user_team_ids = []
    if not user.is_platform_admin:
        user_teams_stmt = select(TeamMembership.team_id).where(TeamMembership.user_id == user.id)
        user_teams_result = await db.execute(user_teams_stmt)
        user_team_ids = [row[0] for row in user_teams_result.all()]
        
        if user_team_ids:
            team_assessments = await db.execute(
                select(Assessment.id).where(
                    or_(Assessment.team_id.in_(user_team_ids), Assessment.created_by == user.id)
                )
            )
            team_filter_assessment_ids = [row[0] for row in team_assessments.all()]
        else:
            team_assessments = await db.execute(
                select(Assessment.id).where(Assessment.created_by == user.id)
            )
            team_filter_assessment_ids = [row[0] for row in team_assessments.all()]

    # Total counts — scoped to team
    users_result = await db.execute(select(func.count(UserAccount.id)))
    total_users = users_result.scalar() or 0

    # Questions count — scoped to team
    if not user.is_platform_admin and user_team_ids:
        questions_result = await db.execute(
            select(func.count(Question.id)).where(
                or_(Question.team_id.in_(user_team_ids), Question.created_by == user.id)
            )
        )
    else:
        questions_result = await db.execute(select(func.count(Question.id)))
    total_questions = questions_result.scalar() or 0

    # Assessments count — scoped to team
    if team_filter_assessment_ids is not None:
        total_assessments = len(team_filter_assessment_ids)
    else:
        assessments_result = await db.execute(select(func.count(Assessment.id)))
        total_assessments = assessments_result.scalar() or 0

    # Sessions (scoped)
    if team_filter_assessment_ids is not None:
        sessions_stmt = select(func.count(CandidateSession.id)).where(
            CandidateSession.assessment_id.in_(team_filter_assessment_ids)
        )
    else:
        sessions_stmt = select(func.count(CandidateSession.id))
    sessions_result = await db.execute(sessions_stmt)
    total_sessions = sessions_result.scalar() or 0

    submissions_result = await db.execute(select(func.count(CodeSubmission.id)))
    total_submissions = submissions_result.scalar() or 0

    # Sessions by status
    if team_filter_assessment_ids is not None:
        status_result = await db.execute(
            select(CandidateSession.status, func.count(CandidateSession.id))
            .where(CandidateSession.assessment_id.in_(team_filter_assessment_ids))
            .group_by(CandidateSession.status)
        )
    else:
        status_result = await db.execute(
            select(CandidateSession.status, func.count(CandidateSession.id))
            .group_by(CandidateSession.status)
        )
    status_counts = {row[0]: row[1] for row in status_result.all()}

    # Average score — scoped to team
    if team_filter_assessment_ids is not None:
        avg_result = await db.execute(
            select(func.avg(CandidateSession.composite_score))
            .where(
                CandidateSession.composite_score.isnot(None),
                CandidateSession.assessment_id.in_(team_filter_assessment_ids),
            )
        )
    else:
        avg_result = await db.execute(
            select(func.avg(CandidateSession.composite_score))
            .where(CandidateSession.composite_score.isnot(None))
        )
    avg_score = avg_result.scalar()

    # Decision counts — scoped to team's candidates
    if team_filter_assessment_ids is not None:
        # Get session IDs for team's candidates
        team_session_ids_result = await db.execute(
            select(CandidateSession.id).where(
                CandidateSession.assessment_id.in_(team_filter_assessment_ids)
            )
        )
        team_session_ids = [row[0] for row in team_session_ids_result.all()]

        if team_session_ids:
            dec_result = await db.execute(
                select(ReviewDecision.decision, func.count(ReviewDecision.id))
                .where(ReviewDecision.session_id.in_(team_session_ids))
                .group_by(ReviewDecision.decision)
            )
        else:
            dec_result = await db.execute(
                select(ReviewDecision.decision, func.count(ReviewDecision.id))
                .where(ReviewDecision.id == None)  # return empty
            )
    else:
        dec_result = await db.execute(
            select(ReviewDecision.decision, func.count(ReviewDecision.id))
            .group_by(ReviewDecision.decision)
        )

    decision_counts = {"select": 0, "reject": 0, "hold": 0, "pending_review": 0}
    for row in dec_result.all():
        decision_counts[row[0]] = row[1]

    # Count candidates with no review decision yet (submitted/in_progress but not reviewed)
    if team_filter_assessment_ids is not None:
        submitted_sessions_stmt = (
            select(CandidateSession.id)
            .where(
                CandidateSession.assessment_id.in_(team_filter_assessment_ids),
                CandidateSession.status.in_(["submitted", "in_progress", "scored"]),
            )
        )
    else:
        submitted_sessions_stmt = (
            select(CandidateSession.id)
            .where(CandidateSession.status.in_(["submitted", "in_progress", "scored"]))
        )
    submitted_ids_result = await db.execute(submitted_sessions_stmt)
    submitted_session_ids = [row[0] for row in submitted_ids_result.all()]

    # Count how many of those have a review decision
    if submitted_session_ids:
        reviewed_of_submitted = await db.execute(
            select(func.count(ReviewDecision.id))
            .where(ReviewDecision.session_id.in_(submitted_session_ids))
        )
        reviewed_count = reviewed_of_submitted.scalar() or 0
    else:
        reviewed_count = 0

    decision_counts["pending_review"] = max(0, len(submitted_session_ids) - reviewed_count)

    # Proctoring stats — scoped to team's sessions
    if team_filter_assessment_ids is not None and team_session_ids:
        total_flags_result = await db.execute(
            select(func.count(ProctoringFlag.id)).where(ProctoringFlag.session_id.in_(team_session_ids))
        )
        total_flags = total_flags_result.scalar() or 0

        sessions_with_flags_result = await db.execute(
            select(func.count(func.distinct(ProctoringFlag.session_id)))
            .where(ProctoringFlag.session_id.in_(team_session_ids))
        )
        sessions_with_flags = sessions_with_flags_result.scalar() or 0
    else:
        total_flags_result = await db.execute(select(func.count(ProctoringFlag.id)))
        total_flags = total_flags_result.scalar() or 0

        sessions_with_flags_result = await db.execute(
            select(func.count(func.distinct(ProctoringFlag.session_id)))
        )
        sessions_with_flags = sessions_with_flags_result.scalar() or 0

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
    db: AsyncSession = Depends(get_db),
):
    """Proctoring flag statistics from PostgreSQL."""
    result = await db.execute(select(ProctoringFlag))
    all_flags = result.scalars().all()

    if not all_flags:
        return {"total_flags": 0, "by_type": {}, "by_severity": {}}

    by_type: dict[str, int] = {}
    by_severity: dict[str, int] = {}
    for f in all_flags:
        by_type[f.flag_type] = by_type.get(f.flag_type, 0) + 1
        by_severity[f.severity] = by_severity.get(f.severity, 0) + 1

    by_type = dict(sorted(by_type.items(), key=lambda x: x[1], reverse=True))
    by_severity = dict(sorted(by_severity.items(), key=lambda x: x[1], reverse=True))

    return {
        "total_flags": len(all_flags),
        "by_type": by_type,
        "by_severity": by_severity,
        "most_common": list(by_type.keys())[0] if by_type else None,
    }


@router.get("/candidates")
async def get_all_candidates(
    user: UserAccount = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all candidates with full session details, timing, and scores."""
    from src.models.team import TeamMembership
    from src.models.interview_response import InterviewResponse

    # Scope to user's teams
    if not user.is_platform_admin:
        user_teams_stmt = select(TeamMembership.team_id).where(TeamMembership.user_id == user.id)
        user_teams_result = await db.execute(user_teams_stmt)
        user_team_ids = [row[0] for row in user_teams_result.all()]

        if user_team_ids:
            assessment_ids_result = await db.execute(
                select(Assessment.id).where(
                    or_(Assessment.team_id.in_(user_team_ids), Assessment.created_by == user.id)
                )
            )
        else:
            assessment_ids_result = await db.execute(
                select(Assessment.id).where(Assessment.created_by == user.id)
            )
        valid_assessment_ids = [row[0] for row in assessment_ids_result.all()]

        sessions_result = await db.execute(
            select(CandidateSession)
            .where(CandidateSession.assessment_id.in_(valid_assessment_ids))
            .order_by(CandidateSession.created_at.desc())
        )
    else:
        sessions_result = await db.execute(
            select(CandidateSession).order_by(CandidateSession.created_at.desc())
        )

    sessions = sessions_result.scalars().all()
    candidates = []

    for session in sessions:
        # Get assessment title
        assess_result = await db.execute(select(Assessment).where(Assessment.id == session.assessment_id))
        assessment = assess_result.scalar_one_or_none()

        # Get code submissions with timestamps
        subs_result = await db.execute(
            select(CodeSubmission)
            .where(CodeSubmission.session_id == session.id)
            .order_by(CodeSubmission.submitted_at)
        )
        submissions = subs_result.scalars().all()

        # Get interview responses
        resp_result = await db.execute(
            select(InterviewResponse).where(InterviewResponse.session_id == session.id)
        )
        responses = resp_result.scalars().all()

        # Get proctoring flag count
        flags_result = await db.execute(
            select(func.count(ProctoringFlag.id)).where(ProctoringFlag.session_id == session.id)
        )
        flag_count = flags_result.scalar() or 0

        # Get decision
        dec_result = await db.execute(
            select(ReviewDecision).where(ReviewDecision.session_id == session.id)
        )
        decision = dec_result.scalar_one_or_none()

        # Calculate time spent
        time_spent_minutes = None
        if session.started_at and session.submitted_at:
            delta = session.submitted_at - session.started_at
            time_spent_minutes = round(delta.total_seconds() / 60, 1)

        candidates.append({
            "session_id": str(session.id),
            "candidate_name": session.candidate_name or session.candidate_email.split("@")[0],
            "candidate_email": session.candidate_email,
            "assessment_id": str(session.assessment_id),
            "assessment_title": assessment.title if assessment else "Unknown",
            "status": session.status,
            "score": session.composite_score,
            "started_at": session.started_at.isoformat() if session.started_at else None,
            "submitted_at": session.submitted_at.isoformat() if session.submitted_at else None,
            "time_spent_minutes": time_spent_minutes,
            "flag_count": flag_count,
            "decision": decision.decision if decision else None,
            "code_submissions": [
                {
                    "question_id": str(s.question_id),
                    "language": s.language,
                    "score": s.score,
                    "tests_passed": s.tests_passed,
                    "tests_total": s.tests_total,
                    "submitted_at": s.submitted_at.isoformat(),
                }
                for s in submissions
            ],
            "interview_responses": [
                {
                    "question_id": str(r.question_id),
                    "transcription": r.transcription,
                    "ai_score": r.ai_score,
                    "submitted_at": r.submitted_at.isoformat(),
                }
                for r in responses
            ],
        })

    return {"total": len(candidates), "candidates": candidates}
