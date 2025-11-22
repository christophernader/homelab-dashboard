"""Caching utility for widgets."""
import time
from collections import OrderedDict
from threading import Lock

# Cache timeout in seconds
CACHE_TIMEOUT = 300  # 5 minutes
MAX_CACHE_SIZE = 50  # Maximum number of cached items
_cache = OrderedDict()
_cache_lock = Lock()


def get_cached(key: str, fetcher, timeout: int = CACHE_TIMEOUT):
    """Thread-safe time-based cache with LRU eviction."""
    now = time.time()

    with _cache_lock:
        if key in _cache:
            data, timestamp = _cache[key]
            if now - timestamp < timeout:
                # Move to end (most recently used)
                _cache.move_to_end(key)
                return data

    try:
        data = fetcher()
        with _cache_lock:
            _cache[key] = (data, now)
            _cache.move_to_end(key)
            # Evict oldest items if cache is too large
            while len(_cache) > MAX_CACHE_SIZE:
                _cache.popitem(last=False)
        return data
    except Exception:
        # Return stale cache if available
        with _cache_lock:
            if key in _cache:
                return _cache[key][0]
        return None
