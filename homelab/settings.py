"""Settings management for dashboard configuration."""

import json
import time
from pathlib import Path
from typing import Any, Dict, List, Optional
from threading import Lock

DATA_DIR = Path("data")
SETTINGS_FILE = DATA_DIR / "settings.json"
_settings_lock = Lock()

# In-memory cache
_settings_cache: Optional[Dict[str, Any]] = None
_cache_timestamp: float = 0
_cache_ttl: int = 60  # seconds

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


def load_settings(bypass_cache: bool = False) -> Dict[str, Any]:
    """
    Load settings from file, merging with defaults.

    Uses an in-memory cache with TTL to avoid disk I/O on every request.

    Args:
        bypass_cache: If True, force reload from disk (used when saving settings)

    Returns:
        Complete settings dictionary merged with defaults
    """
    global _settings_cache, _cache_timestamp

    # Check cache validity
    cache_age = time.time() - _cache_timestamp
    if not bypass_cache and _settings_cache is not None and cache_age < _cache_ttl:
        return _settings_cache.copy()

    # Cache miss or expired - load from disk
    ensure_settings_file()
    with _settings_lock:
        try:
            with open(SETTINGS_FILE, 'r', encoding='utf-8') as f:
                saved = json.load(f)
            # Deep merge with defaults to ensure all keys exist
            merged = _deep_merge(DEFAULT_SETTINGS, saved)

            # Update cache
            _settings_cache = merged
            _cache_timestamp = time.time()

            return merged.copy()
        except Exception:
            # On error, cache defaults and return
            _settings_cache = DEFAULT_SETTINGS.copy()
            _cache_timestamp = time.time()
            return DEFAULT_SETTINGS.copy()


def save_settings(settings: Dict[str, Any]) -> None:
    """Save settings to file and invalidate cache."""
    global _settings_cache, _cache_timestamp

    ensure_settings_file()
    with _settings_lock:
        with open(SETTINGS_FILE, 'w', encoding='utf-8') as f:
            json.dump(settings, f, indent=2)

        # Invalidate cache by updating it immediately
        _settings_cache = _deep_merge(DEFAULT_SETTINGS, settings)
        _cache_timestamp = time.time()


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


def invalidate_cache() -> None:
    """Manually invalidate the settings cache. Useful for testing or external modifications."""
    global _settings_cache, _cache_timestamp
    with _settings_lock:
        _settings_cache = None
        _cache_timestamp = 0


def get_cache_stats() -> Dict[str, Any]:
    """Get cache statistics for monitoring/debugging."""
    cache_age = time.time() - _cache_timestamp if _cache_timestamp > 0 else -1
    return {
        'cached': _settings_cache is not None,
        'age_seconds': round(cache_age, 2) if cache_age >= 0 else None,
        'ttl_seconds': _cache_ttl,
        'is_valid': cache_age < _cache_ttl if cache_age >= 0 else False,
    }


def _deep_merge(base: Dict, override: Dict) -> Dict:
    """Deep merge two dictionaries, override takes precedence."""
    result = base.copy()
    for key, value in override.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = _deep_merge(result[key], value)
        else:
            result[key] = value
    return result


from homelab.themes import get_themes, get_theme_colors

# Re-export for compatibility
__all__ = [
    'get_themes',
    'get_theme_colors',
    'load_settings',
    'save_settings',
    'get_setting',
    'set_setting',
    'get_widget_config',
    'set_widget_enabled',
    'get_enabled_widgets',
    'get_integration_config',
    'update_integration',
    'get_dashboard_config',
    'get_appearance_config',
    'invalidate_cache',
    'get_cache_stats',
]
