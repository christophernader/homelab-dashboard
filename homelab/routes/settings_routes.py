"""Settings routes blueprint."""

from flask import Blueprint, render_template, request, jsonify

from homelab.settings import (
    load_settings, get_setting, set_setting,
    get_widget_config, set_widget_enabled,
    get_integration_config, update_integration,
    get_themes, get_theme_colors, save_settings
)
from homelab.integrations import (
    get_pihole_stats, get_portainer_stats, get_proxmox_stats,
    get_speedtest_results, get_uptime_kuma_stats,
    get_audiobookshelf_stats
)

settings_bp = Blueprint('settings', __name__)


@settings_bp.route("/settings")
def settings_page():
    """Settings page for customization."""
    settings = load_settings()
    themes = get_themes()
    return render_template("settings.html", settings=settings, themes=themes)


@settings_bp.get("/api/themes")
def list_themes():
    """Get all available themes."""
    return jsonify(get_themes())


@settings_bp.get("/api/theme/<name>")
def get_theme(name: str):
    """Get a specific theme's colors."""
    colors = get_theme_colors(name)
    return jsonify(colors)


@settings_bp.post("/api/settings/theme")
def set_theme():
    """Set the active theme."""
    theme_name = request.form.get('theme', 'military')
    themes = get_themes()
    if theme_name not in themes:
        return {"status": "error", "message": "Unknown theme"}, 400
    set_setting('appearance.theme', theme_name)
    return {"status": "ok", "theme": theme_name, "message": f"Theme set to {themes[theme_name]['name']}"}, 200


@settings_bp.post("/api/settings/location")
def save_location():
    """Save location settings."""
    settings = load_settings()
    if 'location' not in settings:
        settings['location'] = {}

    settings['location']['city'] = request.form.get('city', '')
    settings['location']['latitude'] = request.form.get('latitude', '')
    settings['location']['longitude'] = request.form.get('longitude', '')
    settings['location']['use_auto'] = request.form.get('use_auto', 'false').lower() == 'true'

    save_settings(settings)
    return {"status": "ok", "message": "Location saved"}, 200


@settings_bp.post("/api/settings/widget/<name>/toggle")
def toggle_widget(name: str):
    """Toggle a widget on/off."""
    current = get_widget_config(name).get('enabled', True)
    set_widget_enabled(name, not current)
    new_state = "enabled" if not current else "disabled"
    return {"status": "ok", "widget": name, "enabled": not current, "message": f"{name} {new_state}"}, 200


@settings_bp.post("/api/settings/integration/<name>/toggle")
def toggle_integration(name: str):
    """Toggle an integration on/off."""
    config = get_integration_config(name) or {}
    new_state = not config.get('enabled', False)
    update_integration(name, {'enabled': new_state})
    return {"status": "ok", "integration": name, "enabled": new_state}, 200


@settings_bp.post("/api/settings/integration/<name>")
def save_integration(name: str):
    """Save integration configuration."""
    config = {}
    for key in ['url', 'api_key', 'user', 'token_name', 'token_secret', 'slug']:
        if key in request.form:
            config[key] = request.form[key]
    update_integration(name, config)
    return {"status": "ok", "message": f"{name} configuration saved"}, 200


@settings_bp.post("/api/settings/integration/<name>/test")
def test_integration(name: str):
    """Test an integration connection."""
    testers = {
        'pihole': get_pihole_stats,
        'portainer': get_portainer_stats,
        'proxmox': get_proxmox_stats,
        'speedtest': get_speedtest_results,
        'uptime_kuma': get_uptime_kuma_stats,
        'audiobookshelf': get_audiobookshelf_stats,
    }
    tester = testers.get(name)
    if not tester:
        return {"status": "error", "message": "Unknown integration"}, 400

    # Construct config from form data for testing
    config = {}
    for key in ['url', 'api_key', 'user', 'token_name', 'token_secret', 'slug']:
        if key in request.form:
            config[key] = request.form[key]
    config['enabled'] = True # Assume enabled for testing

    # Pass config to tester (all integrations now support config_override)
    try:
        result = tester(config)
    except TypeError:
        # Fallback for any tester that might not support arguments yet (safety check)
        result = tester()
    if result and result.get('status') != 'error':
        return {"status": "ok", "message": "Connection successful"}, 200
    return {"status": "error", "message": result.get('error', 'Connection failed') if result else "Connection failed"}, 400


@settings_bp.post("/api/settings/<section>/<key>/toggle")
def toggle_setting(section: str, key: str):
    """Toggle a boolean setting."""
    current = get_setting(f'{section}.{key}', True)
    new_value = not current
    set_setting(f'{section}.{key}', new_value)
    return {"status": "ok", "setting": f"{section}.{key}", "value": new_value}, 200


@settings_bp.post("/api/settings/<section>/<key>")
def set_setting_value(section: str, key: str):
    """Set a setting value."""
    value = request.form.get('value') or (request.json.get('value') if request.is_json else None)
    if value is not None:
        set_setting(f'{section}.{key}', value)
        return {"status": "ok", "setting": f"{section}.{key}", "value": value}, 200
    return {"status": "error", "message": "Bad request"}, 400


@settings_bp.get("/api/settings/location")
def get_location_settings():
    """Get location settings."""
    settings = load_settings()
    location = settings.get('location', {})
    return jsonify(location)
