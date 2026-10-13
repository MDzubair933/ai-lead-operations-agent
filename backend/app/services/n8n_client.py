import uuid
import httpx
import asyncio
import random
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import settings
from app.models.lead import Lead
from app.models.workflow_run import WorkflowRun
from app.models.outreach_draft import OutreachDraft
from app.core.logging import logger
from app.core.errors import UpstreamServiceError


def utc_now():
    return datetime.now(timezone.utc)


def is_transient_error(
    status_code: Optional[int] = None,
    error_code: Optional[str] = None,
    error_summary: Optional[str] = None,
    exc: Optional[Exception] = None,
) -> bool:
    """
    Identifies whether an upstream error is temporary/transient (e.g. Gemini 503,
    rate limits 429, gateway timeouts, network blips) or permanent (e.g. invalid
    intake schema 422, missing fields, 404 unconfigured endpoint, 401/403 auth).
    """
    # 1. Non-transient exceptions / permanent validation or auth failures take priority
    permanent_error_codes = {
        "MISSING_REQUIRED_FIELDS",
        "INVALID_EMAIL_FORMAT",
        "HTTP_404_NOT_FOUND",
        "UNSUPPORTED_DATA",
        "UNAUTHORIZED",
        "FORBIDDEN",
        "HTTP_400",
        "HTTP_401",
        "HTTP_403",
        "HTTP_422",
    }
    if error_code in permanent_error_codes:
        return False

    # Permanent HTTP status codes: 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 422 Unprocessable
    if status_code in (400, 401, 403, 404, 422):
        return False

    # 2. Network exceptions / timeouts are always transient
    if exc is not None:
        if isinstance(exc, (httpx.TimeoutException, httpx.ConnectError, httpx.ReadError, httpx.RemoteProtocolError, httpx.RequestError)):
            return True

    # 3. HTTP status codes indicating transient upstream load/unavailability
    if status_code in (429, 502, 503, 504):
        return True

    # 4. n8n structured failure error codes
    transient_error_codes = {
        "AI_MODEL_EXECUTION_FAILED",
        "UPSTREAM_TIMEOUT",
        "RATE_LIMIT_EXCEEDED",
        "UPSTREAM_TEMPORARILY_UNAVAILABLE",
        "UPSTREAM_UNAVAILABLE",
    }
    if error_code in transient_error_codes:
        return True

    # 5. Summary keyword heuristics for transient upstream capacity spikes
    if error_summary:
        summary_lower = error_summary.lower()
        transient_phrases = (
            "503",
            "429",
            "high demand",
            "temporarily unavailable",
            "overloaded",
            "quota",
            "resource exhausted",
            "service unavailable",
            "timeout",
            "timed out",
            "gemini model encountered an error",
            "temporary failure",
        )
        if any(phrase in summary_lower for phrase in transient_phrases):
            return True

    # 6. Generic 500 from automation engine (server overload)
    if status_code == 500:
        return True

    return False


def calculate_backoff_delay(attempt: int, response: Optional[httpx.Response] = None) -> float:
    """
    Calculates exponential backoff delay with jitter. Respects upstream Retry-After
    header when present and valid.
    """
    # Check Retry-After header
    if response is not None and "retry-after" in response.headers:
        try:
            retry_after_str = response.headers.get("retry-after", "").strip()
            retry_after_val = float(retry_after_str)
            if retry_after_val > 0:
                jitter = random.uniform(0.1, 0.5)
                return min(retry_after_val, settings.N8N_RETRY_MAX_DELAY_SECONDS) + jitter
        except (ValueError, TypeError):
            pass

    # Exponential backoff with jitter: min(max_delay, base * 2^(attempt - 1)) + jitter
    exp_factor = 2 ** max(0, attempt - 1)
    base_delay = settings.N8N_RETRY_BASE_DELAY_SECONDS * exp_factor
    capped_delay = min(base_delay, settings.N8N_RETRY_MAX_DELAY_SECONDS)
    jitter = random.uniform(0.1, 0.5)
    return capped_delay + jitter


# Fine-grained server-side in-flight tracking set and lock to prevent concurrent duplicates
_in_flight_leads: set[str] = set()
_flight_lock = asyncio.Lock()


