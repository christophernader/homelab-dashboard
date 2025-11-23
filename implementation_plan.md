# Implementation Plan - Audiobookshelf Integration

## Goal
Integrate Audiobookshelf (self-hosted audiobook server) into the Homelab Dashboard to display recent additions or listening stats.

## Identified Issues
*   [x] **Duplicate Toggles**: "Show Loading Screen" exists in both `appearance.html` and `dashboard.html`. (Fixed)
*   [x] **Loading Screen Logic**: JS ignored the setting. (Fixed)
*   [ ] **Missing Location UI**: The backend supports location settings, but there is no UI to configure them.

## Proposed Changes
### Dashboard Settings
#### [MODIFY] [templates/partials/settings/dashboard.html](file:///Users/chris/homelab-dashboard/templates/partials/settings/dashboard.html)
*   Add a "Location" section.
*   Inputs: City, Latitude, Longitude.
*   Toggles: Use Auto-Location.
*   Select: Units (Imperial/Metric).
*   Use `hx-post="/api/settings/location"` to save.



## Proposed Changes
### Appearance & Dashboard
#### [MODIFY] [templates/partials/settings/dashboard.html](file:///Users/chris/homelab-dashboard/templates/partials/settings/dashboard.html)
*   Remove the "Loading Screen" toggle section (lines 8-18). It belongs in Appearance.

### Index Template
#### [MODIFY] [templates/index.html](file:///Users/chris/homelab-dashboard/templates/index.html)
*   Ensure the loading screen block is conditionally rendered based on `settings.appearance.show_loading_screen`.

### JavaScript Logic
#### [MODIFY] [static/js/loading/core.js](file:///Users/chris/homelab-dashboard/static/js/loading/core.js)
*   Update `init` to check `window.showLoadingScreen`.
*   If false:
    *   Skip 3D initialization.
    *   Call `loadAllData` but bypass the "wait for mouse" step.
    *   Ensure `triggerEntranceAnimations` and `injectPreloadedData` are called immediately after data load.
*   Refactor `finishLoading` to be robust if the loading screen element is missing.
#### [MODIFY] [pihole.py](file:///Users/chris/homelab-dashboard/homelab/integrations/pihole.py)
#### [MODIFY] [portainer.py](file:///Users/chris/homelab-dashboard/homelab/integrations/portainer.py)
#### [MODIFY] [proxmox.py](file:///Users/chris/homelab-dashboard/homelab/integrations/proxmox.py)
#### [MODIFY] [speedtest.py](file:///Users/chris/homelab-dashboard/homelab/integrations/speedtest.py)
#### [MODIFY] [uptime_kuma.py](file:///Users/chris/homelab-dashboard/homelab/integrations/uptime_kuma.py)

### Settings Routes
#### [MODIFY] [settings_routes.py](file:///Users/chris/homelab-dashboard/homelab/routes/settings_routes.py)
*   Update `test_integration` to construct a config object from `request.form` for ALL integrations.
*   Pass this config to the respective tester function.
#### [MODIFY] [homelab/settings.py](file:///Users/chris/homelab-dashboard/homelab/settings.py)
- Add `audiobookshelf` to `DEFAULT_SETTINGS['integrations']`.
  - Fields: `enabled`, `url`, `api_key`.

#### [NEW] [homelab/integrations/audiobookshelf.py](file:///Users/chris/homelab-dashboard/homelab/integrations/audiobookshelf.py)
- Fetch server status, total books, or recent additions.

#### [MODIFY] [homelab/routes/widgets.py](file:///Users/chris/homelab-dashboard/homelab/routes/widgets.py)
- Add route `@widgets_bp.get("/api/widgets/audiobookshelf")`.

### Frontend
#### [MODIFY] [templates/partials/settings/integrations.html](file:///Users/chris/homelab-dashboard/templates/partials/settings/integrations.html)
- Add configuration card for Audiobookshelf.

#### [NEW] [templates/partials/widget_audiobookshelf.html](file:///Users/chris/homelab-dashboard/templates/partials/widget_audiobookshelf.html)
- Create the widget UI (likely a card showing recent books or stats).

#### [MODIFY] [templates/index.html](file:///Users/chris/homelab-dashboard/templates/index.html)
- Add the widget to the "Integrations" section (conditionally rendered).

## Verification Plan
### Manual Verification
1.  **Settings:** Enable Audiobookshelf, enter invalid URL/Key -> Verify error handling.
2.  **Settings:** Enter valid URL/Key -> Verify "Test Connection" works.
3.  **Dashboard:** Verify widget appears and displays data.
