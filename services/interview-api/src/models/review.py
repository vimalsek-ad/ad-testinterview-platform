"""Review decision model — stored in PostgreSQL."""

import uuid
from datetime import datetime

from sqlalchemy import String, Text, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from src.config.database import Base


class ReviewDecision(Base):
    __tablename__ = "review_decision"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("candidate_session.id"), nullable=False, index=True)
    reviewer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("user_account.id"), nullable=False)
    reviewer_email: Mapped[str] = mapped_column(String(255), nullable=False)
    decision: Mapped[str] = mapped_column(String(20), nullable=False)  # select | reject | hold
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    decided_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
