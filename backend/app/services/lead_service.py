import hashlib
import re
from typing import Optional, Tuple
from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.lead import Lead
from app.models.workflow_run import WorkflowRun
from app.schemas.lead import LeadCreate, LeadStatusType, QualificationCategoryType
from app.core.errors import DuplicateResourceError, NotFoundError
from app.core.logging import logger


def normalize_lead_identifiers(company: str, email: str) -> Tuple[str, dict]:
    """
    Computes normalized metadata and a deterministic SHA-256 idempotency key.
    Key is based on: lower(email_domain) + lower(email) + lower(cleaned_company).
    """
    clean_email = email.lower().strip()
    domain = clean_email.split("@")[1] if "@" in clean_email else ""
    clean_company = re.sub(r"[^a-zA-Z0-9]", "", company).lower()

    idempotency_raw = f"{clean_email}:{clean_company}:{domain}"
    idempotency_key = hashlib.sha256(idempotency_raw.encode("utf-8")).hexdigest()

    metadata = {
        "domain": domain,
        "clean_email": clean_email,
        "normalized_company": clean_company,
    }
    return idempotency_key, metadata


class LeadService:
    @staticmethod
    async def create_lead(db: AsyncSession, data: LeadCreate) -> Lead:
        idempotency_key, normalized_meta = normalize_lead_identifiers(
            company=data.company_name, email=data.email
        )

        # Check for existing lead with identical idempotency key
        existing_stmt = select(Lead).where(Lead.idempotency_key == idempotency_key)
        existing_res = await db.execute(existing_stmt)
        existing_lead = existing_res.scalar_one_or_none()

        if existing_lead:
            logger.info(f"Duplicate lead detected for email {data.email} with company {data.company_name}")
            raise DuplicateResourceError(
                f"Lead for '{data.company_name}' ({data.email}) already exists in registry.",
                details=[{"lead_id": existing_lead.id, "lead_status": existing_lead.lead_status}]
            )

        lead = Lead(
            source=data.source,
            company_name=data.company_name,
            contact_name=data.contact_name,
            email=data.email.lower().strip(),
            website=data.website,
            normalized_identifiers=normalized_meta,
            lead_status="new",
            raw_notes=data.raw_notes,
            idempotency_key=idempotency_key,
            evidence=[],
            missing_information=[],
        )
        db.add(lead)
        await db.commit()
        await db.refresh(lead)
        return lead

    @staticmethod
    async def get_lead(db: AsyncSession, lead_id: str) -> Lead:
        stmt = select(Lead).where(Lead.id == lead_id)
        res = await db.execute(stmt)
        lead = res.scalar_one_or_none()
        if not lead:
            raise NotFoundError(f"Lead with id '{lead_id}' does not exist.")
        return lead

    @staticmethod
    async def list_leads(
        db: AsyncSession,
        search: Optional[str] = None,
        status: Optional[str] = None,
        category: Optional[str] = None,
        page: int = 1,
        page_size: int = 10,
    ) -> Tuple[list[Lead], int]:
        filters = []
        if search:
            q = f"%{search.strip()}%"
            filters.append(
                or_(
                    Lead.company_name.ilike(q),
                    Lead.contact_name.ilike(q),
                    Lead.email.ilike(q),
                )
            )
        if status and status != "all":
            filters.append(Lead.lead_status == status)
        if category and category != "all":
            filters.append(Lead.qualification_category == category)

        # Count query
        count_stmt = select(func.count(Lead.id))
        if filters:
            count_stmt = count_stmt.where(and_(*filters))
        total = (await db.execute(count_stmt)).scalar() or 0

        # Items query
        stmt = select(Lead).order_by(Lead.created_at.desc())
        if filters:
            stmt = stmt.where(and_(*filters))
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)

        items = (await db.execute(stmt)).scalars().all()
        return list(items), total

    @staticmethod
    async def parse_and_preview_csv(db: AsyncSession, csv_text: str):
        import csv
        import io
        from app.schemas.lead import CsvLeadRowPreview, CsvPreviewResponse

        if not csv_text or not csv_text.strip():
            return CsvPreviewResponse(
                total_rows=0,
                valid_count=0,
                duplicate_count=0,
                error_count=0,
                rows=[]
            )

        reader = csv.DictReader(io.StringIO(csv_text.strip()))
        if not reader.fieldnames:
            return CsvPreviewResponse(
                total_rows=0,
                valid_count=0,
                duplicate_count=0,
                error_count=0,
                rows=[]
            )

        # Normalize header lookup map (lowercase, stripped, underscored)
        header_map = {}
        for h in reader.fieldnames:
            norm = h.lower().strip().replace(" ", "_").replace("-", "_")
            header_map[norm] = h

        def get_val(row, *aliases):
            for a in aliases:
                orig = header_map.get(a)
                if orig and orig in row and row[orig] is not None:
                    val = str(row[orig]).strip()
                    if val:
                        return val
            return ""

        email_regex = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
        rows_preview = []
        batch_seen_keys = set()
        
        valid_count = 0
        duplicate_count = 0
        error_count = 0

        # Pre-fetch existing idempotency keys from DB for fast lookup
        existing_keys_stmt = select(Lead.idempotency_key)
        existing_keys_res = await db.execute(existing_keys_stmt)
        db_keys = set(existing_keys_res.scalars().all())

        for idx, row in enumerate(reader, start=1):
            company = get_val(row, "company_name", "company", "business_name", "organization")
            contact = get_val(row, "contact_name", "contact", "name", "full_name", "lead_name")
            email = get_val(row, "email", "email_address", "work_email", "contact_email")
            website = get_val(row, "website", "url", "web", "domain") or None
            source = get_val(row, "source", "lead_source") or "csv_import"
            notes = get_val(row, "raw_notes", "notes", "lead_notes", "description") or None

            # Safe boundary trimming to ensure strict schema compliance
            if source and len(source) > 500:
                source = source[:500]
            if website and len(website) > 1000:
                website = website[:1000]
            if company and len(company) > 255:
                company = company[:255]
            if contact and len(contact) > 255:
                contact = contact[:255]
            if notes and len(notes) > 5000:
                notes = notes[:5000]

            errors = []
            if not company:
                errors.append("Company name is required.")
            if not contact:
                errors.append("Contact name is required.")
            if not email:
                errors.append("Email is required.")
            elif not email_regex.match(email):
                errors.append(f"Invalid email syntax: '{email}'")

            is_duplicate = False
            if not errors:
                idempotency_key, _ = normalize_lead_identifiers(company=company, email=email)
                if idempotency_key in db_keys:
                    is_duplicate = True
                    errors.append("Duplicate: Lead already exists in database.")
                elif idempotency_key in batch_seen_keys:
                    is_duplicate = True
                    errors.append("Duplicate: Repeated row within this CSV.")
                else:
                    batch_seen_keys.add(idempotency_key)

            is_valid = len(errors) == 0

            if is_duplicate:
                duplicate_count += 1
            elif is_valid:
                valid_count += 1
            else:
                error_count += 1

            rows_preview.append(
                CsvLeadRowPreview(
                    row_number=idx,
                    company_name=company,
                    contact_name=contact,
                    email=email,
                    website=website,
                    source=source,
                    raw_notes=notes,
                    is_valid=is_valid,
                    is_duplicate=is_duplicate,
                    errors=errors
                )
            )

        return CsvPreviewResponse(
            total_rows=len(rows_preview),
            valid_count=valid_count,
            duplicate_count=duplicate_count,
            error_count=error_count,
            rows=rows_preview
        )

    @staticmethod
    async def bulk_import_leads(db: AsyncSession, leads_data: list):
        created_leads = []
        errors = []

        for lead_item in leads_data:
            try:
                if isinstance(lead_item, LeadCreate):
                    create_payload = lead_item
                else:
                    c_name = getattr(lead_item, "company_name", "").strip()[:255]
                    ct_name = getattr(lead_item, "contact_name", "").strip()[:255]
                    em = getattr(lead_item, "email", "").strip()
                    src = (getattr(lead_item, "source", None) or "csv_import").strip()[:500]
                    wb = getattr(lead_item, "website", None)
                    if wb:
                        wb = wb.strip()[:1000]
                    rn = getattr(lead_item, "raw_notes", None)
                    if rn:
                        rn = rn[:5000]

                    create_payload = LeadCreate(
                        source=src,
                        company_name=c_name,
                        contact_name=ct_name,
                        email=em,
                        website=wb,
                        raw_notes=rn,
                    )
                lead = await LeadService.create_lead(db, create_payload)
                created_leads.append(lead)
            except Exception as exc:
                c_name = getattr(lead_item, "company_name", "Unknown")
                errors.append(f"Failed to import lead for '{c_name}': {str(exc)}")

        return created_leads, errors

    @staticmethod
    async def bulk_qualify_leads(db: AsyncSession, lead_ids: list[str]):
        import asyncio
        from app.services.n8n_client import N8nClient
        dispatched_runs = []
        failed_count = 0

        for i, lead_id in enumerate(lead_ids):
            try:
                lead = await LeadService.get_lead(db, lead_id)
                run = await N8nClient.dispatch_qualification(db, lead)
                dispatched_runs.append({
                    "lead_id": lead.id,
                    "company_name": lead.company_name,
                    "run_id": run.id,
                    "status": run.status,
                    "correlation_id": run.correlation_id,
                })
                # Modest pacing between batch dispatches to protect upstream n8n concurrency
                if i < len(lead_ids) - 1:
                    await asyncio.sleep(0.2)
            except Exception as exc:
                failed_count += 1
                dispatched_runs.append({
                    "lead_id": lead_id,
                    "status": "failed",
                    "error": str(exc),
                })

        return len(dispatched_runs) - failed_count, failed_count, dispatched_runs

    @staticmethod
    async def reconcile_orphan_qualifying_states(db: AsyncSession):
        from app.models.workflow_run import WorkflowRun
        from datetime import datetime, timezone
        stuck_leads_stmt = select(Lead).where(Lead.lead_status == "qualifying")
        stuck_leads = (await db.execute(stuck_leads_stmt)).scalars().all()
        for lead in stuck_leads:
            active_run_stmt = select(WorkflowRun).where(
                WorkflowRun.lead_id == lead.id,
                WorkflowRun.workflow_type == "qualification",
                WorkflowRun.status.in_(["running", "pending"]),
            )
            has_active_run = (await db.execute(active_run_stmt)).scalars().first()
            if not has_active_run:
                lead.lead_status = "new"
                lead.updated_at = datetime.now(timezone.utc)
        await db.commit()

