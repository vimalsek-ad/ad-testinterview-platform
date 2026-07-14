"""Audit Trail Middleware — logs all mutations to PostgreSQL automatically."""

import time
from datetime import datetime

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

from src.config.database import AsyncSessionLocal
from src.models.audit import AuditLog

# Methods that represent mutations
AUDITABLE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
SKIP_PATHS = {"/health", "/docs", "/openapi.json", "/redoc"}


class AuditMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if request.method not in AUDITABLE_METHODS:
            return await call_next(request)

        if any(request.url.path.startswith(p) for p in SKIP_PATHS):
            return await call_next(request)

        start_time = time.time()
        response = await call_next(request)
        duration_ms = round((time.time() - start_time) * 1000, 2)

        # Extract actor from JWT
        actor = "anonymous"
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            try:
                from src.auth.service import decode_access_token
                payload = decode_access_token(auth_header.split(" ")[1])
                actor = payload.get("email", payload.get("sub", "unknown"))
            except Exception:
                actor = "invalid_token"

        # Write to PostgreSQL (fire-and-forget — don't block the response)
        try:
            async with AsyncSessionLocal() as session:
                entry = AuditLog(
                    action=f"{request.method} {request.url.path}",
                    method=request.method,
                    path=str(request.url.path),
                    actor=actor,
                    ip_address=request.client.host if request.client else "unknown",
                    status_code=response.status_code,
                    duration_ms=duration_ms,
                    user_agent=(request.headers.get("user-agent", ""))[:200],
                )
                session.add(entry)
                await session.commit()
        except Exception as e:
            # Don't let audit failures break the app
            print(f"[Audit] Failed to write: {e}")

        return response
