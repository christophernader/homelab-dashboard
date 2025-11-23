"""API routes blueprint for stats, apps, and icons."""

import json
from datetime import datetime, timezone
from flask import Blueprint, render_template, request, jsonify

from homelab.docker_utils import fetch_containers
from homelab.system_stats import system_stats, system_info, human_bytes
from homelab.icon_service import DEFAULT_ICON, icon_payload
from homelab.app_store import apps_with_status, save_app_entry, delete_app, reorder_apps, apply_order

api_bp = Blueprint('api', __name__)


@api_bp.route("/api/stats")
def api_stats():
    """Get system stats partial."""
    from homelab.settings import load_settings
    settings = load_settings()
    containers, docker_error = fetch_containers()
    stats = system_stats()
    partial = render_template(
        "partials/stats.html",
        containers=containers,
        stats=stats,
        docker_error=docker_error,
        human_bytes=human_bytes,
        updated_at=datetime.now(timezone.utc),
        default_icon=DEFAULT_ICON,
        widgets=settings.get('widgets', {}),
    )
    return partial


@api_bp.route("/api/system-info")
def api_system_info():
    """JSON endpoint for system info (used by loading screen)."""
    containers, _ = fetch_containers()
    info = system_info()
    running = sum(1 for c in containers if c.get('status', '').startswith('Up'))
    info['containers_total'] = len(containers)
    info['containers_running'] = running
    return jsonify(info)


@api_bp.route("/api/apps")
def api_apps():
    """Get apps partial."""
    apps = apps_with_status()
    return render_template("partials/apps.html", apps=apps, default_icon=DEFAULT_ICON)


@api_bp.post("/api/apps/add")
def add_app():
    """Add a new app."""
    name = request.form.get("name", "").strip()
    url = request.form.get("url", "").strip()
    icon = request.form.get("icon", "").strip() or DEFAULT_ICON

    if not name or not url:
        error_html = render_template(
            "partials/form_message.html", kind="error", message="Name and URL/IP are required."
        )
        return error_html, 400, {"HX-Retarget": "#form-message", "HX-Reswap": "innerHTML"}

    save_app_entry(name=name, url=url, icon=icon)

    apps = apps_with_status()
    response = render_template("partials/apps.html", apps=apps, default_icon=DEFAULT_ICON)
    return response, 201, {"HX-Trigger": json.dumps({"app_added": name})}


@api_bp.delete("/api/apps/<name>")
def delete_app_route(name: str):
    """Delete an app."""
    if delete_app(name):
        apps = apps_with_status()
        return render_template("partials/apps.html", apps=apps, default_icon=DEFAULT_ICON)
    return "Not found", 404


@api_bp.delete("/api/apps")
def delete_all_apps_route():
    """Delete all apps."""
    from homelab.app_store import delete_all_apps, apps_with_status
    delete_all_apps()
    apps = apps_with_status()
    return render_template("partials/apps.html", apps=apps, default_icon=DEFAULT_ICON)


@api_bp.post("/api/apps/reorder")
def reorder_apps_route():
    """Reorder apps."""
    data = request.get_json()
    if not data:
        return "Bad request", 400
    order = data.get("order")
    if isinstance(order, list) and order:
        apply_order(order)
        return "OK", 200

    from_name = data.get("from")
    to_name = data.get("to")
    position = data.get("position", "before")
    if from_name and to_name:
        reorder_apps(from_name, to_name, position)
        return "OK", 200
    return "Bad request", 400


@api_bp.get("/api/icons/search")
def search_icons():
    """Search for icons."""
    query = request.args.get("q", "").strip().lower()
    icons = icon_payload(query=query or None, limit=50)
    return render_template("partials/icon_results.html", icons=icons, query=query)


@api_bp.get("/api/apps/autodiscover")
def autodiscover_apps():
    """Scan for Docker apps and return potential matches."""
    from homelab.docker_utils import scan_docker_apps
    apps = scan_docker_apps()
    return jsonify(apps)


@api_bp.post("/api/apps/import")
def import_apps():
    """Import selected apps."""
    from homelab.app_store import merge_apps, apps_with_status
    
    data = request.get_json()
    if not data or not isinstance(data, list):
        return "Bad request", 400
        
    count = merge_apps(data)
    
    # Return updated grid
    apps = apps_with_status()
    response = render_template("partials/apps.html", apps=apps, default_icon=DEFAULT_ICON)
    return response, 200, {"HX-Trigger": json.dumps({"apps_imported": count})}


@api_bp.get("/api/apps/<name>")
def get_app_details(name: str):
    """Get app details."""
    from homelab.app_store import get_app
    app = get_app(name)
    if not app:
        return "Not found", 404
    return jsonify(app)


@api_bp.put("/api/apps/<name>")
def update_app_details(name: str):
    """Update app details."""
    from homelab.app_store import update_app, apps_with_status
    
    data = request.form.to_dict()
    if not update_app(name, data):
        return "Update failed or name conflict", 400
        
    apps = apps_with_status()
    response = render_template("partials/apps.html", apps=apps, default_icon=DEFAULT_ICON)
    return response, 200, {"HX-Trigger": json.dumps({"app_updated": name})}
