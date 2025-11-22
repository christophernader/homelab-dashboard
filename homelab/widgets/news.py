"""News widget data fetching."""
import requests
from homelab.utils.cache import get_cached

def get_hacker_news(limit: int = 5) -> list[dict] | None:
    """Get top stories from Hacker News (free, no API key)."""
    def fetch():
        # Get top story IDs
        resp = requests.get(
            "https://hacker-news.firebaseio.com/v0/topstories.json",
            timeout=5
        )
        resp.raise_for_status()
        story_ids = resp.json()[:limit]

        stories = []
        for sid in story_ids:
            story_resp = requests.get(
                f"https://hacker-news.firebaseio.com/v0/item/{sid}.json",
                timeout=3
            )
            if story_resp.ok:
                story = story_resp.json()
                stories.append({
                    "title": story.get("title", ""),
                    "url": story.get("url", f"https://news.ycombinator.com/item?id={sid}"),
                    "score": story.get("score", 0),
                    "comments": story.get("descendants", 0),
                    "hn_url": f"https://news.ycombinator.com/item?id={sid}",
                })
        return stories

    return get_cached("hackernews", fetch, timeout=300)  # 5 min cache


def get_world_headlines(limit: int = 10) -> list[dict] | None:
    """Get world news headlines from various free sources."""
    def fetch():
        headlines = []

        # Try Reddit worldnews
        try:
            resp = requests.get(
                "https://www.reddit.com/r/worldnews/hot.json?limit=15",
                timeout=5,
                headers={"User-Agent": "HomelabDashboard/1.0"}
            )
            if resp.ok:
                data = resp.json()
                for item in data.get("data", {}).get("children", []):
                    post = item.get("data", {})
                    if not post.get("stickied") and post.get("score", 0) > 1000:
                        # Get the actual article URL, not Reddit link
                        url = post.get("url", "")
                        if not url or "reddit.com" in url:
                            url = f"https://reddit.com{post.get('permalink', '')}"
                        headlines.append({
                            "title": post.get("title", "")[:120],
                            "url": url,
                            "source": "Reddit",
                        })
        except Exception:
            pass

        # Try HN for tech news
        try:
            resp = requests.get(
                "https://hacker-news.firebaseio.com/v0/topstories.json",
                timeout=5
            )
            if resp.ok:
                for sid in resp.json()[:5]:
                    story_resp = requests.get(
                        f"https://hacker-news.firebaseio.com/v0/item/{sid}.json",
                        timeout=3
                    )
                    if story_resp.ok:
                        story = story_resp.json()
                        if story.get("score", 0) > 100:
                            # Get story URL or fallback to HN comments
                            url = story.get("url", f"https://news.ycombinator.com/item?id={sid}")
                            headlines.append({
                                "title": story.get("title", "")[:120],
                                "url": url,
                                "source": "HN",
                            })
        except Exception:
            pass

        return headlines[:limit] if headlines else None

    return get_cached("headlines", fetch, timeout=300)
