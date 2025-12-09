"""
Homelab Dashboard - Main Application Entry Point

A Flask-based homelab dashboard with military/tactical aesthetic.
Features real-time system monitoring, Docker container management,
service bookmarks, and various integrations.
"""

import os
import requests
requests.packages.urllib3.disable_warnings()

from flask import Flask
from flask_sock import Sock
from pathlib import Path

# Set up logging first
from homelab.utils.logging_config import setup_logging
log_level = os.environ.get('LOG_LEVEL', 'INFO')
log_file = Path('data') / 'dashboard.log' if os.environ.get('LOG_TO_FILE') == 'true' else None
setup_logging(level=log_level, log_file=log_file)

# Import blueprints
from homelab.routes import main_bp, api_bp, settings_bp, widgets_bp

# Import terminal service
from homelab.services.terminal import handle_terminal_websocket


def create_app():
    """Application factory for creating the Flask app."""
    app = Flask(__name__)

    # Register blueprints
    app.register_blueprint(main_bp)
    app.register_blueprint(api_bp)
    app.register_blueprint(settings_bp)
    app.register_blueprint(widgets_bp)

    # Register filters
    from homelab.filters import timestamp_to_time
    app.add_template_filter(timestamp_to_time)

    return app


# Create app instance
app = create_app()
sock = Sock(app)


@sock.route('/terminal')
def terminal_websocket(ws):
    """WebSocket endpoint for terminal access."""
    handle_terminal_websocket(ws)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5050))
    app.run(host="0.0.0.0", port=port)
