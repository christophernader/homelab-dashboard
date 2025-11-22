# Homelab Dashboard - Development Documentation

## Project Overview

A Flask-based homelab dashboard with a military/tactical aesthetic. Features real-time system monitoring, Docker container management, service bookmarks, and various integrations.

## Tech Stack

- **Backend**: Python 3, Flask, Flask-Sock (WebSocket)
- **Frontend**: Tailwind CSS (via CDN), HTMX, Three.js (loading screen)
- **Terminal**: xterm.js with WebSocket backend
- **Deployment**: Docker container on Debian server at `chris@192.168.50.10`, port 5050

## Server Connection Info

```
Host: 192.168.50.10
User: chris
Password: 951357
Dashboard Port: 5050
Dashboard Path: ~/homelab-dashboard
```

## Deployment Commands

**IMPORTANT: The dashboard runs in a Docker container, not directly on the host!**

### Quick Deploy (copy-paste ready)
```bash
# One-liner: Deploy files and rebuild container
rsync -avz --exclude '.git' --exclude '__pycache__' --exclude '.venv' --exclude 'venv' --exclude 'data' -e "sshpass -p '951357' ssh -o StrictHostKeyChecking=no" /Users/chris/homelab-dashboard/ chris@192.168.50.10:~/homelab-dashboard/ && sshpass -p '951357' ssh -o StrictHostKeyChecking=no chris@192.168.50.10 "cd ~/homelab-dashboard && docker compose down && docker compose up -d --build"
```

### Step-by-Step Deployment
```bash
# Step 1: Deploy files to server (run from local machine)
rsync -avz --exclude '.git' --exclude '__pycache__' --exclude '.venv' --exclude 'venv' --exclude 'data' -e "sshpass -p '951357' ssh -o StrictHostKeyChecking=no" /Users/chris/homelab-dashboard/ chris@192.168.50.10:~/homelab-dashboard/

# Step 2: Rebuild and restart Docker container (REQUIRED after file changes)
sshpass -p '951357' ssh -o StrictHostKeyChecking=no chris@192.168.50.10 "cd ~/homelab-dashboard && docker compose down && docker compose up -d --build"

# View container logs (for debugging)
sshpass -p '951357' ssh -o StrictHostKeyChecking=no chris@192.168.50.10 "docker logs homelab-dashboard"

# View live logs
sshpass -p '951357' ssh -o StrictHostKeyChecking=no chris@192.168.50.10 "docker logs -f homelab-dashboard"
```

### DO NOT USE (Legacy non-Docker commands)
```bash
# These commands won't work because the dashboard runs in Docker!
# pkill -f 'python3 app.py'
# nohup python3 app.py > /tmp/dashboard.log 2>&1 &
```

## Project Structure (Refactored)

```
homelab-dashboard/
├── app.py                    # Minimal entry point (~50 lines) - creates app, registers blueprints
├── homelab/
│   ├── settings.py           # Settings management, themes (THEMES dict), defaults
│   ├── widgets.py            # External API widgets (weather, news, crypto)
│   ├── docker_utils.py       # Docker container fetching
│   ├── system_stats.py       # System stats (CPU, RAM, etc)
│   ├── app_store.py          # Service/app management
│   ├── icon_service.py       # Icon search via Dashboard Icons API
│   ├── integrations/         # External service integrations
│   │   ├── __init__.py       # Exports all integration functions
│   │   ├── pihole.py         # Pi-hole v5/v6 API integration
│   │   ├── portainer.py      # Portainer API
│   │   ├── proxmox.py        # Proxmox API
│   │   ├── speedtest.py      # Speedtest Tracker / LibreSpeed
│   │   └── uptime_kuma.py    # Uptime Kuma status pages
│   ├── routes/               # Flask Blueprints (extracted from app.py)
│   │   ├── __init__.py       # Exports all blueprints
│   │   ├── main.py           # Main page route (/)
│   │   ├── api.py            # API endpoints (/api/stats, /api/apps, etc)
│   │   ├── settings_routes.py # Settings endpoints (/settings, /api/settings/*)
│   │   └── widgets.py        # Widget endpoints (/api/widgets/*)
│   └── services/             # Business logic services
│       ├── __init__.py       # Exports services
│       └── terminal.py       # WebSocket terminal PTY handler
├── templates/
│   ├── index.html            # Main dashboard page
│   ├── settings.html         # Settings page
│   └── partials/             # HTMX partial templates
│       ├── apps.html
│       ├── stats.html
│       ├── widget_pihole.html
│       ├── widget_speedtest.html
│       ├── widget_weather.html
│       ├── weather_bar.html
│       └── ... other widgets
├── static/
│   ├── css/
│   │   ├── animations.css    # Animation keyframes and utilities
│   │   ├── dashboard.css     # Main dashboard styles (extracted from index.html)
│   │   └── settings.css      # Settings page styles (extracted from settings.html)
│   └── js/
│       └── loading.js        # Three.js loading screen (server + terrain modes)
└── data/
    ├── settings.json         # Persisted settings (Docker volume)
    └── apps.json             # Saved services/apps (Docker volume)
```

