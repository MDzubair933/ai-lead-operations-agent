import time
import uuid
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError

from app.config import settings
from app.database import init_db
from app.core.logging import logger
from app.core.errors import (
    AppException,
    app_exception_handler,
    validation_exception_handler,
    unhandled_exception_handler,
)

# API Routers
from app.api.health import router as health_router
from app.api.leads import router as leads_router
from app.api.runs import router as runs_router
from app.api.approvals import router as approvals_router
from app.api.webhooks import router as webhooks_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize schemas
    logger.info(f"Starting AI Lead Operations Agent backend ({settings.APP_ENV})")
    await init_db()
    try:
        from app.database import AsyncSessionLocal
        from app.services.lead_service import LeadService
        async with AsyncSessionLocal() as db:
            await LeadService.reconcile_orphan_qualifying_states(db)
    except Exception as exc:
        logger.warning(f"Orphan lead reconciliation on startup bypassed: {exc}")
    yield
    # Shutdown
    logger.info("Shutting down AI Lead Operations Agent backend")


app = FastAPI(
    title="AI Lead Operations Agent API",
    description="Secure, production-oriented autonomous lead qualification & operations API.",
    version="1.0.0",
    docs_url="/docs" if settings.DEBUG or settings.APP_ENV == "development" else None,
    redoc_url=None,
    lifespan=lifespan,
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["X-Correlation-ID"],
)


# Correlation ID Middleware & Request Timing
@app.middleware("http")
async def correlation_id_middleware(request: Request, call_next):
    correlation_id = request.headers.get("X-Correlation-ID") or f"corr-{uuid.uuid4()}"
    request.state.correlation_id = correlation_id

    start_time = time.perf_counter()
    response = await call_next(request)
    duration_ms = round((time.perf_counter() - start_time) * 1000, 2)

    response.headers["X-Correlation-ID"] = correlation_id
    response.headers["X-Response-Time-MS"] = str(duration_ms)

    # Structured request logging
    logger.info(
        f"{request.method} {request.url.path} - {response.status_code} ({duration_ms}ms)",
        extra={"correlation_id": correlation_id}
    )
    return response


# Register Centralized Error Handlers
app.add_exception_handler(AppException, app_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, unhandled_exception_handler)

# Mount Routers under /api
app.include_router(health_router, prefix="/api")
app.include_router(leads_router, prefix="/api")
app.include_router(runs_router, prefix="/api")
app.include_router(approvals_router, prefix="/api")
app.include_router(webhooks_router, prefix="/api")


@app.get("/")
async def root():
    return {
        "service": "AI Lead Operations Agent Control Plane",
        "status": "online",
        "health_check": "/api/health",
        "version": "1.0.0",
    }
