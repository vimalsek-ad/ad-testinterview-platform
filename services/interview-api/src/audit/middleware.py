"""Audit Trail Middleware — logs all significant API actions automatically."""

import time
from datetime import datetime
from typing import Optional
from uuid import uuid4

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response


# In-memory audit log for prototype (replace with DB table in production)
_audit_log: list[dict] = []

# Methods that represent mutations (we audit these)
AUDITABLE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

# Paths to skip (health checks, docs)
SKIP_PATHS = {"/health", "/docs", "/openapi.json", "/redoc"}


class AuditMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        # Skip non-auditable requests
        if request.method not in AUDITABLE_METHODS:
            return await call_next(request)

        if any(request.url.path.startswith(p) for p in SKIP_PATHS):
            return await call_next(request)

        start_time = time.time()
        response = await call_next(request)
        duration_ms = round((time.time() - start_time) * 1000, 2)

        # Extract user info from auth header (if available)
        actor = "anonymous"
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            try:
                from src.auth.service import decode_access_token
                payload = decode_access_token(auth_header.split(" ")[1])
                actor = payload.get("email", payload.get("sub", "unknown"))
            except Exception:
                actor = "invalid_token"

        # Build audit entry
        entry = {
            "id": str(uuid4()),
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "action": f"{request.method} {request.url.path}",
            "method": request.method,
            "path": request.url.path,
            "actor": actor,
            "ip_address": request.client.host if request.client else "unknown",
            "status_code": response.status_code,
            "duration_ms": duration_ms,
            "user_agent": request.headers.get("user-agent", "")[:100],
        }

        _audit_log.append(entry)

        # Keep only last 10000 entries in memory (prototype limit)
        if len(_audit_log) > 10000:
            _audit_log.pop(0)

        return response


def get_audit_log(
    limit: int = 50,
    offset: int = 0,
    actor: Optional[str] = None,
    method: Optional[str] = None,
    path_contains: Optional[str] = None,
) -> tuple[list[dict], int]:
    """Query the audit log with filters."""
    filtered = _audit_log

    if actor:
        filtered = [e for e in filtered if actor.lower() in e["actor"].lower()]
    if method:
        filtered = [e for e in filtered if e["method"] == method.upper()]
    if path_contains:
        filtered = [e for e in filtered if path_contains in e["path"]]

    # Sort by timestamp descending (newest first)
    filtered = sorted(filtered, key=lambda x: x["timestamp"], reverse=True)

    total = len(filtered)
    return filtered[offset:offset + limit], total
