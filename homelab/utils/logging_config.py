"""
Centralized logging configuration for the homelab dashboard.

Provides structured logging with consistent formatting and log levels.
Replaces bare except clauses and silent error handling.
"""

import logging
import sys
from pathlib import Path
from typing import Optional

# Log format: timestamp [LEVEL] module:function - message
LOG_FORMAT = '%(asctime)s [%(levelname)s] %(name)s:%(funcName)s - %(message)s'
DATE_FORMAT = '%Y-%m-%d %H:%M:%S'


def setup_logging(
    level: str = 'INFO',
    log_file: Optional[Path] = None,
    enable_console: bool = True
) -> None:
    """
    Configure application-wide logging.

    Args:
        level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        log_file: Optional file path for log output
        enable_console: Whether to log to console/stdout
    """
    # Convert string level to logging constant
    numeric_level = getattr(logging, level.upper(), logging.INFO)

    # Create root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(numeric_level)

    # Clear existing handlers to avoid duplicates
    root_logger.handlers.clear()

    # Create formatter
    formatter = logging.Formatter(LOG_FORMAT, datefmt=DATE_FORMAT)

    # Console handler
    if enable_console:
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(numeric_level)
        console_handler.setFormatter(formatter)
        root_logger.addHandler(console_handler)

    # File handler (if specified)
    if log_file:
        log_file.parent.mkdir(parents=True, exist_ok=True)
        file_handler = logging.FileHandler(log_file, encoding='utf-8')
        file_handler.setLevel(numeric_level)
        file_handler.setFormatter(formatter)
        root_logger.addHandler(file_handler)


def get_logger(name: str) -> logging.Logger:
    """
    Get a logger instance for a specific module.

    Args:
        name: Module name (typically __name__)

    Returns:
        Configured logger instance

    Example:
        logger = get_logger(__name__)
        logger.info("Application started")
        logger.error("Failed to connect", exc_info=True)
    """
    return logging.getLogger(name)


# Convenience functions for common logging patterns

def log_exception(logger: logging.Logger, message: str, exc: Exception) -> None:
    """
    Log an exception with full traceback.

    Replacement for bare except clauses.

    Args:
        logger: Logger instance
        message: Context message
        exc: Exception instance
    """
    logger.error(f"{message}: {type(exc).__name__}: {str(exc)}", exc_info=True)


def log_integration_error(
    logger: logging.Logger,
    integration_name: str,
    operation: str,
    error: Exception
) -> None:
    """
    Log integration-specific errors with consistent formatting.

    Args:
        logger: Logger instance
        integration_name: Name of the integration (e.g., "pihole", "proxmox")
        operation: What was being attempted (e.g., "fetch stats", "authenticate")
        error: Exception that occurred
    """
    logger.error(
        f"[{integration_name}] Failed to {operation}: {type(error).__name__}: {str(error)}",
        exc_info=True
    )


def log_api_request(
    logger: logging.Logger,
    method: str,
    endpoint: str,
    status_code: Optional[int] = None,
    duration_ms: Optional[float] = None
) -> None:
    """
    Log API request with optional timing information.

    Args:
        logger: Logger instance
        method: HTTP method (GET, POST, etc.)
        endpoint: API endpoint path
        status_code: HTTP response status code
        duration_ms: Request duration in milliseconds
    """
    parts = [f"{method} {endpoint}"]
    if status_code is not None:
        parts.append(f"→ {status_code}")
    if duration_ms is not None:
        parts.append(f"({duration_ms:.2f}ms)")

    logger.info(" ".join(parts))
