import json
import logging
import re
from typing import Any, Dict


# Regex patterns targeting secrets in messages or structures
SENSITIVE_PATTERNS = [
    (re.compile(r'(?i)(bearer\s+)[a-zA-Z0-9_\-\.]{15,}'), r'\1[REDACTED_TOKEN]'),
    (re.compile(r'(?i)(["\']?(?:api[_-]?key|secret|password|auth(?:orization)?|token)["\']?\s*[:=]\s*["\'])([^"\']+)'), r'\1[REDACTED]'),
    (re.compile(r'(?i)(postgres(?:ql)?:\/\/[^:]+:)([^@]+)(@)'), r'\1[REDACTED_PASSWORD]\3'),
]


def redact_sensitive_string(text: str) -> str:
    """Scrub sensitive credentials, passwords, and tokens from log strings."""
    redacted = text
    for pattern, replacement in SENSITIVE_PATTERNS:
        redacted = pattern.sub(replacement, redacted)
    return redacted


class SensitiveDataFilter(logging.Filter):
    """Logging filter that scrubs sensitive credentials from record arguments."""
    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, str):
            record.msg = redact_sensitive_string(record.msg)
        if record.args:
            if isinstance(record.args, dict):
                record.args = {
                    k: redact_sensitive_string(str(v)) if isinstance(v, str) else v
                    for k, v in record.args.items()
                }
            elif isinstance(record.args, tuple):
                record.args = tuple(
                    redact_sensitive_string(str(arg)) if isinstance(arg, str) else arg
                    for arg in record.args
                )
        return True


class JsonFormatter(logging.Formatter):
    """Production JSON log formatter with correlation ID context."""
    def format(self, record: logging.LogRecord) -> str:
        log_entry: Dict[str, Any] = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "correlation_id": getattr(record, "correlation_id", "none"),
        }
        if record.exc_info:
            # We preserve exception type and message, but avoid leaking secrets
            exc_text = self.formatException(record.exc_info)
            log_entry["exception"] = redact_sensitive_string(exc_text)

        return json.dumps(log_entry)


def setup_logger(name: str = "lead_operations", level: int = logging.INFO) -> logging.Logger:
    logger = logging.getLogger(name)
    logger.setLevel(level)

    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(JsonFormatter())
        handler.addFilter(SensitiveDataFilter())
        logger.addHandler(handler)

    return logger


logger = setup_logger()
