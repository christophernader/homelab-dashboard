# Implementation Plan - Auto-Detect & Edit Apps

## Goal
Implement a "Smart Auto-Detect" feature for apps that scans local Docker containers, intelligently assigns icons, and populates the dashboard without overwriting existing entries. Additionally, add an "Edit App" feature to allow users to refine the detected details (Name, URL, Icon).

## User Review Required
> [!IMPORTANT]
> **Docker Socket Access**: Auto-detection requires access to the Docker socket. Ensure the container has `/var/run/docker.sock` mounted.
> **URL Guessing**: The system will attempt to guess the URL based on exposed ports. It will default to `http://<host-ip>:<port>`. Since the backend doesn't know the external IP, it might default to `localhost` or require manual adjustment via the new Edit feature.

## Proposed Changes

### Backend Logic

#### [MODIFY] [homelab/docker_utils.py](file:///Users/chris/homelab-dashboard/homelab/docker_utils.py)
*   Add `scan_docker_apps()` function:
    *   List all containers.
    *   **Label Parsing**: Check for `homelab.name`, `homelab.icon`, `homelab.url`, `homelab.port`, `homelab.ignore`.
    *   **Traefik Support**: Parse `traefik.http.routers.*.rule` to extract `Host(`domain.com`)` for accurate URLs.
    *   **Host Mode Handling**: If `network_mode: host`, check `homelab.port`, `ExposedPorts`, or fallback to a "known ports" dictionary (e.g., Plex=32400).
    *   **Icon Logic**: Use `homelab.icon` > Image Name (e.g., `linuxserver/plex` -> `plex`) > Container Name.
    *   Return list of discovered apps.

#### [MODIFY] [homelab/app_store.py](file:///Users/chris/homelab-dashboard/homelab/app_store.py)
*   Add `merge_apps(new_apps)`:
    *   Accept a list of specific apps to add (from the frontend preview).
    *   Deduplicate against existing apps by URL or Name.
    *   Save updated list.
*   Add `update_app(original_name, new_data)`:
    *   Find app by `original_name`.
    *   Update fields (Name, URL, Icon).
    *   Handle renaming.

#### [MODIFY] [homelab/routes/api.py](file:///Users/chris/homelab-dashboard/homelab/routes/api.py)
*   `GET /api/apps/autodiscover`:
    *   Call `docker_utils.scan_docker_apps()`.
    *   Return JSON list of *potential* apps (for preview).
*   `POST /api/apps/import`:
    *   Accept JSON list of selected apps.
    *   Call `app_store.merge_apps()`.
    *   Return success.
*   `GET /api/apps/<name>`: Return JSON details.
*   `PUT /api/apps/<name>`: Update app.

### Frontend UI

#### [MODIFY] [templates/partials/dashboard/edit_panel.html](file:///Users/chris/homelab-dashboard/templates/partials/dashboard/edit_panel.html)
*   **Edit Mode Support**:
    *   Add hidden input `original_name`.
    *   Dynamic form handling for Add vs Edit.
*   **Auto-Detect Preview**:
    *   Add "Auto-Detect" button.
    *   On click, fetch `/api/apps/autodiscover`.
    *   Show a **Preview List** (checkboxes) of found apps.
    *   "Import Selected" button posts to `/api/apps/import`.

#### [MODIFY] [templates/partials/apps.html](file:///Users/chris/homelab-dashboard/templates/partials/apps.html)
*   Add "Edit" (pencil) button.
*   On click, open `edit_panel.html` in "Edit Mode".

#### [MODIFY] [static/js/dashboard/ui.js](file:///Users/chris/homelab-dashboard/static/js/dashboard/ui.js)
*   Add `openEditApp(name)`: Populate form.
*   Add `autoDetectApps()`: Handle the fetch, preview rendering, and import flow.

### Audiobookshelf UI Rework

#### [MODIFY] [homelab/integrations/audiobookshelf.py](file:///Users/chris/homelab-dashboard/homelab/integrations/audiobookshelf.py)
*   Increase `limit` in `items_resp` from 5 to 10 or 15 to populate the horizontal scroll.

#### [MODIFY] [templates/partials/widget_audiobookshelf.html](file:///Users/chris/homelab-dashboard/templates/partials/widget_audiobookshelf.html)
*   **Layout**: Change from vertical list to horizontal scroll (`flex-row`, `overflow-x-auto`).
*   **Card Style**:
    *   Show larger covers (e.g., `w-24 h-36`).
    *   Overlay title/author on hover or show below.
    *   Use `snap-x` for smooth scrolling.
    *   Hide scrollbar but allow scrolling.

## Verification Plan
### Manual Verification
1.  **Audiobookshelf Widget**:
    *   Verify books appear in a horizontal row.
    *   Verify scrolling works (drag or trackpad).
    *   Verify covers load correctly.
    *   Verify hover effects (if added).
