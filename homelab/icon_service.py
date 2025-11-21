import time
from typing import Dict, List

import requests

ICON_RAW_BASE = "https://raw.githubusercontent.com/homarr-labs/dashboard-icons/main/png/"
ICON_API_URL = "https://api.github.com/repos/homarr-labs/dashboard-icons/contents/png"
ICON_CACHE_TTL = 60 * 60  # 1 hour
DEFAULT_ICON = ICON_RAW_BASE + "homarr.png"

icon_cache: Dict[str, object] = {"icons": [], "fetched_at": 0.0}


def fetch_icon_index() -> List[str]:
    now = time.time()
    if icon_cache["icons"] and now - icon_cache["fetched_at"] < ICON_CACHE_TTL:
        return icon_cache["icons"]  # type: ignore
    try:
        resp = requests.get(ICON_API_URL, timeout=6)
        resp.raise_for_status()
        data = resp.json()
        icons = []
        for item in data:
            if item.get("name", "").lower().endswith(".png"):
                icons.append(item["name"].removesuffix(".png"))
        icon_cache["icons"] = icons
        icon_cache["fetched_at"] = now
        return icons
    except requests.RequestException:
        return icon_cache["icons"] if icon_cache["icons"] else []


def icon_payload(query: str | None = None, limit: int = 50) -> List[dict]:
    icons = fetch_icon_index()
    if query:
        icons = [i for i in icons if query.lower() in i.lower()]
    icons = icons[:limit]
    return [{"name": name, "url": f"{ICON_RAW_BASE}{name}.png"} for name in icons]
