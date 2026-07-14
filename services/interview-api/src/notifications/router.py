"""Notifications API — send assessment invitations and reminders.

For prototype: logs notifications (no actual email sending).
Production: integrate with SMTP/SES.
"""

from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel

from src.auth.dependencies import get_current_user
from src.models.user import UserAccount

router = APIRouter(prefix="/api/v1/notifications", tags=["notifications"])

# In-memory notification log for prototype
_notification_log: list[dict] = []


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
async def send_invite(payload: SendInviteRequest, user: UserAccount = Depends(get_current_user)):
    """Send assessment invitation email to candidate.
    
    Prototype: logs the notification. Production: sends via SMTP/SES.
    """
    notification = {
        "id": str(len(_notification_log) + 1),
        "type": "assessment_invitation",
        "to": payload.candidate_email,
        "subject": f"You've been invited to: {payload.assessment_title}",
        "body": f"""Hi {payload.candidate_name or 'Candidate'},

You've been invited to complete a technical assessment for Alter Domus.

Assessment: {payload.assessment_title}
Duration: {payload.time_limit_minutes} minutes
{"Deadline: " + payload.deadline if payload.deadline else ""}

Start your assessment here:
{payload.assessment_link}

Please ensure you have:
- A quiet environment
- Working webcam and microphone (for proctoring)
- Stable internet connection

Good luck!
— Alter Domus Hiring Team""",
        "status": "logged",  # "sent" in production
        "sent_by": user.email,
        "created_at": datetime.utcnow().isoformat(),
    }
    _notification_log.append(notification)

    return {"message": "Invitation logged (email delivery disabled in prototype)", "notification_id": notification["id"]}


@router.post("/send-reminder", status_code=status.HTTP_201_CREATED)
async def send_reminder(payload: SendReminderRequest, user: UserAccount = Depends(get_current_user)):
    """Send deadline reminder to candidate."""
    notification = {
        "id": str(len(_notification_log) + 1),
        "type": "deadline_reminder",
        "to": payload.candidate_email,
        "subject": f"Reminder: {payload.assessment_title} — {payload.hours_remaining}h remaining",
        "body": f"Your assessment '{payload.assessment_title}' expires in {payload.hours_remaining} hours. Start here: {payload.assessment_link}",
        "status": "logged",
        "sent_by": user.email,
        "created_at": datetime.utcnow().isoformat(),
    }
    _notification_log.append(notification)

    return {"message": "Reminder logged", "notification_id": notification["id"]}


@router.get("/")
async def list_notifications(user: UserAccount = Depends(get_current_user)):
    """List all sent notifications."""
    return {"total": len(_notification_log), "notifications": _notification_log[-50:]}
