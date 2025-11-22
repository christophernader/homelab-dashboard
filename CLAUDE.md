# Homelab Dashboard - Development Documentation

## Project Overview

A Flask-based homelab dashboard with a military/tactical aesthetic. Features real-time system monitoring, Docker container management, service bookmarks, and various integrations.

## Tech Stack

- **Backend**: Python 3, Flask, Flask-Sock (WebSocket)
- **Frontend**: Tailwind CSS (via CDN), HTMX, Three.js (loading screen)
- **Terminal**: xterm.js with WebSocket backend
- **Deployment**: Debian server at `chris@192.168.50.10`, dashboard on port 5050

## Server Connection Info

```
Host: 192.168.50.10
User: chris
Password: 951357
Dashboard Port: 5050
Dashboard Path: ~/homelab-dashboard
Venv: ~/homelab-dashboard/venv
```

## Deployment Commands

**IMPORTANT: The dashboard runs in a Docker container, not directly on the host!**

```bash
# Deploy files (run from local machine)
rsync -avz --exclude '.git' --exclude '__pycache__' --exclude '.venv' --exclude 'venv' --exclude 'data' -e "sshpass -p '951357' ssh -o StrictHostKeyChecking=no" /Users/chris/homelab-dashboard/ chris@192.168.50.10:~/homelab-dashboard/

# Rebuild and restart Docker container (REQUIRED after file changes)
sshpass -p '951357' ssh -o StrictHostKeyChecking=no chris@192.168.50.10 "cd ~/homelab-dashboard && docker compose down && docker compose up -d --build"

# View container logs
sshpass -p '951357' ssh -o StrictHostKeyChecking=no chris@192.168.50.10 "docker logs homelab-dashboard"
```

### Legacy (non-Docker) - DO NOT USE
```bash
# These commands won't work because the dashboard runs in Docker!
# cd ~/homelab-dashboard
# source venv/bin/activate
# pkill -f 'python3 app.py'
# nohup python3 app.py > /tmp/dashboard.log 2>&1 &
```

## Project Structure

```
homelab-dashboard/
├── app.py                    # Main Flask app, routes, WebSocket terminal
├── homelab/
│   ├── settings.py           # Settings management, themes, defaults
│   ├── docker_utils.py       # Docker container fetching
│   ├── system_stats.py       # System stats (CPU, RAM, etc)
│   ├── app_store.py          # Service/app management
│   ├── icon_service.py       # Icon search via Dashboard Icons API
│   ├── integrations/
│   │   ├── __init__.py       # Exports all integration functions
│   │   ├── pihole.py         # Pi-hole v5/v6 API integration
│   │   ├── portainer.py      # Portainer API
│   │   ├── proxmox.py        # Proxmox API
│   │   ├── speedtest.py      # Speedtest Tracker / LibreSpeed
│   │   └── uptime_kuma.py    # Uptime Kuma status pages
│   └── routes/
│       ├── settings_routes.py # Settings API endpoints
│       └── widget_routes.py   # Widget API endpoints
├── templates/
│   ├── index.html            # Main dashboard page
│   ├── settings.html         # Settings page
│   └── partials/             # HTMX partial templates
│       ├── apps.html
│       ├── stats.html
│       ├── widget_pihole.html
│       ├── widget_speedtest.html
│       └── ... other widgets
├── static/
│   ├── css/animations.css
│   └── js/loading.js         # Three.js loading screen
└── data/
    ├── settings.json         # Persisted settings
    └── apps.json             # Saved services/apps
```

## Current Feature State

### Completed Features
1. **Theme System** (JUST IMPLEMENTED)
   - 9 themes: military, cyberpunk, matrix, nord, dracula, solarized, monokai, ocean, light
   - Themes defined in `homelab/settings.py` as `THEMES` dict
   - CSS variables used throughout: `--mil-black`, `--mil-dark`, `--mil-card`, `--mil-border`, `--mil-text`, `--mil-muted`, `--mil-accent`, `--mil-success`, `--mil-error`
   - Theme selection UI in Settings > Appearance tab
   - Theme colors passed from `app.py` to `index.html` via `theme_colors` template var
   - **Note**: Old light-mode toggle removed from header, themes now managed via Settings

2. **Location Settings for Weather** (JUST IMPLEMENTED)
   - Location settings in `DEFAULT_SETTINGS['location']`
   - UI in Settings > Dashboard tab
   - Options: auto-detect (IP-based) or manual (city, lat/lon)
   - API endpoint: `POST /api/settings/location`

3. **Pi-hole Integration**
   - Supports both v5 (api.php) and v6+ (REST API with session auth)
   - Shows: blocked today, block rate, total queries, clients, blocklist size
   - Diagnosis section showing Pi-hole errors/warnings
   - Session logout on completion to avoid `api_seats_exceeded` errors

