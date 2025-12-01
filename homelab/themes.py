"""Theme definitions for the dashboard."""

from typing import Any, Dict

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
