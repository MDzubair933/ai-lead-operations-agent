from typing import Any, List, Optional
from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from app.core.logging import logger


class AppException(Exception):
    """Base application exception with safe error code and status."""
    def __init__(
        self,
        message: str,
        code: str = "INTERNAL_ERROR",
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        details: Optional[List[Any]] = None,
    ):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details or []


class NotFoundError(AppException):
    def __init__(self, message: str = "Resource not found", details: Optional[List[Any]] = None):
        super().__init__(
            message=message,
            code="NOT_FOUND",
            status_code=status.HTTP_404_NOT_FOUND,
            details=details,
        )


class DuplicateResourceError(AppException):
    def __init__(self, message: str = "Resource already exists", details: Optional[List[Any]] = None):
        super().__init__(
            message=message,
            code="DUPLICATE_RESOURCE",
            status_code=status.HTTP_409_CONFLICT,
            details=details,
        )


class ValidationError(AppException):
    def __init__(self, message: str = "Validation failed", details: Optional[List[Any]] = None):
        super().__init__(
            message=message,
            code="VALIDATION_FAILED",
            status_code=getattr(status, "HTTP_422_UNPROCESSABLE_CONTENT", 422),
            details=details,
        )


class UnauthorizedError(AppException):
    def __init__(self, message: str = "Unauthorized request", details: Optional[List[Any]] = None):
        super().__init__(
            message=message,
            code="UNAUTHORIZED",
            status_code=status.HTTP_401_UNAUTHORIZED,
            details=details,
        )


class ForbiddenError(AppException):
    def __init__(self, message: str = "Forbidden action", details: Optional[List[Any]] = None):
        super().__init__(
            message=message,
            code="FORBIDDEN",
            status_code=status.HTTP_403_FORBIDDEN,
            details=details,
        )


class UpstreamServiceError(AppException):
    def __init__(self, message: str = "Upstream service error", details: Optional[List[Any]] = None):
        super().__init__(
            message=message,
            code="UPSTREAM_SERVICE_ERROR",
            status_code=status.HTTP_502_BAD_GATEWAY,
            details=details,
        )


async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    correlation_id = getattr(request.state, "correlation_id", "unknown")
    logger.warning(
        f"Handled application exception: {exc.code} - {exc.message}",
        extra={"correlation_id": correlation_id}
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.code,
                "message": exc.message,
                "correlation_id": correlation_id,
                "details": exc.details,
            }
        },
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    correlation_id = getattr(request.state, "correlation_id", "unknown")
    sanitized_details = []
    for err in exc.errors():
        sanitized_details.append({
            "field": ".".join(str(loc) for loc in err.get("loc", [])),
            "issue": err.get("msg", "Invalid value"),
        })

    logger.info(
        f"Request validation failure on {request.url.path}",
        extra={"correlation_id": correlation_id}
    )

    return JSONResponse(
        status_code=getattr(status, "HTTP_422_UNPROCESSABLE_CONTENT", 422),
        content={
            "error": {
                "code": "VALIDATION_FAILED",
                "message": "The incoming payload failed schema validation.",
                "correlation_id": correlation_id,
                "details": sanitized_details,
            }
        },
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    correlation_id = getattr(request.state, "correlation_id", "unknown")
    logger.error(
        f"Unhandled server error on {request.url.path}: {str(exc)}",
        exc_info=True,
        extra={"correlation_id": correlation_id}
    )

    # Never leak raw stack traces or internal engine errors to users
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred. The incident has been logged with its correlation ID.",
                "correlation_id": correlation_id,
                "details": [],
            }
        },
    )
