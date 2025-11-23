"""Settings management for dashboard configuration."""

import json
from pathlib import Path
from typing import Any, Dict, List, Optional
from threading import Lock

DATA_DIR = Path("data")
SETTINGS_FILE = DATA_DIR / "settings.json"
_settings_lock = Lock()

# Default settings structure
DEFAULT_SETTINGS = {
    "widgets": {
        "weather": {"enabled": True, "position": 0},
        "crypto": {"enabled": True, "position": 1},
        "news": {"enabled": True, "position": 2},
        "reddit": {"enabled": True, "position": 3},
        "threats": {"enabled": True, "position": 4},
        "earthquakes": {"enabled": True, "position": 5},
        "system_stats": {"enabled": True, "position": 6},
        "docker": {"enabled": True, "position": 7},
    },
    "integrations": {
        "pihole": {
            "enabled": False,
            "url": "",
            "api_key": "",
        },
        "portainer": {
            "enabled": False,
            "url": "",
            "api_key": "",
        },
        "proxmox": {
            "enabled": False,
            "url": "",
            "user": "",
            "token_name": "",
            "token_secret": "",
        },
        "speedtest": {
            "enabled": False,
            "url": "",
            "api_key": "",
        },
        "uptime_kuma": {
            "enabled": False,
            "url": "",
            "slug": "default",
        },
        "audiobookshelf": {
            "enabled": False,
            "url": "",
            "api_key": "",
        },
    },
    "appearance": {
        "theme": "dark",
        "show_loading_screen": True,
        "loading_screen_style": "server",  # "server" or "terrain"
        "animations_enabled": True,
    },
    "dashboard": {
        "news_ticker_enabled": True,
        "weather_bar_enabled": True,
        "crypto_bar_enabled": True,
    },
    "location": {
        "city": "",
        "latitude": "",
        "longitude": "",
        "timezone": "",
        "use_auto": True,
        "units": "imperial",  # imperial (F) or metric (C)
    },
}


def ensure_settings_file() -> None:
    """Ensure settings file exists with defaults."""
    DATA_DIR.mkdir(exist_ok=True)
    if not SETTINGS_FILE.exists():
        with open(SETTINGS_FILE, 'w', encoding='utf-8') as f:
            json.dump(DEFAULT_SETTINGS, f, indent=2)


def load_settings() -> Dict[str, Any]:
    """Load settings from file, merging with defaults."""
    ensure_settings_file()
    try:
        with open(SETTINGS_FILE, 'r', encoding='utf-8') as f:
            saved = json.load(f)
        # Deep merge with defaults to ensure all keys exist
        return _deep_merge(DEFAULT_SETTINGS, saved)
    except Exception:
        return DEFAULT_SETTINGS.copy()


def save_settings(settings: Dict[str, Any]) -> None:
    """Save settings to file."""
    ensure_settings_file()
    with _settings_lock:
        with open(SETTINGS_FILE, 'w', encoding='utf-8') as f:
            json.dump(settings, f, indent=2)


def get_setting(path: str, default: Any = None) -> Any:
    """
    Get a setting value by dot-notation path.
    Example: get_setting('widgets.weather.enabled')
    """
    settings = load_settings()
    keys = path.split('.')
    value = settings
    try:
        for key in keys:
            value = value[key]
        return value
    except (KeyError, TypeError):
        return default


def set_setting(path: str, value: Any) -> None:
    """
    Set a setting value by dot-notation path.
    Example: set_setting('widgets.weather.enabled', False)
    """
    settings = load_settings()
    keys = path.split('.')
    target = settings
    for key in keys[:-1]:
        if key not in target:
            target[key] = {}
        target = target[key]
    target[keys[-1]] = value
    save_settings(settings)


def get_widget_config(widget_name: str) -> Dict[str, Any]:
    """Get configuration for a specific widget."""
    settings = load_settings()
    return settings.get('widgets', {}).get(widget_name, {'enabled': False, 'position': 99})


