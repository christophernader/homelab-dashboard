"""Service for checking URL status."""

import time
from typing import Tuple

import requests


def normalize_url(url: str) -> str:
    """Normalize URL by adding http:// if missing."""
    if not url:
        return ""
    if url.startswith(("http://", "https://")):
        return url
    return f"http://{url}"


def check_url_online(url: str) -> Tuple[bool, int]:
    """Check if URL is online and return (online, response_time_ms)."""
    target = normalize_url(url)
    if not target:
        return False, 0

    start = time.time()
    try:
        resp = requests.head(target, timeout=2, allow_redirects=True, verify=False)
        elapsed = int((time.time() - start) * 1000)
        if resp.status_code < 400:
            return True, elapsed
    except requests.RequestException:
        pass

    start = time.time()
    try:
        resp = requests.get(target, timeout=3, stream=True, allow_redirects=True, verify=False)
        elapsed = int((time.time() - start) * 1000)
        return resp.status_code < 400, elapsed
    except requests.RequestException:
        return False, 0