class N8nClient:
    @staticmethod
    async def dispatch_qualification(
        db: AsyncSession,
        lead: Lead,
        correlation_id: Optional[str] = None,
        attempt_count: int = 1,
    ) -> WorkflowRun:
        """
        Dispatches a lead qualification workflow to the dedicated n8n webhook.
        Ensures strict separation from the untouched outreach dispatch webhook.
        Handles synchronous structured responses with bounded retry policy,
        exponential backoff, jitter, and Retry-After support.
        Prevents duplicate in-flight qualification requests and recovers lead state safely.
        """
        # Guard 1: Atomic check-and-create in-flight deduplication protection
        async with _flight_lock:
            # Check DB for active run
            active_run_stmt = select(WorkflowRun).where(
                WorkflowRun.lead_id == lead.id,
                WorkflowRun.workflow_type == "qualification",
                WorkflowRun.status.in_(["running", "pending"]),
            )
            active_run = (await db.execute(active_run_stmt)).scalars().first()
            if active_run:
                logger.warning(
                    f"Duplicate qualification requested for lead {lead.id}; returning active run {active_run.id}",
                    extra={"correlation_id": active_run.correlation_id, "lead_id": lead.id}
                )
                return active_run

            if lead.id in _in_flight_leads or lead.lead_status == "qualifying":
                active_run_stmt = select(WorkflowRun).where(
                    WorkflowRun.lead_id == lead.id,
                    WorkflowRun.workflow_type == "qualification",
                ).order_by(WorkflowRun.started_at.desc())
                recent_run = (await db.execute(active_run_stmt)).scalars().first()
                if recent_run and recent_run.status in ("running", "pending"):
                    return recent_run

            if not correlation_id:
                correlation_id = f"corr-{uuid.uuid4()}"

            # Create or update WorkflowRun row atomically
            run = WorkflowRun(
                lead_id=lead.id,
                workflow_type="qualification",
                status="running",
                attempt_count=attempt_count,
                correlation_id=correlation_id,
                started_at=utc_now(),
            )
            db.add(run)

            # Update lead status to qualifying
            lead.lead_status = "qualifying"
            lead.updated_at = utc_now()
            await db.commit()
            await db.refresh(run)

            _in_flight_leads.add(lead.id)

        try:
            # Build payload with untrusted user data clearly delineated
            payload = {
                "correlation_id": correlation_id,
                "lead_id": lead.id,
                "source": lead.source,
                "company_name": lead.company_name,
                "contact_name": lead.contact_name,
                "email": lead.email,
                "website": lead.website,
                "raw_notes": lead.raw_notes,
                "timestamp": utc_now().isoformat(),
            }

            # Normalize webhook path to ensure clean formatting
            webhook_path = settings.N8N_QUALIFICATION_WEBHOOK_PATH.strip()
            if not webhook_path.startswith("/"):
                webhook_path = "/" + webhook_path

            webhook_url = f"{settings.N8N_BASE_URL.rstrip('/')}{webhook_path}"
            headers = {
                "Content-Type": "application/json",
                "X-Correlation-ID": correlation_id,
                "X-Webhook-Secret": settings.WEBHOOK_HMAC_SECRET,
            }

            max_attempts = settings.N8N_MAX_RETRIES
            last_error_code = None
            last_error_summary = None
            final_status = "failed"

            for attempt in range(attempt_count, max_attempts + 1):
                run.attempt_count = attempt
                logger.info(
                    f"Dispatching qualification workflow to {webhook_url} (attempt {attempt}/{max_attempts})",
                    extra={"correlation_id": correlation_id, "lead_id": lead.id}
                )

                is_transient = False
                response_obj = None

                try:
                    async with httpx.AsyncClient(timeout=settings.N8N_WEBHOOK_TIMEOUT_SECONDS) as client:
                        res = await client.post(webhook_url, json=payload, headers=headers)
                        response_obj = res

                        # HTTP 404 diagnostic handling (permanent configuration issue)
                        if res.status_code == 404:
                            logger.warning(
                                f"n8n webhook 404 Not Found at {webhook_url}",
                                extra={"correlation_id": correlation_id}
                            )
                            last_error_code = "HTTP_404_NOT_FOUND"
                            last_error_summary = (
                                f"Webhook endpoint not found at {webhook_url}. Verify that the workflow "
                                f"'AI Lead Qualification & Human Approval v1' is imported and set to Active "
                                f"in your n8n instance at {settings.N8N_BASE_URL}."
                            )
                            is_transient = False
                            break

                        # HTTP 422 (permanent data validation error)
                        elif res.status_code == 422:
                            error_data = {}
                            try:
                                error_data = res.json()
                            except Exception:
                                pass
                            last_error_code = error_data.get("error_code") or "HTTP_422_UNPROCESSABLE_ENTITY"
                            last_error_summary = error_data.get("error_summary") or "Lead data failed validation in automation workflow."
                            is_transient = False
                            break

                        # HTTP 400-499 non-transient (except 429)
                        elif 400 <= res.status_code < 500 and res.status_code != 429:
                            error_data = {}
                            try:
                                error_data = res.json()
                            except Exception:
                                pass
                            last_error_code = error_data.get("error_code") or f"HTTP_{res.status_code}"
                            last_error_summary = error_data.get("error_summary") or f"Client error response {res.status_code} from automation engine."
                            is_transient = False
                            break

                        # HTTP 429 or 5xx server errors
                        elif res.status_code == 429 or res.status_code >= 500:
                            error_data = {}
                            try:
                                error_data = res.json()
                            except Exception:
                                pass
                            last_error_code = error_data.get("error_code") or f"HTTP_{res.status_code}"
                            last_error_summary = error_data.get("error_summary") or f"Upstream automation engine responded with status {res.status_code}."
                            is_transient = is_transient_error(status_code=res.status_code, error_code=last_error_code, error_summary=last_error_summary)

                        else:
                            # Successful response (HTTP 200 / 202)
                            res_json = {}
                            try:
                                res_json = res.json()
                            except Exception:
                                pass

                            # Synchronous structured qualification output
                            if res_json.get("status") == "success" and res_json.get("qualification"):
                                qual = res_json["qualification"]
                                lead.qualification_score = qual.get("score")
                                lead.qualification_category = qual.get("qualification")
                                lead.qualification_reason = qual.get("reason")
                                lead.evidence = qual.get("evidence", [])
                                lead.missing_information = qual.get("missing_information", [])
                                lead.recommended_action = qual.get("recommended_next_action")

                                outreach_draft_content = qual.get("outreach_draft")
                                if outreach_draft_content and outreach_draft_content.strip():
                                    lead.lead_status = "review_ready"
                                    draft = OutreachDraft(
                                        lead_id=lead.id,
                                        channel="email",
                                        draft_content=outreach_draft_content.strip(),
                                        version=1,
                                        approval_status="pending_approval",
                                        created_at=utc_now(),
                                        updated_at=utc_now(),
                                    )
                                    db.add(draft)
                                else:
                                    lead.lead_status = "qualified" if qual.get("qualification") in ["high", "medium"] else "disqualified"

                                lead.updated_at = utc_now()
                                run.status = "completed"
                                run.safe_error_code = None
                                run.safe_error_summary = None
                                run.completed_at = utc_now()
                                await db.commit()

                                logger.info(
                                    f"n8n synchronous qualification processed successfully (attempt {attempt})",
                                    extra={"correlation_id": correlation_id}
                                )
                                return run

                            elif res_json.get("status") == "failure":
                                err_code = res_json.get("error_code") or "PROCESSING_FAILED"
                                err_summary = res_json.get("error_summary") or "Qualification workflow failed upstream."
                                last_error_code = err_code
                                last_error_summary = err_summary
                                is_transient = is_transient_error(status_code=res.status_code, error_code=err_code, error_summary=err_summary)
                                if not is_transient:
                                    break

                            else:
                                # Asynchronous execution accepted (awaiting callback)
                                logger.info(
                                    "n8n qualification trigger accepted (asynchronous callback pending)",
                                    extra={"correlation_id": correlation_id}
                                )
                                return run

                except httpx.TimeoutException as exc:
                    logger.warning(
                        f"Connection to n8n timed out after {settings.N8N_WEBHOOK_TIMEOUT_SECONDS}s: {type(exc).__name__} (attempt {attempt}/{max_attempts})",
                        extra={"correlation_id": correlation_id}
                    )
                    last_error_code = "UPSTREAM_TIMEOUT"
                    last_error_summary = f"Upstream qualification execution exceeded timeout threshold ({settings.N8N_WEBHOOK_TIMEOUT_SECONDS}s)."
                    is_transient = True
                    final_status = "failed"

                except httpx.RequestError as exc:
                    logger.warning(
                        f"Connection to n8n failed: {type(exc).__name__} (attempt {attempt}/{max_attempts})",
                        extra={"correlation_id": correlation_id}
                    )
                    last_error_code = "UPSTREAM_UNAVAILABLE"
                    last_error_summary = f"Could not establish connection to the remote automation engine ({settings.N8N_BASE_URL}): {type(exc).__name__}."
                    is_transient = True
                    final_status = "failed"

                except Exception as exc:
                    logger.error(
                        f"Unexpected dispatch error: {type(exc).__name__}: {str(exc)}",
                        extra={"correlation_id": correlation_id}
                    )
                    last_error_code = "INTERNAL_DISPATCH_ERROR"
                    last_error_summary = f"Dispatch encountered an unexpected error: {str(exc)}"
                    is_transient = False
                    final_status = "failed"
                    break

                # Handle transient retry backoff
                if is_transient and attempt < max_attempts:
                    delay = calculate_backoff_delay(attempt, response_obj)
                    logger.warning(
                        f"Transient upstream error on attempt {attempt}/{max_attempts} ({last_error_code}: {last_error_summary}). "
                        f"Retrying in {delay:.2f}s with exponential backoff and jitter...",
                        extra={"correlation_id": correlation_id, "lead_id": lead.id}
                    )
                    await asyncio.sleep(delay)
                    continue
                else:
                    break

            # All attempts exhausted or non-transient error encountered
            logger.warning(
                f"Qualification dispatch failed for lead {lead.id} after {run.attempt_count} attempt(s): {last_error_code}",
                extra={"correlation_id": correlation_id, "lead_id": lead.id}
            )
            lead.lead_status = "new"
            lead.updated_at = utc_now()
            run.status = final_status
            run.safe_error_code = last_error_code or "PROCESSING_FAILED"
            run.safe_error_summary = (
                f"{last_error_summary} Lead reverted to 'new' state for safe retry."
                if "reverted to 'new'" not in (last_error_summary or "")
                else last_error_summary
            )
            run.completed_at = utc_now()
            await db.commit()

            return run
        finally:
            async with _flight_lock:
                _in_flight_leads.discard(lead.id)
