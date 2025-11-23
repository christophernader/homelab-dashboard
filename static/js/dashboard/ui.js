/**
 * Dashboard UI Logic
 * Handles theme, edit mode, drag-and-drop, and location settings.
 */

let editMode = false;
let pendingClose = false;
let sortableInstance = null;
let lightMode = localStorage.getItem('lightMode') === 'true';

// Initialize theme
function initTheme() {
    if (lightMode) {
        document.body.classList.add('light-mode');
        const icon = document.getElementById('theme-icon');
        if (icon) icon.className = 'fa-solid fa-moon text-xs';
    }
}

function toggleTheme() {
    lightMode = !lightMode;
    localStorage.setItem('lightMode', lightMode);
    document.body.classList.toggle('light-mode', lightMode);
    const icon = document.getElementById('theme-icon');
    if (icon) icon.className = lightMode ? 'fa-solid fa-moon text-xs' : 'fa-solid fa-sun text-xs';
}

function toggleEditMode() {
    if (pendingClose) return;
    editMode = !editMode;
    const panel = document.getElementById('edit-panel');
    const overlay = document.getElementById('edit-overlay');
    const toggleText = document.getElementById('edit-toggle-text');

    if (editMode) {
        panel.classList.remove('translate-x-full');
        overlay.classList.remove('hidden');
        requestAnimationFrame(() => overlay.classList.remove('opacity-0'));
        toggleText.textContent = 'CLOSE';
    } else {
        panel.classList.add('translate-x-full');
        overlay.classList.add('opacity-0');
        setTimeout(() => overlay.classList.add('hidden'), 300);
        toggleText.textContent = 'ADD SERVICE';
    }
}

// Initialize SortableJS
function initSortable() {
    const grid = document.getElementById('apps-grid');
    if (!grid) return;

    if (sortableInstance) {
        sortableInstance.destroy();
    }

    sortableInstance = new Sortable(grid, {
        animation: 150,
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        dragClass: 'sortable-drag',
        handle: '.drag-handle',
        onEnd: function (evt) {
            const cards = grid.querySelectorAll('.app-card');
            const order = [...cards].map(c => c.dataset.appName);

            fetch('/api/apps/reorder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order })
            }).catch(err => console.error('Reorder failed:', err));
        }
    });
}