def set_widget_enabled(widget_name: str, enabled: bool) -> None:
    """Enable or disable a widget."""
    set_setting(f'widgets.{widget_name}.enabled', enabled)


def get_enabled_widgets() -> List[str]:
    """Get list of enabled widget names, sorted by position."""
    settings = load_settings()
    widgets = settings.get('widgets', {})
    enabled = [(name, cfg.get('position', 99)) for name, cfg in widgets.items() if cfg.get('enabled', True)]
    enabled.sort(key=lambda x: x[1])
    return [name for name, _ in enabled]


def get_integration_config(integration_name: str) -> Optional[Dict[str, Any]]:
    """Get configuration for a specific integration."""
    settings = load_settings()
    return settings.get('integrations', {}).get(integration_name)


def update_integration(integration_name: str, config: Dict[str, Any]) -> None:
    """Update configuration for an integration."""
    settings = load_settings()
    if 'integrations' not in settings:
        settings['integrations'] = {}
    if integration_name not in settings['integrations']:
        settings['integrations'][integration_name] = {}
    settings['integrations'][integration_name].update(config)
    save_settings(settings)


def get_dashboard_config() -> Dict[str, Any]:
    """Get dashboard configuration."""
    settings = load_settings()
    return settings.get('dashboard', DEFAULT_SETTINGS['dashboard'])


def get_appearance_config() -> Dict[str, Any]:
    """Get appearance configuration."""
    settings = load_settings()
    return settings.get('appearance', DEFAULT_SETTINGS['appearance'])


def _deep_merge(base: Dict, override: Dict) -> Dict:
    """Deep merge two dictionaries, override takes precedence."""
    result = base.copy()
    for key, value in override.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = _deep_merge(result[key], value)
        else:
            result[key] = value
    return result


# ========== THEME DEFINITIONS ==========

THEMES = {
    "military": {
        "name": "Military",
        "colors": {
            "black": "#0a0a0a",
            "dark": "#111111",
            "card": "#151515",
            "border": "#252525",
            "text": "#e5e5e5",
            "muted": "#6b6b6b",
            "accent": "#f97316",
            "success": "#22c55e",
            "error": "#ef4444",
        }
    },
    "cyberpunk": {
        "name": "Cyberpunk",
        "colors": {
            "black": "#0d0d1a",
            "dark": "#1a1a2e",
            "card": "#16213e",
            "border": "#0f3460",
            "text": "#eaeaea",
            "muted": "#7f8c8d",
            "accent": "#e94560",
            "success": "#00ff88",
            "error": "#ff6b6b",
        }
    },
    "matrix": {
        "name": "Matrix",
        "colors": {
            "black": "#000000",
            "dark": "#0a0a0a",
            "card": "#0d1117",
            "border": "#003300",
            "text": "#00ff00",
            "muted": "#008800",
            "accent": "#00ff00",
            "success": "#00ff00",
            "error": "#ff0000",
        }
    },
    "nord": {
        "name": "Nord",
        "colors": {
            "black": "#2e3440",
            "dark": "#3b4252",
            "card": "#434c5e",
            "border": "#4c566a",
            "text": "#eceff4",
            "muted": "#d8dee9",
            "accent": "#88c0d0",
            "success": "#a3be8c",
            "error": "#bf616a",
        }
    },
    "dracula": {
        "name": "Dracula",
        "colors": {
            "black": "#21222c",
            "dark": "#282a36",
            "card": "#44475a",
            "border": "#6272a4",
            "text": "#f8f8f2",
            "muted": "#6272a4",
            "accent": "#bd93f9",
            "success": "#50fa7b",
            "error": "#ff5555",
        }
    },
}


def get_themes() -> Dict[str, Any]:
    """Get all available themes."""
    return THEMES


def get_theme_colors(theme_name: str) -> Dict[str, str]:
    """Get colors for a specific theme."""
    theme = THEMES.get(theme_name, THEMES.get("military"))
    return theme.get("colors", {})
