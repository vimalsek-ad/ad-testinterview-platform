"""Proctoring API — receive and store flags from the client SDK."""

from uuid import UUID
from typing import Optional

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db

router = APIRouter(prefix="/api/v1", tags=["proctoring"])


class ProctoringFlagInput(BaseModel):
    type: str
    severity: str
    description: str
    timestamp: str
    metadata: Optional[dict] = None


class FlagBatchRequest(BaseModel):
    flags: list[ProctoringFlagInput]


# In-memory store for prototype (replace with DB table in production)
_flag_store: dict[str, list[dict]] = {}


@router.post("/sessions/{session_id}/proctoring/flags", status_code=status.HTTP_200_OK)
async def ingest_flags(session_id: UUID, payload: FlagBatchRequest):
    """Receive proctoring flags from the client SDK (batch)."""
    session_key = str(session_id)
    if session_key not in _flag_store:
        _flag_store[session_key] = []

    for flag in payload.flags:
        _flag_store[session_key].append(flag.dict())

    total = len(_flag_store[session_key])

    # Calculate severity score
    severity_weights = {"low": 1, "medium": 2, "high": 3, "critical": 5}
    severity_score = sum(severity_weights.get(f["severity"], 1) for f in _flag_store[session_key])

    return {
        "received": len(payload.flags),
        "total_flags": total,
        "severity_score": severity_score,
    }


@router.get("/sessions/{session_id}/proctoring/report")
async def get_proctoring_report(session_id: UUID):
    """Get proctoring report for a session (for reviewer dashboard)."""
    session_key = str(session_id)
    flags = _flag_store.get(session_key, [])

    # Count by severity
    severity_counts = {"low": 0, "medium": 0, "high": 0, "critical": 0}
    type_counts: dict[str, int] = {}
    for f in flags:
        severity_counts[f["severity"]] = severity_counts.get(f["severity"], 0) + 1
        type_counts[f["type"]] = type_counts.get(f["type"], 0) + 1

    severity_weights = {"low": 1, "medium": 2, "high": 3, "critical": 5}
    severity_score = sum(severity_weights.get(f["severity"], 1) for f in flags)

    # Integrity score: 100 - (severity_score * 2), min 0
    integrity_score = max(0, 100 - severity_score * 2)

    return {
        "session_id": session_key,
        "total_flags": len(flags),
        "severity_counts": severity_counts,
        "type_counts": type_counts,
        "severity_score": severity_score,
        "integrity_score": integrity_score,
        "flags": flags,
    }
