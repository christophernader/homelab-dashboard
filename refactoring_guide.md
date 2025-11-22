# Homelab Dashboard Refactoring Guide

This guide identifies areas of the codebase that require refactoring to improve maintainability, performance, and scalability. It is designed to be used by AI coding agents to systematically improve the project.

## 1. Huge Files (Refactoring Targets)

The following files are candidates for immediate refactoring due to their size and complexity.

| File Path | Lines | Primary Issues | Status |
|-----------|-------|----------------|--------|
| `templates/index.html` | ~731 | Excessive inline JS, complex HTML structure. | **PARTIALLY DONE** (CSS extracted) |
| `homelab/widgets.py` | ~547 | Low cohesion (handles too many unrelated widgets). | **PENDING** |
| `app.py` | ~50 | "God object" anti-pattern. | **COMPLETED** |
| `templates/settings.html` | ~431 | Large monolithic template handling multiple tabs. | **PENDING** |
| `static/js/loading.js` | ~461 | Complex Three.js visualizations mixed with data fetching. | **PENDING** |

## 2. Detailed Refactoring Plan

### A. `app.py` - The Application Entry Point
**Status: COMPLETED**
*   Routes extracted to `homelab/routes/`.
*   WebSocket logic extracted to `homelab/services/terminal.py`.

### B. `homelab/widgets.py` - Data Fetching
**Status: PENDING**
**Current State:** A single file containing fetchers for Weather, News, Crypto, Threats, Earthquakes, etc., plus a custom caching mechanism.
**Refactoring Actions:**
1.  **Modularize Widgets:** Split into a `homelab/widgets/` package.
    *   `homelab/widgets/weather.py`
    *   `homelab/widgets/news.py`
    *   `homelab/widgets/crypto.py`
    *   `homelab/widgets/security.py` (Threats, Earthquakes)
2.  **Standardize Caching:** Replace the custom `_get_cached` and global `_cache` with a standard library like `Flask-Caching` or a dedicated `CacheService` class.

### C. `templates/index.html` - Main Dashboard Template
**Status: PARTIALLY DONE**
**Refactoring Actions:**
1.  **Extract CSS:** Move the `<style>` block to `static/css/dashboard.css`. (**DONE**)
2.  **Extract JavaScript:** Move the `<script>` block to `static/js/dashboard.js` and `static/js/terminal_client.js`. (**PENDING**)
3.  **Componentize HTML:** Extract sections into partials. (**PENDING**)

### D. `templates/settings.html` - Settings Page
**Status: PENDING**
**Refactoring Actions:**
1.  **Split into Partials:** Create a `templates/partials/settings/` directory.
2.  **Extract CSS:** Move inline styles to `static/css/settings.css`.

### E. `static/js/loading.js` - Loading Screen
**Status: PENDING**
**Refactoring Actions:**
1.  **Modularize:** Split into smaller modules (`core.js`, `viz_server.js`, `viz_terrain.js`).

## 3. Immediate Fixes Required

> [!WARNING]
> **Duplicate Route Files Detected**
> You have both `homelab/routes/widgets.py` and `homelab/routes/widget_routes.py`.
> *   `widgets.py` is currently used by `__init__.py`.
> *   `widget_routes.py` contains better logic (handling manual location settings).
> **Action:** Merge `widget_routes.py` content into `widgets.py` and delete `widget_routes.py`.

## 4. Proposed File Structure

```text
homelab-dashboard/
├── app.py                  # Entry point (minimal)
├── homelab/
│   ├── routes/             # Route Blueprints
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── api.py
│   │   ├── settings_routes.py
│   │   └── widgets.py      # Merge widget_routes.py here
│   ├── services/
│   │   └── terminal.py
│   ├── widgets/            # [TODO] Split widgets.py here
│   └── ...
├── static/
│   ├── css/
│   │   ├── dashboard.css   # Extracted
│   │   └── settings.css    # [TODO]
│   └── js/
│       ├── dashboard.js    # [TODO]
│       └── loading/        # [TODO]
└── templates/
    ├── index.html
    ├── settings.html
    └── partials/
        └── settings/       # [TODO]
```
