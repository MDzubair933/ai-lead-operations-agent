import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


def utc_now():
    return datetime.now(timezone.utc)


class WorkflowRun(Base):
    __tablename__ = "workflow_runs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    lead_id = Column(String(36), ForeignKey("leads.id", ondelete="CASCADE"), nullable=False, index=True)
    workflow_type = Column(String(100), nullable=False, default="qualification")
    
    # Run status: pending, running, completed, failed, timed_out
    status = Column(String(50), nullable=False, default="pending", index=True)
    attempt_count = Column(Integer, nullable=False, default=1)
    
    # End-to-end tracing correlation ID
    correlation_id = Column(String(64), unique=True, nullable=False, index=True)
    
    started_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Sanitized safe error information (never secrets or internal stack traces)
    safe_error_code = Column(String(100), nullable=True)
    safe_error_summary = Column(Text, nullable=True)

    # Relationships
    lead = relationship("Lead", back_populates="runs")
