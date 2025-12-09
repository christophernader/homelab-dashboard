"""
HTTP utilities for making requests with proper SSL handling and logging.
"""

import os
import requests
from typing import Optional, Dict, Any
from .logging_config import get_logger

logger = get_logger(__name__)

# Global SSL verification setting (can be overridden via environment variable)
# Default to True (secure), but allow disabling for development/self-signed certs
VERIFY_SSL = os.environ.get('VERIFY_SSL', 'true').lower() in ('true', '1', 'yes')

if not VERIFY_SSL:
    logger.warning("SSL verification is DISABLED. This is insecure and should only be used in development.")
    # Suppress only the InsecureRequestWarning, not all warnings
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


def get_session(verify_ssl: Optional[bool] = None) -> requests.Session:
    """
    Create a requests Session with proper SSL configuration.

    Args:
        verify_ssl: Override the global SSL verification setting.
                   If None, uses the VERIFY_SSL environment variable.

    Returns:
        Configured requests.Session instance
    """
    session = requests.Session()
    session.verify = verify_ssl if verify_ssl is not None else VERIFY_SSL
    return session


def make_request(
    method: str,
    url: str,
    timeout: int = 10,
    verify_ssl: Optional[bool] = None,
    **kwargs
) -> Optional[requests.Response]:
    """
    Make an HTTP request with proper error handling and logging.

    Args:
        method: HTTP method (GET, POST, etc.)
        url: URL to request
        timeout: Request timeout in seconds
        verify_ssl: Override SSL verification (None = use global setting)
        **kwargs: Additional arguments to pass to requests

    Returns:
        Response object if successful, None otherwise

    Example:
        response = make_request('GET', 'https://api.example.com/data')
        if response and response.ok:
            data = response.json()
    """
    verify = verify_ssl if verify_ssl is not None else VERIFY_SSL

    try:
        response = requests.request(
            method=method,
            url=url,
            timeout=timeout,
            verify=verify,
            **kwargs
        )
        return response
    except requests.Timeout:
        logger.error(f"{method} {url} - Request timeout after {timeout}s")
        return None
    except requests.ConnectionError as e:
        logger.error(f"{method} {url} - Connection error: {e}")
        return None
    except requests.RequestException as e:
        logger.error(f"{method} {url} - Request failed: {e}")
        return None


def get_ssl_setting() -> bool:
    """
    Get the current SSL verification setting.

    Returns:
        True if SSL verification is enabled, False otherwise
    """
    return VERIFY_SSL
