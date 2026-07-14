"""Notifications API — stored in PostgreSQL."""

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.auth.dependencies import get_current_user
from src.models.user import UserAccount
from src.models.notification import Notification

router = APIRouter(prefix="/api/v1/notifications", tags=["notifications"])


class SendInviteRequest(BaseModel):
    candidate_email: str
    candidate_name: str | None = None
    assessment_title: str
    assessment_link: str
    time_limit_minutes: int
    deadline: str | None = None


class SendReminderRequest(BaseModel):
    candidate_email: str
    assessment_title: str
    assessment_link: str
    hours_remaining: int


@router.post("/send-invite", status_code=status.HTTP_201_CREATED)
async def send_invite(
    payload: SendInviteRequest,
    user: UserAccount = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Send assessment invitation — stored in PostgreSQL."""
    body = f"""Hi {payload.candidate_name or 'Candidate'},

You've been invited to complete a technical assessment for Alter Domus.

Assessment: {payload.assessment_title}
Duration: {payload.time_limit_minutes} minutes
{"Deadline: " + payload.deadline if payload.deadline else ""}

Start your assessment here:
{payload.assessment_link}

Good luck!
— Alter Domus Hiring Team"""

    notification = Notification(
        type="assessment_invitation",
        to_email=payload.candidate_email,
        subject=f"You've been invited to: {payload.assessment_title}",
        body=body,
        status="logged",
        sent_by=user.email,
    )
    db.add(notification)
    await db.flush()

    return {"message": "Invitation logged", "notification_id": str(notification.id)}


@router.post("/send-reminder", status_code=status.HTTP_201_CREATED)
async def send_reminder(
    payload: SendReminderRequest,
    user: UserAccount = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Send deadline reminder — stored in PostgreSQL."""
    notification = Notification(
        type="deadline_reminder",
        to_email=payload.candidate_email,
        subject=f"Reminder: {payload.assessment_title} — {payload.hours_remaining}h remaining",
        body=f"Your assessment '{payload.assessment_title}' expires in {payload.hours_remaining} hours. Start here: {payload.assessment_link}",
        status="logged",
        sent_by=user.email,
    )
    db.add(notification)
    await db.flush()

    return {"message": "Reminder logged", "notification_id": str(notification.id)}


@router.get("/")
async def list_notifications(
    user: UserAccount = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all sent notifications."""
    result = await db.execute(select(Notification).order_by(desc(Notification.created_at)).limit(50))
    notifications = result.scalars().all()

    return {
        "total": len(notifications),
        "notifications": [
            {
                "id": str(n.id),
                "type": n.type,
                "to": n.to_email,
                "subject": n.subject,
                "status": n.status,
                "sent_by": n.sent_by,
                "created_at": n.created_at.isoformat(),
            }
            for n in notifications
        ],
    }