### Architecture Notes

- **Blueprints**: Routes are organized into Flask Blueprints for better maintainability
- **Services**: Business logic (like terminal handling) is extracted into services
- **CSS Extraction**: Inline styles moved to external CSS files for browser caching
- **app.py**: Now a minimal ~50 line file that just creates the app and registers blueprints

## Current Feature State

### Completed Features

1. **Theme System**
   - 9 themes: military, cyberpunk, matrix, nord, dracula, solarized, monokai, ocean, light
   - Themes defined in `homelab/settings.py` as `THEMES` dict
   - CSS variables: `--mil-black`, `--mil-dark`, `--mil-card`, `--mil-border`, `--mil-text`, `--mil-muted`, `--mil-accent`, `--mil-success`, `--mil-error`
   - Theme selection UI in Settings > Appearance tab

2. **Weather Widget (Open-Meteo API)**
   - Uses Open-Meteo API (free, no API key, reliable)
   - Supports manual location (city, lat/lon) or auto-detect
   - Temperature units: imperial (F) or metric (C)
   - Location settings in Settings > Dashboard tab
   - API endpoint: `POST /api/settings/location`

3. **Pi-hole Integration**
   - Supports both v5 (api.php) and v6+ (REST API with session auth)
   - Shows: blocked today, block rate, total queries, clients, blocklist size
   - **Diagnosis tracker**: Shows error/warning count from `/api/info/messages`
   - Session logout on completion to avoid `api_seats_exceeded` errors

4. **Speedtest Integration**
   - Supports Speedtest Tracker (LinuxServer.io image on port 8090)
   - Handles "No results found" state with link to run first test

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
        "timezone": "",
        "use_auto": True,
        "units": "imperial",  # imperial (F) or metric (C)
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

## API Endpoints

### Settings
- `GET /settings` - Settings page
- `GET /api/themes` - List all themes
- `GET /api/theme/<name>` - Get theme colors
- `POST /api/settings/theme` - Set active theme (form: theme=name)
- `POST /api/settings/location` - Save location settings
- `GET /api/settings/location` - Get location settings
- `POST /api/settings/widget/<name>/toggle` - Toggle widget
- `POST /api/settings/integration/<name>/toggle` - Toggle integration
- `POST /api/settings/integration/<name>` - Save integration config
- `POST /api/settings/integration/<name>/test` - Test integration connection

### Widgets (HTMX partials)
- `GET /api/widgets/pihole` - Pi-hole stats + diagnosis
- `GET /api/widgets/speedtest` - Speedtest results
- `GET /api/widgets/uptime-kuma` - Uptime Kuma status
- `GET /api/widgets/weather?lat=&lon=` - Full weather widget
- `GET /api/widgets/weather-bar?lat=&lon=` - Compact weather bar
- `GET /api/widgets/crypto-bar` - Crypto prices ticker
- `GET /api/widgets/headlines` - News headlines
- `GET /api/widgets/news-detailed` - Hacker News
- `GET /api/widgets/reddit-detailed?sub=` - Reddit posts
- `GET /api/widgets/earthquakes` - USGS earthquake data
- `GET /api/widgets/threats-full` - Threat status

## Integration Services (on homelab server)

| Service | Port | Notes |
|---------|------|-------|
| Pi-hole | 8080 | Password: `E1t3u5o7`, v6 API |
| Speedtest Tracker | 8090 | May need first test run |
| Uptime Kuma | 3001 | Requires public status page |

## Starting the Dashboard Locally

```bash
cd /Users/chris/homelab-dashboard
python3 app.py
# Runs on http://localhost:5050
```

## Known Issues / TODOs

1. **Gravity date** - Pi-hole gravity last updated shows "Unknown" (API response format changed)
2. **Theme persistence** - Theme loads from settings.json on each request, CSS variables set on page load

## Recent Changes

- **Major Refactoring**: Restructured codebase following refactoring_guide.md
  - app.py reduced from ~510 lines to ~50 lines
  - Extracted routes into Flask Blueprints (main, api, settings, widgets)
  - Extracted terminal WebSocket handler to services/terminal.py
  - Extracted inline CSS to static/css/dashboard.css and settings.css
- Added loading screen style selection (Server/Terrain) in Settings > Appearance
- Fixed weather using Open-Meteo API (wttr.in was timing out from Docker)
- Added temperature units support (F/C) based on location settings
- Added Pi-hole diagnosis tracker showing errors/warnings from `/api/info/messages`
- Fixed integrations not displaying on dashboard (HTMX sections were missing)
- Fixed Pi-hole v6 authentication (requires `X-FTL-SID` header)
