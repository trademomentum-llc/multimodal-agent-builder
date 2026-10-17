"""Logging and error handling utilities."""

import json
import logging
import sys
from datetime import datetime
from typing import Any

from config.config import settings


class ColoredFormatter(logging.Formatter):
    """Custom formatter with colors for terminal output."""

    COLORS = {
        "DEBUG": "\033[36m",  # Cyan
        "INFO": "\033[32m",  # Green
        "WARNING": "\033[33m",  # Yellow
        "ERROR": "\033[31m",  # Red
        "CRITICAL": "\033[35m",  # Magenta
    }
    RESET = "\033[0m"

    def format(self, record):
        log_color = self.COLORS.get(record.levelname, self.RESET)
        record.levelname = f"{log_color}{record.levelname}{self.RESET}"
        return super().format(record)


class JSONFormatter(logging.Formatter):
    """JSON formatter for structured logging."""

    def format(self, record):
        log_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }

        # Add exception info if present
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)

        # Add extra fields
        for key, value in record.__dict__.items():
            if key not in [
                "name",
                "msg",
                "args",
                "created",
                "filename",
                "funcName",
                "levelname",
                "levelno",
                "lineno",
                "module",
                "msecs",
                "pathname",
                "process",
                "processName",
                "relativeCreated",
                "thread",
                "threadName",
                "exc_info",
                "exc_text",
                "stack_info",
            ]:
                log_data[key] = value

        return json.dumps(log_data)


def setup_logger(
    name: str = "multimodal_agent",
    level: str | None = None,
    log_file: str | None = None,
    format_type: str | None = None,
) -> logging.Logger:
    """Setup a logger with configured handlers.

    Args:
        name: Logger name
        level: Log level (uses settings default if None)
        log_file: Optional log file path
        format_type: 'json' or 'plain' (uses settings default if None)

    Returns:
        Configured logger

    """
    logger = logging.getLogger(name)

    # Use settings defaults if not provided
    level = level or settings.log_level
    format_type = format_type or settings.log_format

    logger.setLevel(getattr(logging, level.upper()))

    # Remove existing handlers
    logger.handlers = []

    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(getattr(logging, level.upper()))

    # Choose formatter
    if format_type == "json":
        formatter = JSONFormatter()
    else:
        if sys.stdout.isatty():  # Use colors if terminal
            formatter = ColoredFormatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
        else:
            formatter = logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")

    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

    # File handler if specified
    if log_file:
        file_handler = logging.FileHandler(log_file)
        file_handler.setLevel(getattr(logging, level.upper()))

        # Always use JSON format for file logs
        file_formatter = JSONFormatter()
        file_handler.setFormatter(file_formatter)
        logger.addHandler(file_handler)

    return logger


def get_agent_logger(agent_id: str) -> logging.Logger:
    """Get a logger for a specific agent.

    Args:
        agent_id: Agent identifier

    Returns:
        Logger for the agent

    """
    return setup_logger(f"agent.{agent_id}")


def log_api_request(
    logger: logging.Logger,
    method: str,
    endpoint: str,
    data: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
):
    """Log an API request.

    Args:
        logger: Logger to use
        method: HTTP method
        endpoint: API endpoint
        data: Request data
        headers: Request headers

    """
    logger.info(
        "API Request",
        extra={
            "http_method": method,
            "endpoint": endpoint,
            "request_data": data,
            "headers": {
                k: v
                for k, v in (headers or {}).items()
                if k.lower() not in ["authorization", "api-key"]
            },
        },
    )


def log_api_response(
    logger: logging.Logger,
    status_code: int,
    response_data: Any | None = None,
    error: str | None = None,
):
    """Log an API response.

    Args:
        logger: Logger to use
        status_code: HTTP status code
        response_data: Response data
        error: Error message if any

    """
    if error:
        logger.error("API Error", extra={"status_code": status_code, "error": error})
    else:
        logger.info(
            "API Response", extra={"status_code": status_code, "response_data": response_data}
        )


def log_agent_action(
    logger: logging.Logger,
    agent_id: str,
    action: str,
    input_data: Any,
    output_data: Any,
    duration_ms: float | None = None,
):
    """Log an agent action.

    Args:
        logger: Logger to use
        agent_id: Agent identifier
        action: Action type
        input_data: Input to the action
        output_data: Output from the action
        duration_ms: Duration in milliseconds

    """
    logger.info(
        f"Agent action: {action}",
        extra={
            "agent_id": agent_id,
            "action": action,
            "input": input_data,
            "output": output_data,
            "duration_ms": duration_ms,
        },
    )


def log_model_usage(
    logger: logging.Logger,
    provider: str,
    model: str,
    prompt_tokens: int,
    completion_tokens: int,
    total_tokens: int,
    cost: float | None = None,
):
    """Log model token usage.

    Args:
        logger: Logger to use
        provider: LLM provider
        model: Model name
        prompt_tokens: Number of prompt tokens
        completion_tokens: Number of completion tokens
        total_tokens: Total tokens
        cost: Optional cost estimate

    """
    logger.info(
        "Model usage",
        extra={
            "provider": provider,
            "model": model,
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": total_tokens,
            "estimated_cost": cost,
        },
    )


class ErrorTracker:
    """Track and analyze errors."""

    def __init__(self, max_errors: int = 100):
        """Initialize error tracker.

        Args:
            max_errors: Maximum number of errors to track

        """
        self.errors = []
        self.max_errors = max_errors
        self.error_counts = {}

    def track_error(self, error: Exception, context: dict[str, Any] | None = None):
        """Track an error.

        Args:
            error: Exception that occurred
            context: Additional context

        """
        error_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "type": type(error).__name__,
            "message": str(error),
            "context": context or {},
        }

        self.errors.append(error_data)

        # Keep only max_errors
        if len(self.errors) > self.max_errors:
            self.errors = self.errors[-self.max_errors :]

        # Update counts
        error_type = type(error).__name__
        self.error_counts[error_type] = self.error_counts.get(error_type, 0) + 1

    def get_summary(self) -> dict[str, Any]:
        """Get error summary.

        Returns:
            Summary of tracked errors

        """
        return {
            "total_errors": len(self.errors),
            "error_types": self.error_counts,
            "recent_errors": self.errors[-10:] if self.errors else [],
        }

    def clear(self):
        """Clear all tracked errors."""
        self.errors = []
        self.error_counts = {}


# Global logger and error tracker
logger = setup_logger()
error_tracker = ErrorTracker()


def handle_exception(
    exc: Exception, context: dict[str, Any] | None = None, reraise: bool = True
):
    """Handle an exception with logging and tracking.

    Args:
        exc: Exception to handle
        context: Additional context
        reraise: Whether to reraise the exception

    """
    logger.error(f"Exception occurred: {exc}", exc_info=True, extra={"context": context})

    error_tracker.track_error(exc, context)

    if reraise:
        raise
