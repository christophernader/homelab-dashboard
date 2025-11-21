import time
from typing import Dict, List
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests

# Icon sources - homarr-labs and IceWhaleTech
ICON_SOURCES = [
    {
        "name": "homarr",
        "raw_base": "https://raw.githubusercontent.com/homarr-labs/dashboard-icons/main/png/",
        "api_url": "https://api.github.com/repos/homarr-labs/dashboard-icons/contents/png",
    },
    {
        "name": "icewhale",
        "raw_base": "https://raw.githubusercontent.com/IceWhaleTech/AppIcon/main/all/",
        "api_url": "https://api.github.com/repos/IceWhaleTech/AppIcon/contents/all",
    },
]

ICON_CACHE_TTL = 60 * 60  # 1 hour
DEFAULT_ICON = "https://raw.githubusercontent.com/homarr-labs/dashboard-icons/main/png/homarr.png"

icon_cache: Dict[str, object] = {"icons": [], "fetched_at": 0.0}


def _fetch_from_source(source: dict) -> List[dict]:
    """Fetch icons from a single source."""
    try:
        resp = requests.get(source["api_url"], timeout=8)
        resp.raise_for_status()
        data = resp.json()
        icons = []
        for item in data:
            name = item.get("name", "")
            if name.lower().endswith(".png"):
                icon_name = name.removesuffix(".png")
                icons.append({
                    "name": icon_name,
                    "url": f"{source['raw_base']}{name}",
                    "source": source["name"],
                })
        return icons
    except requests.RequestException:
        return []


def fetch_icon_index() -> List[dict]:
    """Fetch icons from all sources with parallel requests."""
    now = time.time()
    if icon_cache["icons"] and now - icon_cache["fetched_at"] < ICON_CACHE_TTL:
        return icon_cache["icons"]  # type: ignore

    all_icons = []
    seen_names = set()

    # Fetch from all sources in parallel
    with ThreadPoolExecutor(max_workers=len(ICON_SOURCES)) as executor:
        futures = {executor.submit(_fetch_from_source, src): src for src in ICON_SOURCES}
        for future in as_completed(futures):
            try:
                icons = future.result()
                for icon in icons:
                    # Deduplicate by name (prefer first source)
                    if icon["name"].lower() not in seen_names:
                        seen_names.add(icon["name"].lower())
                        all_icons.append(icon)
            except Exception:
                pass

    # Sort alphabetically
    all_icons.sort(key=lambda x: x["name"].lower())

    if all_icons:
        icon_cache["icons"] = all_icons
        icon_cache["fetched_at"] = now

    return all_icons if all_icons else (icon_cache["icons"] if icon_cache["icons"] else [])


def icon_payload(query: str | None = None, limit: int = 50) -> List[dict]:
    """Return icons matching query."""
    icons = fetch_icon_index()
    if query:
        icons = [i for i in icons if query.lower() in i["name"].lower()]
    return icons[:limit]
