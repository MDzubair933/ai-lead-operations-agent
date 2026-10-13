import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Text, JSON, DateTime
from sqlalchemy.orm import relationship
from app.database import Base


def utc_now():
    return datetime.now(timezone.utc)


class Lead(Base):
    __tablename__ = "leads"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    source = Column(String(500), nullable=False, index=True)
    company_name = Column(String(255), nullable=False)
    contact_name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False, index=True)
    website = Column(String(1000), nullable=True)
    
    # JSON-compatible column for normalized metadata
    normalized_identifiers = Column(JSON, nullable=False, default=dict)
    
    # Status lifecycle: new, qualifying, qualified, disqualified, review_ready, archived
    lead_status = Column(String(50), nullable=False, default="new", index=True)
    
    # Qualification outputs
    qualification_score = Column(Integer, nullable=True)
    qualification_category = Column(String(50), nullable=True)
    qualification_reason = Column(Text, nullable=True)
    evidence = Column(JSON, nullable=False, default=list)
    missing_information = Column(JSON, nullable=False, default=list)
    recommended_action = Column(String(50), nullable=True)
    raw_notes = Column(Text, nullable=True)
    
    # Idempotency hash preventing duplicate intake
    idempotency_key = Column(String(128), unique=True, nullable=False, index=True)
    
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    # Relationships
    runs = relationship("WorkflowRun", back_populates="lead", cascade="all, delete-orphan")
    drafts = relationship("OutreachDraft", back_populates="lead", cascade="all, delete-orphan")
