"""Audit Trail API — query audit logs."""

from typing import Optional

from fastapi import APIRouter, Depends, Query

from src.auth.dependencies import get_current_user
from src.models.user import UserAccount
from src.audit.middleware import get_audit_log

router = APIRouter(prefix="/api/v1/admin/audit", tags=["audit"])


@router.get("/")
async def query_audit_log(
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    actor: Optional[str] = None,
    method: Optional[str] = None,
    path_contains: Optional[str] = None,
    user: UserAccount = Depends(get_current_user),
):
    """Query audit trail — all mutations are logged automatically."""
    entries, total = get_audit_log(
        limit=limit, offset=offset,
        actor=actor, method=method, path_contains=path_contains,
    )
    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "entries": entries,
    }
