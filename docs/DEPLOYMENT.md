# Production Deployment Guide

## 1. Architecture & Deployment Isolation

The AI Lead Operations Agent is packaged as independent application containers (`lead_ops_backend`, `lead_ops_frontend`, `lead_ops_postgres`).
It runs alongside your existing infrastructure without modifying, upgrading, or reinstalling your existing self-hosted n8n installation.

---

## 2. Environment Variables Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `APP_ENV` | Yes | `production` | Deployment mode (`production`, `staging`, `development`) |
| `API_SECRET_KEY` | Yes | None | 64-character high-entropy secret for API token verification |
| `WEBHOOK_HMAC_SECRET` | Yes | None | Shared secret used to sign and verify n8n callback payloads |
| `DATABASE_URL` | Yes | None | PostgreSQL connection string (`postgresql+asyncpg://user:pass@host:5432/db`) |
| `N8N_BASE_URL` | Yes | `https://n8n.example.com` | Base URL of self-hosted n8n instance |
| `N8N_QUALIFICATION_WEBHOOK_PATH` | Yes | `/webhook/lead-qualification` | Dedicated qualification webhook path (DO NOT change to dispatch-outreach) |
| `ENABLE_EXTERNAL_OUTREACH` | Yes | `false` | Global safety lock for external messaging |
| `CORS_ORIGINS` | Yes | `https://your-domain.com` | Comma-separated list of allowed browser origins |

---

## 3. Deployment with Docker Compose

### Step 1: Prepare Production Environment File
Copy `.env.example` to `.env` and populate strong, unique production values:
```bash
cp .env.example .env
```

Generate high-entropy secrets:
```bash
# On Linux / macOS or WSL:
openssl rand -hex 32
```

### Step 2: Build and Start Application Services
```bash
docker compose up -d --build
```

### Step 3: Run Database Migrations
Apply Alembic migrations to your production PostgreSQL database:
```bash
docker compose exec app-backend alembic upgrade head
```

---

## 4. HTTPS & Reverse Proxy Configuration (Nginx / Caddy)

Configure your external reverse proxy (e.g., Nginx, Caddy, Cloudflare) with valid TLS certificates:

```nginx
# Example Nginx Server Block
server {
    listen 443 ssl http2;
    server_name leadops.yourcompany.com;

    ssl_certificate /etc/letsencrypt/live/leadops.yourcompany.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/leadops.yourcompany.com/privkey.pem;

    # Static UI
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API Endpoints & Webhooks
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}
```

---

## 5. Backup & Restore Procedures

### Database Backup (PostgreSQL)
```bash
docker compose exec -t app-postgres pg_dump -U lead_ops_user -d lead_ops -F c -b -v -f /tmp/backup.dump
docker cp lead_ops_postgres:/tmp/backup.dump ./backups/lead_ops_$(date +%Y%m%d_%H%M%S).dump
```

### Database Restore
```bash
docker cp ./backups/lead_ops_backup.dump lead_ops_postgres:/tmp/backup.dump
docker compose exec -t app-postgres pg_restore -U lead_ops_user -d lead_ops -v --clean /tmp/backup.dump
```

---

## 6. Production Smoke Tests

After deployment, run the following verification checks:

1. **Service Health Check**:
   ```bash
   curl -i https://leadops.yourcompany.com/api/health
   # Expected: HTTP 200 OK {"status": "healthy", "database": "connected", "n8n": "configured"}
   ```

2. **Configuration Probe**:
   ```bash
   curl -i https://leadops.yourcompany.com/api/config/status
   # Expected: HTTP 200 OK with external_outreach_enabled: false
   ```

3. **Lead Intake Probe**:
   ```bash
   curl -i -X POST https://leadops.yourcompany.com/api/leads \
     -H "Content-Type: application/json" \
     -d '{"source":"smoke_test","company_name":"Smoke Test Corp","contact_name":"Tester","email":"test@smoketest.com"}'
   # Expected: HTTP 201 Created
   ```

---

## 7. Rollback Procedure

If a deployed version experiences issues:
1. Revert container image tags in `docker-compose.yml` to previous release.
2. Roll back database migrations if necessary:
   ```bash
   docker compose exec app-backend alembic downgrade -1
   ```
3. Restart containers:
   ```bash
   docker compose up -d
   ```
