"""Main entry point — Interview Platform API."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.config.settings import settings
from src.config.database import create_tables
from src.auth.router import router as auth_router
from src.questions.router import router as questions_router
from src.sessions.router import router as sessions_router
from src.teams.router import router as teams_router
from src.proctoring.router import router as proctoring_router
from src.interviews.router import router as interviews_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: create tables. Shutdown: cleanup."""
    await create_tables()
    print("✅ Database tables created")
    yield
    print("👋 Shutting down")


app = FastAPI(
    title="Interview Platform API",
    version="0.1.0",
    description="Enterprise coding assessment and interview platform for Alter Domus",
    lifespan=lifespan,
)

# CORS — allow frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Health Endpoints ─────────────────────────────────────────
@app.get("/health", include_in_schema=False)
async def health():
    return {"status": "ok"}


# ─── Register Routers ─────────────────────────────────────────
app.include_router(auth_router)
app.include_router(teams_router)
app.include_router(questions_router)
app.include_router(sessions_router)
app.include_router(proctoring_router)
app.include_router(interviews_router)