4. **Speedtest Integration**
   - Supports Speedtest Tracker (LinuxServer.io image on port 8090)
   - Handles "No results found" state with link to run first test
   - Embedded LibreSpeed widget (commented out, was for browser-based tests)

5. **Other Integrations**
   - Uptime Kuma (status pages)
   - Portainer (Docker management)
   - Proxmox (virtualization)

### Settings Structure

```python
DEFAULT_SETTINGS = {
    "widgets": {
        "weather": {"enabled": True, "position": 0},
        "crypto": {"enabled": True, "position": 1},
        # ... more widgets
    },
    "integrations": {
        "pihole": {"enabled": False, "url": "", "api_key": ""},
        "portainer": {"enabled": False, "url": "", "api_key": ""},
        "proxmox": {"enabled": False, "url": "", "user": "", "token_name": "", "token_secret": ""},
        "speedtest": {"enabled": False, "url": "", "api_key": ""},
        "uptime_kuma": {"enabled": False, "url": "", "slug": "default"},
    },
    "location": {
        "city": "",
        "latitude": "",
        "longitude": "",
        "use_auto": True,
    },
    "appearance": {
        "theme": "military",
        "show_loading_screen": True,
        "animations_enabled": True,
    },
    "dashboard": {
        "refresh_interval": 30,
        "news_ticker_enabled": True,
        "weather_bar_enabled": True,
        "crypto_bar_enabled": True,
    },
}
```

## Theme Colors Structure

Each theme in `THEMES` dict has:
```python
"theme_name": {
    "name": "Display Name",
    "description": "Short description",
    "colors": {
        "black": "#hex",    # Background
        "dark": "#hex",     # Slightly lighter bg
        "card": "#hex",     # Card backgrounds
        "border": "#hex",   # Borders
        "text": "#hex",     # Main text
        "muted": "#hex",    # Secondary text
        "accent": "#hex",   # Primary accent (buttons, highlights)
        "success": "#hex",  # Success states (green)
        "error": "#hex",    # Error states (red)
    }
}
```

## API Endpoints

### Settings
- `GET /settings` - Settings page
- `GET /api/themes` - List all themes
- `GET /api/theme/<name>` - Get theme colors
- `POST /api/settings/theme` - Set active theme (form: theme=name)
- `POST /api/settings/location` - Save location (form: city, latitude, longitude, use_auto)
- `POST /api/settings/widget/<name>/toggle` - Toggle widget
- `POST /api/settings/integration/<name>/toggle` - Toggle integration
- `POST /api/settings/integration/<name>` - Save integration config
- `POST /api/settings/integration/<name>/test` - Test integration connection
- `POST /api/settings/<section>/<key>/toggle` - Toggle any boolean setting

### Widgets (HTMX partials)
- `GET /api/widgets/pihole`
- `GET /api/widgets/speedtest`
- `GET /api/widgets/uptime-kuma`
- `GET /api/widgets/weather-bar?lat=&lon=`
- `GET /api/widgets/headlines`
- `GET /api/widgets/crypto-bar`
- `GET /api/widgets/news-detailed`
- `GET /api/widgets/reddit-detailed?sub=`
- `GET /api/widgets/threats-full`

## Known Issues / TODOs

1. **Weather location** - The weather widget needs to use location from settings instead of geolocation. Currently still uses browser geolocation.

2. **Theme persistence across reloads** - Theme is loaded from settings.json on each request, so it persists. But CSS variables are set once on page load.

3. **Integration services**:
   - Pi-hole: Password is `E1t3u5o7` on 192.168.50.10:8080
   - Speedtest Tracker: On port 8090, may need first test run
   - Uptime Kuma: On port 3001, requires public status page

## Recent Changes (This Session)

1. Added theme system with 9 themes to `settings.py`
2. Updated `index.html` to use CSS variables for all colors
3. Added theme selection UI to Settings > Appearance tab
4. Added location settings UI to Settings > Dashboard tab
5. Removed old light-mode toggle from header (themes now in Settings)
6. Updated loading screen to use theme colors
7. Updated grid background to use theme accent color

## Files Modified This Session

- `homelab/settings.py` - Added THEMES dict, get_themes(), get_theme_colors(), location in DEFAULT_SETTINGS
- `homelab/routes/settings_routes.py` - Added theme and location API routes
- `templates/index.html` - Theme CSS variables, removed light-mode, updated loading screen
- `templates/settings.html` - Theme selection grid, location settings form
- `app.py` - Import get_theme_colors, pass theme_colors and theme_name to index template

## Starting the Dashboard Locally

```bash
cd /Users/chris/homelab-dashboard
python3 app.py
# Runs on port 5050
```
