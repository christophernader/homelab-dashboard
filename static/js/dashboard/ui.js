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
        console.log('HTMX afterOnLoad:', e.detail);
        if (e.detail.xhr.status >= 200 && e.detail.xhr.status < 300) {
            try {
                const resp = JSON.parse(e.detail.xhr.responseText);
                console.log('Parsed response:', resp);
                if (resp.message) {
                    showToast(resp.message, resp.status === 'error' ? 'error' : 'success');
                }
            } catch (err) {
                console.error('JSON parse error:', err);
            }
        } else if (e.detail.xhr.status >= 400) {
            try {
                const resp = JSON.parse(e.detail.xhr.responseText);
                if (resp.message) {
                    showToast(resp.message, 'error');
                }
            } catch (err) {
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
        toast.className = `fixed bottom-4 right-4 px-4 py-2 border text-xs font-mono uppercase tracking-wider z-50 transition-all duration-300 transform translate-y-10 opacity-0 ${type === 'error'
            ? 'bg-mil-card border-mil-error text-mil-error'
            : 'bg-mil-card border-mil-success text-mil-success'
            }`;
        toast.innerHTML = `<i class="fa-solid ${type === 'error' ? 'fa-triangle-exclamation' : 'fa-check'} mr-2"></i> ${message}`;

        document.body.appendChild(toast);

        // Animate in
        requestAnimationFrame(() => {
            toast.classList.remove('translate-y-10', 'opacity-0');
        });

        // Remove after 3s
        setTimeout(() => {
            toast.classList.add('translate-y-10', 'opacity-0');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

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
