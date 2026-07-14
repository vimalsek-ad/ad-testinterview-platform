"""Team Management API — create teams, add/remove members, assign roles."""

from uuid import UUID
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.auth.dependencies import get_current_user
from src.models.user import UserAccount
from src.models.team import Team, TeamMembership

router = APIRouter(prefix="/api/v1/teams", tags=["teams"])


# ─── Schemas ──────────────────────────────────────────────────

class TeamCreate(BaseModel):
    name: str
    description: Optional[str] = None


class TeamResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    member_count: int = 0


class AddMemberRequest(BaseModel):
    email: str
    role: str = "interviewer"  # team_lead | interviewer


class MemberResponse(BaseModel):
    id: str
    user_id: str
    email: str
    display_name: str
    role: str


# ─── Endpoints ────────────────────────────────────────────────

@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_team(
    payload: TeamCreate,
    user: UserAccount = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new team. Only Platform Admins can create teams."""
    if not user.is_platform_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only Platform Admins can create teams")

    # Check if team name already exists
    existing = await db.execute(select(Team).where(Team.name == payload.name))
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Team name already exists")

    team = Team(name=payload.name, description=payload.description)
    db.add(team)
    await db.flush()

    # Add creator as team_lead
    membership = TeamMembership(team_id=team.id, user_id=user.id, role="team_lead")
    db.add(membership)
    await db.flush()

    return {"id": str(team.id), "name": team.name, "description": team.description}


@router.get("/")
async def list_teams(
    user: UserAccount = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List teams. Platform admins see all, others see only their teams."""
    if user.is_platform_admin:
        result = await db.execute(select(Team))
    else:
        result = await db.execute(
            select(Team)
            .join(TeamMembership, TeamMembership.team_id == Team.id)
            .where(TeamMembership.user_id == user.id)
        )

    teams = result.scalars().all()
    response = []
    for team in teams:
        count_result = await db.execute(
            select(TeamMembership).where(TeamMembership.team_id == team.id)
        )
        count = len(count_result.scalars().all())
        response.append(TeamResponse(
            id=str(team.id), name=team.name,
            description=team.description, member_count=count
        ))
    return response


@router.get("/{team_id}")
async def get_team(
    team_id: UUID,
    user: UserAccount = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get team details with members."""
    result = await db.execute(select(Team).where(Team.id == team_id))
    team = result.scalar_one_or_none()
    if not team:
        raise HTTPException(404, "Team not found")

    # Get members
    members_result = await db.execute(
        select(TeamMembership, UserAccount)
        .join(UserAccount, UserAccount.id == TeamMembership.user_id)
        .where(TeamMembership.team_id == team_id)
    )
    members = [
        MemberResponse(
            id=str(m.TeamMembership.id),
            user_id=str(m.UserAccount.id),
            email=m.UserAccount.email,
            display_name=m.UserAccount.display_name,
            role=m.TeamMembership.role,
        )
        for m in members_result.all()
    ]

    return {
        "id": str(team.id),
        "name": team.name,
        "description": team.description,
        "members": members,
    }


@router.post("/{team_id}/members", status_code=status.HTTP_201_CREATED)
async def add_member(
    team_id: UUID,
    payload: AddMemberRequest,
    user: UserAccount = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a user to the team by email."""
    # Find user by email
    user_result = await db.execute(select(UserAccount).where(UserAccount.email == payload.email))
    target_user = user_result.scalar_one_or_none()
    if not target_user:
        raise HTTPException(404, f"User with email '{payload.email}' not found. They must register first.")

    # Check if already a member
    existing = await db.execute(
        select(TeamMembership).where(
            TeamMembership.team_id == team_id,
            TeamMembership.user_id == target_user.id
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(400, "User is already a member of this team")

    membership = TeamMembership(team_id=team_id, user_id=target_user.id, role=payload.role)
    db.add(membership)
    await db.flush()

    return {"message": f"Added {payload.email} as {payload.role}", "membership_id": str(membership.id)}


@router.delete("/{team_id}/members/{user_id}", status_code=status.HTTP_200_OK)
async def remove_member(
    team_id: UUID,
    user_id: UUID,
    user: UserAccount = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a member from the team."""
    result = await db.execute(
        select(TeamMembership).where(
            TeamMembership.team_id == team_id,
            TeamMembership.user_id == user_id
        )
    )
    membership = result.scalar_one_or_none()
    if not membership:
        raise HTTPException(404, "Membership not found")

    await db.delete(membership)
    return {"message": "Member removed"}


@router.delete("/{team_id}", status_code=status.HTTP_200_OK)
async def delete_team(
    team_id: UUID,
    user: UserAccount = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a team. Only Platform Admins can delete teams."""
    if not user.is_platform_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only Platform Admins can delete teams")

    result = await db.execute(select(Team).where(Team.id == team_id))
    team = result.scalar_one_or_none()
    if not team:
        raise HTTPException(404, "Team not found")

    # Delete all memberships first (CASCADE should handle this, but be explicit)
    await db.execute(
        select(TeamMembership).where(TeamMembership.team_id == team_id)
    )
    await db.delete(team)
    return {"message": f"Team '{team.name}' deleted"}
