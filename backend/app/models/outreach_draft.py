import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


def utc_now():
    return datetime.now(timezone.utc)


class OutreachDraft(Base):
    __tablename__ = "outreach_drafts"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    lead_id = Column(String(36), ForeignKey("leads.id", ondelete="CASCADE"), nullable=False, index=True)
    channel = Column(String(50), nullable=False, default="email")
    draft_content = Column(Text, nullable=False)
    version = Column(Integer, nullable=False, default=1)
    
    # Approval lifecycle: draft, pending_approval, approved, rejected
    approval_status = Column(String(50), nullable=False, default="pending_approval", index=True)
    approved_by = Column(String(255), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    
    # External delivery (locked in Release 1)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    external_message_id = Column(String(255), nullable=True)

    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    # Relationships
    lead = relationship("Lead", back_populates="drafts")