// Initialize everything when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initSortable();

    // Icon selection
    document.addEventListener('click', (e) => {
        const tile = e.target.closest('[data-icon-url]');
        if (!tile) return;
        const urlInput = document.getElementById('icon-url');
        const preview = document.getElementById('icon-preview');
        if (urlInput) urlInput.value = tile.dataset.iconUrl;
        if (preview) preview.src = tile.dataset.iconUrl;
        document.querySelectorAll('[data-icon-url]').forEach(t => t.classList.remove('ring-1', 'ring-mil-accent'));
        tile.classList.add('ring-1', 'ring-mil-accent');
    });

    // Form success
    document.body.addEventListener('app_added', (e) => {
        const slot = document.getElementById('form-message');
        if (slot) {
            slot.innerHTML = `<div class="flex items-center gap-2 p-3 border border-mil-success text-mil-success text-xs font-mono uppercase tracking-wider"><i class="fa-solid fa-check"></i> SERVICE ADDED</div>`;
            document.getElementById('add-app-form')?.reset();
            const preview = document.getElementById('icon-preview');
            const urlInput = document.getElementById('icon-url');
            // Reset to default icon if available (passed via template)
            // We'll handle this gracefully if defaults aren't available in JS scope

            // Clear message after 3 seconds
            setTimeout(() => {
                slot.innerHTML = '';
            }, 3000);
        }
    });

    // Re-init after HTMX swaps
    document.body.addEventListener('htmx:afterSwap', (e) => {
        if (e.detail.target?.id === 'apps-container') {
            initSortable();
            // Re-process HTMX attributes for delete buttons
            if (typeof htmx !== 'undefined') {
                htmx.process(document.getElementById('apps-container'));
            }
        }
    });

    // Generic HTMX Notification Handler
    document.body.addEventListener('htmx:afterOnLoad', (e) => {
        const xhr = e.detail.xhr;
        const contentType = xhr.getResponseHeader('Content-Type');

        if (xhr.status >= 200 && xhr.status < 300) {
            if (contentType && contentType.includes('application/json')) {
                try {
                    const resp = JSON.parse(xhr.responseText);
                    if (resp.message) {
                        showToast(resp.message, resp.status === 'error' ? 'error' : 'success');
                    }
                } catch (err) {
                    // Silent fail for non-JSON or malformed JSON
                }
            }
        } else if (xhr.status >= 400) {
            if (contentType && contentType.includes('application/json')) {
                try {
                    const resp = JSON.parse(xhr.responseText);
                    if (resp.message) {
                        showToast(resp.message, 'error');
                    }
                } catch (err) {
                    showToast('An error occurred', 'error');
                }
            } else {
                showToast('An error occurred', 'error');
            }
        }

        // Reload on specific setting changes for immediate feedback
        const path = e.detail.xhr.responseURL;
        if (path && (
            path.includes('/api/settings/dashboard/news_ticker_enabled/toggle') ||
            path.includes('/api/settings/dashboard/weather_bar_enabled/toggle') ||
            path.includes('/api/settings/dashboard/crypto_bar_enabled/toggle') ||
            path.includes('/api/settings/appearance/show_loading_screen/toggle')
        )) {
            setTimeout(() => window.location.reload(), 500);
        }
    });

    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `fixed bottom-4 right-4 px-4 py-3 rounded shadow-lg text-xs font-mono uppercase tracking-wider z-50 transition-all duration-300 transform translate-y-10 opacity-0 ${type === 'error' ? 'bg-mil-error text-mil-black' : 'bg-mil-success text-mil-black'
            }`;
        toast.textContent = message;
        document.body.appendChild(toast);

        requestAnimationFrame(() => {
            toast.classList.remove('translate-y-10', 'opacity-0');
        });

        setTimeout(() => {
            toast.classList.add('translate-y-10', 'opacity-0');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // --- Auto-Detect & Edit App Logic ---

    window.openEditApp = async function (name) {
        try {
            const resp = await fetch(`/api/apps/${encodeURIComponent(name)}`);
            if (!resp.ok) throw new Error('Failed to fetch app');
            const app = await resp.json();

            // Populate form
            document.getElementById('original-name').value = app.name;
            document.getElementById('app-name').value = app.name;
            document.getElementById('app-url').value = app.url;
            document.getElementById('icon-url').value = app.icon || '';
            document.getElementById('icon-preview').src = app.icon || '{{ default_icon }}';

            // Update UI for Edit Mode
            document.getElementById('edit-panel-title').textContent = 'EDIT SERVICE';
            document.getElementById('submit-text').textContent = 'SAVE CHANGES';

            // Update HTMX attributes manually for Edit
            const form = document.getElementById('add-app-form');
            form.setAttribute('hx-put', `/api/apps/${encodeURIComponent(name)}`);
            htmx.process(form); // Re-process to pick up new attribute

            // Handle form submission manually to support PUT
            form.onsubmit = function (e) {
                e.preventDefault();
                const formData = new FormData(form);

                fetch(`/api/apps/${encodeURIComponent(name)}`, {
                    method: 'PUT',
                    body: formData
                }).then(async r => {
                    if (r.ok) {
                        toggleEditMode();
                        htmx.trigger('#apps-container', 'load'); // Refresh grid
                        showToast('App updated successfully');
                    } else {
                        showToast('Update failed', 'error');
                    }
                });
            };

            // Hide Auto-Detect section in Edit Mode
            document.getElementById('auto-detect-section').classList.add('hidden');

            toggleEditMode();
        } catch (err) {
            showToast('Error loading app details', 'error');
        }
    };

    // Reset form when closing or opening fresh
    const originalToggleEditMode = window.toggleEditMode;
    window.toggleEditMode = function () {
        const panel = document.getElementById('edit-panel');
        const isClosed = panel.classList.contains('translate-x-full');

        if (isClosed) {
            // Reset to "Add Mode" defaults
            document.getElementById('add-app-form').reset();
            document.getElementById('original-name').value = '';
            document.getElementById('edit-panel-title').textContent = 'ADD SERVICE';
            document.getElementById('submit-text').textContent = 'ADD TO DASHBOARD';
            document.getElementById('auto-detect-section').classList.remove('hidden');
            document.getElementById('auto-detect-preview').classList.add('hidden');
            document.getElementById('detected-apps-list').innerHTML = '';

            // Reset form submission handler
            const form = document.getElementById('add-app-form');
            form.onsubmit = null; // Remove custom PUT handler
            form.setAttribute('hx-post', '/api/apps/add');
            htmx.process(form);
        }

        originalToggleEditMode();
    };

    window.autoDetectApps = async function () {
        const btn = document.querySelector('#auto-detect-section button');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i> SCANNING...';
        btn.disabled = true;

        try {
            const resp = await fetch('/api/apps/autodiscover');
            const apps = await resp.json();

            const list = document.getElementById('detected-apps-list');
            list.innerHTML = '';

            if (apps.length === 0) {
                list.innerHTML = '<p class="text-xs text-mil-muted font-mono">No new services found.</p>';
            } else {
                apps.forEach(app => {
                    const div = document.createElement('div');
                    div.className = 'flex items-center gap-3 p-2 bg-mil-black border border-mil-border';
                    div.innerHTML = `
                        <input type="checkbox" class="accent-mil-accent" checked value='${JSON.stringify(app)}'>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2">
                                <span class="text-xs font-mono font-bold text-mil-text truncate">${app.name}</span>
                                <span class="text-[9px] font-mono text-mil-muted uppercase bg-mil-dark px-1 border border-mil-border">DETECTED</span>
                            </div>
                            <div class="text-[10px] font-mono text-mil-muted truncate">${app.url}</div>
                        </div>
                    `;
                    list.appendChild(div);
                });
            }

            document.getElementById('auto-detect-preview').classList.remove('hidden');
        } catch (err) {
            showToast('Scan failed', 'error');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    };

    window.importSelectedApps = async function () {
        const selected = [];
        document.querySelectorAll('#detected-apps-list input:checked').forEach(cb => {
            selected.push(JSON.parse(cb.value));
        });

        if (selected.length === 0) {
            showToast('No apps selected', 'error');
            return;
        }

        try {
            const resp = await fetch('/api/apps/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(selected)
            });

            if (resp.ok) {
                showToast(`Imported ${selected.length} apps`);
                toggleEditMode();
                htmx.trigger('#apps-container', 'load');
            } else {
                showToast('Import failed', 'error');
            }
        } catch (err) {
            showToast('Error importing apps', 'error');
        }
    };

    // Geolocation
    if (window.locationSettings && window.locationSettings.useAuto && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const lat = pos.coords.latitude;
                const lon = pos.coords.longitude;

                // Update weather bar with browser location
                const weatherBar = document.getElementById('weather-bar');
                if (weatherBar && typeof htmx !== 'undefined') {
                    weatherBar.setAttribute('hx-get', `/api/widgets/weather-bar?lat=${lat}&lon=${lon}`);
                    htmx.process(weatherBar);
                    htmx.trigger(weatherBar, 'load');
                }

                // Update weather widget if exists
                const weatherContainer = document.getElementById('weather-container');
                if (weatherContainer && typeof htmx !== 'undefined') {
                    weatherContainer.setAttribute('hx-get', `/api/widgets/weather?lat=${lat}&lon=${lon}`);
                    htmx.process(weatherContainer);
                    htmx.trigger(weatherContainer, 'load');
                }
            },
            () => console.log('Geolocation denied or unavailable')
        );
    } else if (window.locationSettings && !window.locationSettings.useAuto) {
        console.log('Using manual location settings');
    }
});
