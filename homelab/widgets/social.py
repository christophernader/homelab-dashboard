"""Social widget data fetching."""
import requests
import time
from homelab.utils.cache import get_cached

def get_reddit_top(subreddit: str = "technology", limit: int = 5) -> list[dict] | None:
    """Get top posts from a subreddit (free, no API key for public data)."""
    def fetch():
        url = f"https://www.reddit.com/r/{subreddit}/hot.json?limit={limit + 5}"
        resp = requests.get(
            url,
            timeout=5,
            headers={"User-Agent": "HomelabDashboard/1.0"}
        )
        resp.raise_for_status()
        data = resp.json()

        posts = []
        for item in data.get("data", {}).get("children", []):
            post = item.get("data", {})
            if post.get("stickied"):
                continue
            created = post.get("created_utc", 0)
            posts.append({
                "title": post.get("title", "")[:100],
                "url": post.get("url", ""),
                "score": post.get("score", 0),
                "comments": post.get("num_comments", 0),
                "subreddit": post.get("subreddit", subreddit),
                "reddit_url": f"https://reddit.com{post.get('permalink', '')}",
                "time_ago": _time_ago(created) if created else "",
            })
        return posts[:limit]

    return get_cached(f"reddit_{subreddit}", fetch, timeout=300)


def _time_ago(timestamp: float) -> str:
    """Convert Unix timestamp to human-readable time ago."""
    now = time.time()
    diff = now - timestamp
    if diff < 60:
        return "just now"
    elif diff < 3600:
        mins = int(diff / 60)
        return f"{mins}m ago"
    elif diff < 86400:
        hours = int(diff / 3600)
        return f"{hours}h ago"
    else:
        days = int(diff / 86400)
        return f"{days}d ago"
