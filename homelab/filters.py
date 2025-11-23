from datetime import datetime

def timestamp_to_time(timestamp):
    """Convert timestamp (ms) to formatted date string."""
    if not timestamp:
        return ""
    try:
        # Audiobookshelf uses ms timestamp
        dt = datetime.fromtimestamp(timestamp / 1000)
        return dt.strftime("%Y-%m-%d")
    except:
        return ""
