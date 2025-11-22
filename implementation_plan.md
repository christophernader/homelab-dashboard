# Refactoring Implementation Plan

This plan outlines the steps to complete the refactoring of the Homelab Dashboard, as identified in the `refactoring_guide.md`.

> [!IMPORTANT]
> **Duplicate Route Files:** I will be merging `homelab/routes/widget_routes.py` into `homelab/routes/widgets.py` and deleting `widget_routes.py` to resolve the duplication issue.

## Proposed Changes

### Completed Tasks

- [x] **Resolve Duplicate Route Files**
  - [x] Merge `homelab/routes/widget_routes.py` into `homelab/routes/widgets.py`.
  - [x] Delete `homelab/routes/widget_routes.py`.

- [x] **Modularize `homelab/widgets.py`**
  - [x] Create `homelab/widgets/` package.
  - [x] Split into `weather.py`, `news.py`, `social.py`, `crypto.py`, `security.py`.
  - [x] Standardize caching utility in `homelab/utils/cache.py`.

- [x] **Refactor `static/js/loading.js`**
  - [x] Split into `viz_server.js`, `viz_terrain.js`, `core.js` in `static/js/loading/`.

- [x] **Refactor `templates/settings.html`**
  - [x] Extract tabs into `templates/partials/settings/`.
  - [x] Move inline CSS to `static/css/settings.css`.

- [x] **Refactor `templates/index.html` (JavaScript)**
  - [x] Extract inline JS to `static/js/dashboard/ui.js` and `terminal.js`.

- [x] **Cleanup Codebase**
  - [x] Remove unused settings (`accent_color`, `refresh_interval`).

## Remaining Tasks

### 1. Refactor `templates/index.html` (HTML)
**Goal:** Reduce the size and complexity of the main template by extracting sections into partials.
- [ ] Create `templates/partials/dashboard/` directory.
- [ ] Extract header to `templates/partials/dashboard/header.html`.
- [ ] Extract loading screen HTML to `templates/partials/dashboard/loading_screen.html`.
- [ ] Extract tickers (news, crypto, weather) to `templates/partials/dashboard/tickers.html`.
- [ ] Extract terminal overlay to `templates/partials/dashboard/terminal_overlay.html`.
- [ ] Update `templates/index.html` to include these partials.

### 2. Verification
- [ ] Verify all partials load correctly.
- [ ] Ensure HTMX interactions still work with the new structure.


## Verification Plan

### Automated Tests
- Run the app and verify all pages load.
- Check logs for import errors.

### Manual Verification
- **Widgets:** Verify all widgets (Weather, News, Crypto, etc.) still load data.
- **Settings:** Verify all tabs in Settings page work.
- **Loading Screen:** Verify loading screen animation and data preloading.
- **Terminal:** Verify terminal connects and works.
- **Drag & Drop:** Verify app reordering works.
