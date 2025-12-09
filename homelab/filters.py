from datetime import datetime
from homelab.utils.logging_config import get_logger

logger = get_logger(__name__)

def timestamp_to_time(timestamp):
    """Convert timestamp (ms) to formatted date string."""
    if not timestamp:
        return ""
    try:
        # Audiobookshelf uses ms timestamp
        dt = datetime.fromtimestamp(timestamp / 1000)
        return dt.strftime("%Y-%m-%d")
    except (ValueError, TypeError, OSError) as e:
        logger.warning(f"Failed to convert timestamp {timestamp}: {e}")
        return ""
