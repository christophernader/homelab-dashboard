"""Main page routes blueprint."""

from datetime import datetime, timezone
from flask import Blueprint, render_template

from homelab.docker_utils import fetch_containers
from homelab.system_stats import system_stats, human_bytes
from homelab.icon_service import DEFAULT_ICON
from homelab.app_store import apps_with_status
from homelab.settings import load_settings

main_bp = Blueprint('main', __name__)


@main_bp.route("/")
def index():
    """Main dashboard page."""
    containers, docker_error = fetch_containers()
    stats = system_stats()
    apps = apps_with_status()
    settings = load_settings()
    integrations = settings.get('integrations', {})
    location = settings.get('location', {})
    appearance = settings.get('appearance', {})
    return render_template(
        "index.html",
        containers=containers,
        stats=stats,
        docker_error=docker_error,
        human_bytes=human_bytes,
        updated_at=datetime.now(timezone.utc),
        apps=apps,
        default_icon=DEFAULT_ICON,
        integrations=integrations,
        location=location,
        appearance=appearance,
    )
