import json
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import List, Tuple

import requests

DATA_DIR = Path("data")
APPS_FILE = DATA_DIR / "apps.json"
write_pool = ThreadPoolExecutor(max_workers=1)


def ensure_data_file() -> None:
    DATA_DIR.mkdir(exist_ok=True)
    if not APPS_FILE.exists():
        APPS_FILE.write_text("[]", encoding="utf-8")


def load_apps() -> List[dict]:
    ensure_data_file()
    try:
        return json.loads(APPS_FILE.read_text(encoding="utf-8"))
    except Exception:
        return []


def save_apps(apps: List[dict]) -> None:
    ensure_data_file()
    APPS_FILE.write_text(json.dumps(apps, indent=2), encoding="utf-8")


from homelab.services.status import check_url_online, normalize_url


def apps_with_status() -> List[dict]:
    apps = load_apps()
    if not apps:
        return []

    results: List[dict] = []
    with ThreadPoolExecutor(max_workers=min(8, len(apps))) as pool:
        future_map = {pool.submit(check_url_online, app.get("url", "")): app for app in apps}
        for future in as_completed(future_map):
            base_app = future_map[future]
            online = False
            response_time = 0
            try:
                online, response_time = future.result()
            except Exception:
                online = False
                response_time = 0
            result_app = {**base_app, "online": online, "response_time": response_time}
            results.append(result_app)

    lookup = {item.get("name"): item for item in results if item.get("name")}
    ordered = []
    for app in apps:
        name = app.get("name")
        ordered.append(lookup.get(name, {**app, "online": False, "response_time": 0}))
    return ordered


def save_app_entry(name: str, url: str, icon: str) -> None:
    def write():
        current = load_apps()
        current = [c for c in current if c.get("name") != name]
        current.append({"name": name, "url": normalize_url(url), "icon": icon})
        save_apps(current)

    write_pool.submit(write).result()


def delete_app(name: str) -> bool:
    """Delete an app by name. Returns True if deleted."""
    def write():
        current = load_apps()
        new_list = [c for c in current if c.get("name") != name]
        if len(new_list) < len(current):
            save_apps(new_list)
            return True
        return False

    return write_pool.submit(write).result()


def delete_all_apps() -> bool:
    """Delete all apps."""
    def write():
        save_apps([])
        return True
    return write_pool.submit(write).result()


def reorder_apps(from_name: str, to_name: str, position: str = "before") -> bool:
    """Move app to before or after another app."""
    def write():
        current = load_apps()
        from_idx = None
        to_idx = None

        for i, app in enumerate(current):
            if app.get("name") == from_name:
                from_idx = i
            if app.get("name") == to_name:
                to_idx = i

        if from_idx is None or to_idx is None:
            return False

        # Remove from original position
        app = current.pop(from_idx)

        # Recalculate to_idx after removal
        for i, a in enumerate(current):
            if a.get("name") == to_name:
                to_idx = i
                break

        # Insert at new position
        if position == "after":
            current.insert(to_idx + 1, app)
        else:
            current.insert(to_idx, app)

        save_apps(current)
        return True

    return write_pool.submit(write).result()


def apply_order(order: list[str]) -> bool:
    """Persist a full ordering of apps by name."""
    if not order:
        return False

    def write():
        current = load_apps()
        name_to_app = {app.get("name"): app for app in current if app.get("name")}
        new_list = []

        # de-dupe while preserving requested order
        seen = set()
        for name in order:
            if name in seen:
                continue
            seen.add(name)
            app = name_to_app.get(name)
            if app:
                new_list.append(app)

        # Append any apps not in order to the end to avoid data loss
        for app in current:
            if app.get("name") not in order:
                new_list.append(app)

        if new_list:
            save_apps(new_list)
            return True
        return False

    return write_pool.submit(write).result()


def merge_apps(new_apps: List[dict]) -> int:
    """Merge new apps into the store, avoiding duplicates. Returns count added."""
    def write():
        current = load_apps()
        existing_urls = {normalize_url(a.get("url", "")) for a in current}
        existing_names = {a.get("name", "").lower() for a in current}
        
        added_count = 0
        for app in new_apps:
            url = normalize_url(app.get("url", ""))
            name = app.get("name", "")
            
            # Skip if URL or Name already exists
            if url in existing_urls or name.lower() in existing_names:
                continue
                
            current.append({
                "name": name,
                "url": url,
                "icon": app.get("icon", "")
            })
            existing_urls.add(url)
            existing_names.add(name.lower())
            added_count += 1
            
        if added_count > 0:
            save_apps(current)
        return added_count

    return write_pool.submit(write).result()


def update_app(original_name: str, new_data: dict) -> bool:
    """Update an existing app."""
    def write():
        current = load_apps()
        
        # Check if renaming to an existing name (conflict check)
        new_name = new_data.get("name")
        if new_name and new_name != original_name:
            if any(a.get("name") == new_name for a in current):
                return False # Name conflict

        updated = False
        for app in current:
            if app.get("name") == original_name:
                app["name"] = new_data.get("name", app["name"])
                app["url"] = normalize_url(new_data.get("url", app["url"]))
                app["icon"] = new_data.get("icon", app["icon"])
                updated = True
                break
        
        if updated:
            save_apps(current)
            return True
        return False

    return write_pool.submit(write).result()


def get_app(name: str) -> dict | None:
    """Get a single app by name."""
    apps = load_apps()
    for app in apps:
        if app.get("name") == name:
            return app
    return None
