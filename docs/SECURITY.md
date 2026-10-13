# Security Architecture & Threat Mitigation Guide

## 1. Security Principles

The **AI Lead Operations Agent** adheres to defense-in-depth principles across the web client, application service, database persistence, and automation engine.

---

## 2. Threat Matrix & Mitigations

| Threat Vector | Severity | Vulnerability Mechanism | Implemented Mitigation |
|---|---|---|---|
| **Prompt Injection** | CRITICAL | Malicious lead notes attempting to override LLM system rules or exfiltrate prompts | Input text is stripped of delimiters and isolated inside strict XML `<untrusted_lead_data>` blocks. System prompt forbids role overrides. |
| **Accidental Secret Disclosure** | CRITICAL | Credentials leaking into frontend bundles, git history, or application logs | 1. Zero secrets in frontend code.<br>2. Log formatter uses regex scrubbing filters targeting API keys, Bearer tokens, passwords, and database strings.<br>3. `.env.example` contains only placeholders. |
| **Unauthorized Webhook Callback** | HIGH | Attacker spoofing n8n qualification callback to manipulate lead status | Inbound webhook callbacks require HMAC-SHA256 signature verification matching `WEBHOOK_HMAC_SECRET` using timing-safe comparison (`hmac.compare_digest`). |
| **Unapproved External Outreach** | HIGH | Premature or unauthorized transmission of AI-generated messages | 1. External outreach is disabled by default via `ENABLE_EXTERNAL_OUTREACH=false`.<br>2. Human approval lifecycle (`pending_approval` → `approved`).<br>3. Editing any approved draft immediately invalidates approval and resets status to `pending_approval`. |
| **Duplicate Lead Storms** | MEDIUM | Rapid repeated submissions exhausting system resources | Deterministic SHA-256 idempotency key computed on `clean_email + clean_company + domain`. Database unique constraint rejects duplicates with 409 Conflict. |
| **Information Disclosure via Exceptions** | MEDIUM | Detailed stack traces exposing internal architecture | Global exception handlers catch uncaught exceptions and return standardized envelopes with correlation IDs and safe codes (`INTERNAL_SERVER_ERROR`). Raw exceptions are logged internally only. |

---

## 3. Sensitive Data Redaction Filter

Structured logs in `backend/app/core/logging.py` employ a dedicated `SensitiveDataFilter`.
The filter scrubs:
- Bearer tokens (`Bearer eyJ...` → `Bearer [REDACTED_TOKEN]`)
- API keys (`api_key='sk-...'` → `api_key='[REDACTED]'`)
- Database connection strings (`postgresql://user:password@host` → `postgresql://user:[REDACTED_PASSWORD]@host`)
- Secrets, authorization headers, and raw credentials

---

## 4. Human Approval Lifecycle State Machine

```
               [ AI Qualification Finishes ]
                              │
                              ▼
                       (DRAFT GENERATED)
                              │
                              ▼
                     [ PENDING_APPROVAL ]
                       /              \
        (Approve Action)              (Reject Action)
                     /                  \
                    ▼                    ▼
               [ APPROVED ]         [ REJECTED ]
                    │
           (Draft Content Edited)
                    │
                    ▼
          [ PENDING_APPROVAL ] ──► (Version Incremented, Prior Approver Cleared)
```

**Security Invariant**: No draft can be marked approved while containing unreviewed edits. Modifying draft content immediately invalidates any prior approval signature.
