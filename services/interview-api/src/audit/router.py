"""Audit Trail API — query audit logs from PostgreSQL."""

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.auth.dependencies import get_current_user
from src.models.user import UserAccount
from src.models.audit import AuditLog

router = APIRouter(prefix="/api/v1/admin/audit", tags=["audit"])


@router.get("/")
async def query_audit_log(
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    actor: Optional[str] = None,
    method: Optional[str] = None,
    path_contains: Optional[str] = None,
    user: UserAccount = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Query audit trail from PostgreSQL."""
    stmt = select(AuditLog)

    if actor:
        stmt = stmt.where(AuditLog.actor.ilike(f"%{actor}%"))
    if method:
        stmt = stmt.where(AuditLog.method == method.upper())
    if path_contains:
        stmt = stmt.where(AuditLog.path.contains(path_contains))

    # Count total
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total_result = await db.execute(count_stmt)
    total = total_result.scalar() or 0

    # Fetch page
    stmt = stmt.order_by(desc(AuditLog.created_at)).offset(offset).limit(limit)
    result = await db.execute(stmt)
    entries = result.scalars().all()

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "entries": [
            {
                "id": str(e.id),
                "timestamp": e.created_at.isoformat(),
                "action": e.action,
                "method": e.method,
                "path": e.path,
                "actor": e.actor,
                "ip_address": e.ip_address,
                "status_code": e.status_code,
                "duration_ms": e.duration_ms,
            }
            for e in entries
        ],
    }
