# Operations Runbook — Day-to-Day Maintenance & Incident Response

## 1. Daily Operations Checklist

1. **Review Queue Clearance**:
   - Navigate to the **Review Queue** tab in the operations dashboard.
   - Inspect all outreach drafts in `PENDING_APPROVAL` status.
   - Verify that lead data and proposed messaging align with business guidelines.
   - Either **Approve** or **Reject** drafts with appropriate feedback.
2. **Monitor Execution Runs**:
   - Check the **Execution Runs** tab for any runs marked `FAILED` or `TIMED_OUT`.
   - Inspect the `safe_error_summary` for upstream timeout or rate limiting indicators.
   - Trigger **Safe Retry** on transient failures once upstream stability is restored.
3. **Integration Health Check**:
   - Inspect the **Settings & Health** tab to ensure the database and backend services report `operational`.

---

## 2. Incident Response Scenarios

### Scenario A: High Rate of `UPSTREAM_UNAVAILABLE` or `LLM_PROVIDER_TIMEOUT`
**Symptoms**: Execution runs show `FAILED` status with error code `UPSTREAM_UNAVAILABLE`.
**Troubleshooting Steps**:
1. Check network connectivity between FastAPI server and n8n host (`https://n8n.example.com`).
2. Verify n8n instance CPU and memory utilization.
3. Check the AI provider API balance / rate limits in n8n (e.g. OpenAI / Anthropic credits).
4. Do NOT spam manual retries; wait until upstream provider rate limit window resets.
5. In the UI, use the **Safe Retry** action per lead once connectivity is confirmed.

### Scenario B: Duplicate Intake Storms
**Symptoms**: Inbound API returns 409 Conflict with code `DUPLICATE_RESOURCE`.
**Cause**: External intake form or partner webhook re-triggering requests.
**Resolution**:
- This is normal protective behavior. The system's deterministic SHA-256 idempotency key prevents duplicate row creation.
- Check the `correlation_id` in the error response to correlate with client logs.

### Scenario C: Secret Rotation
**Procedure for Rotating `API_SECRET_KEY` or `WEBHOOK_HMAC_SECRET`**:
1. Generate a new high-entropy string: `openssl rand -hex 32`.
2. Update the `.env` file on the backend server.
3. Update the matching secret header parameter in the n8n HTTP Request node (`X-Webhook-Secret`).
4. Restart the FastAPI backend service: `docker compose restart app-backend`.
5. Verify health endpoint: `curl https://<DOMAIN>/api/health`.

---

## 3. Database Maintenance & Vacuuming
- For PostgreSQL: Configure automated weekly autovacuuming.
- Log retention: Truncate `audit_events` older than 90 days if required by corporate compliance policies:
  ```sql
  DELETE FROM audit_events WHERE timestamp < NOW() - INTERVAL '90 days';
  ```
