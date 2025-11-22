"""Route blueprints for the homelab dashboard."""

from homelab.routes.main import main_bp
from homelab.routes.api import api_bp
from homelab.routes.settings_routes import settings_bp
from homelab.routes.widgets import widgets_bp

__all__ = ['main_bp', 'api_bp', 'settings_bp', 'widgets_bp']
