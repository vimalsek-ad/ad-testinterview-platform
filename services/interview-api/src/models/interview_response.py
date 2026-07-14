"""Interview response model — stored in PostgreSQL."""

import uuid
from datetime import datetime

from sqlalchemy import String, Text, Integer, Float, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from src.config.database import Base


class InterviewResponse(Base):
    __tablename__ = "interview_response"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("candidate_session.id"), nullable=False, index=True)
    question_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("question.id"), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    filepath: Mapped[str] = mapped_column(Text, nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    content_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    transcription: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
