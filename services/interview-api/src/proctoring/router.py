"""Proctoring API — receive and store flags in PostgreSQL."""

from uuid import UUID
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.models.proctoring import ProctoringFlag

router = APIRouter(prefix="/api/v1", tags=["proctoring"])


class ProctoringFlagInput(BaseModel):
    type: str
    severity: str
    description: str
    timestamp: str
    metadata: Optional[dict] = None


class FlagBatchRequest(BaseModel):
    flags: list[ProctoringFlagInput]


@router.post("/sessions/{session_id}/proctoring/flags", status_code=status.HTTP_200_OK)
async def ingest_flags(session_id: UUID, payload: FlagBatchRequest, db: AsyncSession = Depends(get_db)):
    """Receive proctoring flags from the client SDK (batch) — stored in PostgreSQL."""
    for flag in payload.flags:
        db_flag = ProctoringFlag(
            session_id=session_id,
            flag_type=flag.type,
            severity=flag.severity,
            description=flag.description,
            metadata_json=flag.metadata,
            flagged_at=datetime.fromisoformat(flag.timestamp.replace("Z", "+00:00")) if flag.timestamp else datetime.utcnow(),
        )
        db.add(db_flag)

    await db.flush()

    # Calculate total severity score
    result = await db.execute(select(ProctoringFlag).where(ProctoringFlag.session_id == session_id))
    all_flags = result.scalars().all()

    severity_weights = {"low": 1, "medium": 2, "high": 3, "critical": 5}
    severity_score = sum(severity_weights.get(f.severity, 1) for f in all_flags)

    return {
        "received": len(payload.flags),
        "total_flags": len(all_flags),
        "severity_score": severity_score,
    }


@router.get("/sessions/{session_id}/proctoring/report")
async def get_proctoring_report(session_id: UUID, db: AsyncSession = Depends(get_db)):
    """Get proctoring report for a session."""
    result = await db.execute(
        select(ProctoringFlag)
        .where(ProctoringFlag.session_id == session_id)
        .order_by(ProctoringFlag.flagged_at)
    )
    flags = result.scalars().all()

    severity_counts = {"low": 0, "medium": 0, "high": 0, "critical": 0}
    type_counts: dict[str, int] = {}
    for f in flags:
        severity_counts[f.severity] = severity_counts.get(f.severity, 0) + 1
        type_counts[f.flag_type] = type_counts.get(f.flag_type, 0) + 1

    severity_weights = {"low": 1, "medium": 2, "high": 3, "critical": 5}
    severity_score = sum(severity_weights.get(f.severity, 1) for f in flags)
    integrity_score = max(0, 100 - severity_score * 2)

    return {
        "session_id": str(session_id),
        "total_flags": len(flags),
        "severity_counts": severity_counts,
        "type_counts": type_counts,
        "severity_score": severity_score,
        "integrity_score": integrity_score,
        "flags": [
            {
                "type": f.flag_type,
                "severity": f.severity,
                "description": f.description,
                "timestamp": f.flagged_at.isoformat(),
                "metadata": f.metadata_json,
            }
            for f in flags
        ],
    }
