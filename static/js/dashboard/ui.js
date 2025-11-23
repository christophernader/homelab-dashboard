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

    // Edit app button (delegated)
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-edit-app]');
        if (!btn) return;
        e.preventDefault();
        e.stopPropagation();
        const appName = btn.dataset.editApp;
        if (appName && typeof openEditApp === 'function') {
            openEditApp(appName);
        }
    });

    // Delete app button (delegated) - custom confirmation
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-delete-app]');
        if (!btn) return;
        e.preventDefault();
        e.stopPropagation();
        const appName = btn.dataset.deleteApp;
        if (appName) {
            showDeleteConfirm(appName);
        }
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

        // Close edit panel on successful app add/update
        const reqPath = e.detail.requestConfig?.path || '';
        if (xhr.status >= 200 && xhr.status < 300) {
            if (reqPath.includes('/api/apps/add') || (e.detail.requestConfig?.verb === 'put' && reqPath.includes('/api/apps/'))) {
                closeEditPanel();
                showToast('Service saved');
            }
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

    // Delete confirmation modal
    function showDeleteConfirm(appName) {
        // Remove any existing modal
        document.getElementById('delete-modal')?.remove();

        const modal = document.createElement('div');
        modal.id = 'delete-modal';
        modal.className = 'fixed inset-0 bg-black/80 z-[100] flex items-center justify-center';
        modal.innerHTML = `
            <div class="bg-mil-dark border border-mil-border p-6 max-w-sm w-full mx-4">
                <h3 class="text-sm font-mono font-bold text-mil-text uppercase tracking-wider mb-4">Delete Service</h3>
                <p class="text-xs font-mono text-mil-muted mb-6">Are you sure you want to delete <span class="text-mil-text">${appName}</span>?</p>
                <div class="flex gap-3">
                    <button id="cancel-delete" class="flex-1 px-4 py-2 border border-mil-border text-mil-muted font-mono text-xs uppercase tracking-wider hover:border-mil-text hover:text-mil-text transition">
                        Cancel
                    </button>
                    <button id="confirm-delete" class="flex-1 px-4 py-2 bg-mil-error text-mil-black font-mono text-xs uppercase tracking-wider font-bold hover:bg-mil-error/80 transition">
                        Delete
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Handle cancel
        document.getElementById('cancel-delete').onclick = () => modal.remove();
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

        // Handle confirm
        document.getElementById('confirm-delete').onclick = async () => {
            try {
                const resp = await fetch(`/api/apps/${encodeURIComponent(appName)}`, { method: 'DELETE' });
                if (resp.ok) {
                    modal.remove();
                    showToast('Service deleted');
                    htmx.ajax('GET', '/api/apps', '#apps-container');
                } else {
                    showToast('Delete failed', 'error');
                }
            } catch (err) {
                showToast('Delete failed', 'error');
            }
        };
    }

    // --- Auto-Detect & Edit App Logic ---

    let isEditMode = false; // Track if we're opening in edit mode

    window.openEditApp = async function (name) {
        try {
            const resp = await fetch(`/api/apps/${encodeURIComponent(name)}`);
            if (!resp.ok) throw new Error('Failed to fetch app');
            const app = await resp.json();

            // Set edit mode flag BEFORE opening panel
            isEditMode = true;

            // Open panel first (without reset since isEditMode is true)
            const panel = document.getElementById('edit-panel');
            const overlay = document.getElementById('edit-overlay');
            if (panel.classList.contains('translate-x-full')) {
                panel.classList.remove('translate-x-full');
                overlay.classList.remove('hidden');
                requestAnimationFrame(() => overlay.classList.remove('opacity-0'));
                editMode = true;
            }

            // Now populate form AFTER panel is open
            document.getElementById('original-name').value = app.name;
            document.getElementById('app-name').value = app.name;
            document.getElementById('app-url').value = app.url;
            document.getElementById('icon-url').value = app.icon || '';
            const iconPreview = document.getElementById('icon-preview');
            if (iconPreview) {
                iconPreview.src = app.icon || iconPreview.dataset.defaultIcon || '';
            }

            // Update UI for Edit Mode
            document.getElementById('edit-panel-title').textContent = 'EDIT SERVICE';
            document.getElementById('submit-text').textContent = 'SAVE CHANGES';
            document.getElementById('submit-btn').querySelector('i').className = 'fa-solid fa-check text-xs';

            // Hide Auto-Detect section in Edit Mode
            document.getElementById('auto-detect-section').classList.add('hidden');
            document.getElementById('panel-footer').classList.add('hidden');

            // Configure HTMX for Edit Mode
            const form = document.getElementById('add-app-form');

            // Remove POST attributes
            form.removeAttribute('hx-post');

            // Add PUT attributes
            form.setAttribute('hx-put', `/api/apps/${encodeURIComponent(app.name)}`);
            form.setAttribute('hx-target', '#apps-container');
            form.setAttribute('hx-swap', 'innerHTML');

            // Process with HTMX
            if (typeof htmx !== 'undefined') {
                htmx.process(form);
            }

            // Remove manual submit handler if it exists
            form.onsubmit = null;

        } catch (err) {
            console.error('Edit error:', err);
            showToast('Error loading service details', 'error');
        }
    };

    // Close panel and reset
    window.closeEditPanel = function () {
        const panel = document.getElementById('edit-panel');
        const overlay = document.getElementById('edit-overlay');

        panel.classList.add('translate-x-full');
        overlay.classList.add('opacity-0');
        setTimeout(() => overlay.classList.add('hidden'), 300);

        editMode = false;
        isEditMode = false;

        // Reset form
        resetEditForm();
    };

    function resetEditForm() {
        const form = document.getElementById('add-app-form');
        form.reset();
        form.onsubmit = null;
        document.getElementById('original-name').value = '';
        document.getElementById('edit-panel-title').textContent = 'ADD SERVICE';
        document.getElementById('submit-text').textContent = 'ADD TO DASHBOARD';
        document.getElementById('submit-btn').querySelector('i').className = 'fa-solid fa-plus text-xs';
        document.getElementById('auto-detect-section').classList.remove('hidden');
        document.getElementById('auto-detect-preview').classList.add('hidden');
        document.getElementById('detected-apps-list').innerHTML = '';
        document.getElementById('panel-footer')?.classList.remove('hidden');

        // Reset icon preview to default
        const iconPreview = document.getElementById('icon-preview');
        if (iconPreview && iconPreview.dataset.defaultIcon) {
            iconPreview.src = iconPreview.dataset.defaultIcon;
            document.getElementById('icon-url').value = iconPreview.dataset.defaultIcon;
        }

        // Restore HTMX attributes
        form.setAttribute('hx-post', '/api/apps/add');
        form.setAttribute('hx-target', '#apps-container');
        form.setAttribute('hx-swap', 'innerHTML');
        if (typeof htmx !== 'undefined') htmx.process(form);
    }

    // Override toggleEditMode to use new close function
    const originalToggleEditMode = window.toggleEditMode;
    window.toggleEditMode = function () {
        const panel = document.getElementById('edit-panel');
        const isClosed = panel.classList.contains('translate-x-full');

        if (!isClosed) {
            // Closing - use new close function
            closeEditPanel();
        } else {
            // Opening fresh (Add mode) - reset first, then open
            if (!window.isEditMode) {
                resetEditForm();
            }
            originalToggleEditMode();
        }
    };

    window.autoDetectApps = async function () {
        const btn = document.getElementById('auto-detect-btn');
        const progress = document.getElementById('scan-progress');
        const progressBar = document.getElementById('scan-progress-bar');
        const statusText = document.getElementById('scan-status');
        const originalText = btn.innerHTML;

        btn.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i> SCANNING...';
        btn.disabled = true;
        progress.classList.remove('hidden');

        // Simulate progress stages
        const stages = [
            { pct: 20, text: 'Connecting to Docker...' },
            { pct: 40, text: 'Scanning containers...' },
            { pct: 60, text: 'Parsing labels & ports...' },
            { pct: 80, text: 'Resolving icons...' },
            { pct: 100, text: 'Complete!' }
        ];

        let stageIdx = 0;
        const progressInterval = setInterval(() => {
            if (stageIdx < stages.length - 1) {
                progressBar.style.width = stages[stageIdx].pct + '%';
                statusText.textContent = stages[stageIdx].text;
                stageIdx++;
            }
        }, 400);

        try {
            const resp = await fetch('/api/apps/autodiscover');
            const apps = await resp.json();

            // Complete progress
            clearInterval(progressInterval);
            progressBar.style.width = '100%';
            statusText.textContent = `Found ${apps.length} service(s)`;

            const list = document.getElementById('detected-apps-list');
            list.innerHTML = '';

            if (apps.length === 0) {
                list.innerHTML = '<p class="text-xs text-mil-muted font-mono">No new services found.</p>';
            } else {
                apps.forEach(app => {
                    // Fix localhost/127.0.0.1 to match current hostname
                    if (app.url.includes('localhost') || app.url.includes('127.0.0.1')) {
                        app.url = app.url.replace(/localhost|127\.0\.0\.1/g, window.location.hostname);
                    }

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
            clearInterval(progressInterval);
            showToast('Scan failed', 'error');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
            // Hide progress after a short delay
            setTimeout(() => {
                progress.classList.add('hidden');
                progressBar.style.width = '0%';
            }, 2000);
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
});

// Global functions for edit panel
window.isEditMode = false;

window.closeEditPanel = function () {
    const panel = document.getElementById('edit-panel');
    const overlay = document.getElementById('edit-overlay');

    panel.classList.add('translate-x-full');
    overlay.classList.add('opacity-0');
    setTimeout(() => overlay.classList.add('hidden'), 300);

    editMode = false;
    window.isEditMode = false;

    // Reset form
    resetEditForm();
};

function resetEditForm() {
    const form = document.getElementById('add-app-form');
    if (!form) return;

    form.reset();
    form.onsubmit = null;
    document.getElementById('original-name').value = '';
    document.getElementById('edit-panel-title').textContent = 'ADD SERVICE';
    document.getElementById('submit-text').textContent = 'ADD TO DASHBOARD';
    document.getElementById('submit-btn').querySelector('i').className = 'fa-solid fa-plus text-xs';
    document.getElementById('auto-detect-section').classList.remove('hidden');
    document.getElementById('auto-detect-preview').classList.add('hidden');
    document.getElementById('detected-apps-list').innerHTML = '';
    document.getElementById('panel-footer')?.classList.remove('hidden');

    // Reset icon preview to default
    const iconPreview = document.getElementById('icon-preview');
    if (iconPreview && iconPreview.dataset.defaultIcon) {
        iconPreview.src = iconPreview.dataset.defaultIcon;
        document.getElementById('icon-url').value = iconPreview.dataset.defaultIcon;
    }

    // Restore HTMX attributes
    form.setAttribute('hx-post', '/api/apps/add');
    form.setAttribute('hx-target', '#apps-container');
    form.setAttribute('hx-swap', 'innerHTML');
    if (typeof htmx !== 'undefined') htmx.process(form);
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

// Audiobook Marquee Logic
function initAudiobookMarquee() {
    const container = document.getElementById('audiobook-scroll-container');

    if (!container) {
        console.log('Audiobook container not found');
        return;
    }

    if (container.dataset.marqueeInitialized) {
        console.log('Audiobook marquee already initialized');
        return;
    }

    console.log('Initializing audiobook marquee...', {
        scrollWidth: container.scrollWidth,
        clientWidth: container.clientWidth
    });

    container.dataset.marqueeInitialized = 'true';

    let scrollPos = 0;
    let speed = 1.0; // Increased speed for more visible movement
    let currentSpeed = 1.0;
    let isHovered = false;
    let lastTime = performance.now();
    let animationId;

    function animate(time) {
        if (!document.body.contains(container)) {
            cancelAnimationFrame(animationId);
            return;
        }

        const dt = time - lastTime;
        lastTime = time;

        // Target speed logic: 0 if hovered, base speed otherwise
        const targetSpeed = isHovered ? 0 : speed;

        // Smoothly interpolate current speed to target speed
        currentSpeed += (targetSpeed - currentSpeed) * 0.05;

        // Only scroll if speed is significant
        if (Math.abs(currentSpeed) > 0.01) {
            scrollPos += currentSpeed;

            // Seamless loop - reset when we've scrolled past half
            const halfWidth = container.scrollWidth / 2;

            if (scrollPos >= halfWidth) {
                scrollPos = 0;
            }

            container.scrollLeft = scrollPos;
        }

        animationId = requestAnimationFrame(animate);
    }

    container.addEventListener('mouseenter', () => {
        console.log('Audiobook hover: pausing');
        isHovered = true;
    });

    container.addEventListener('mouseleave', () => {
        console.log('Audiobook hover: resuming');
        isHovered = false;
    });

    // Start animation
    console.log('Starting audiobook animation');
    animationId = requestAnimationFrame(animate);
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => initAudiobookMarquee(), 500);
    });
} else {
    // DOM already loaded
    setTimeout(() => initAudiobookMarquee(), 500);
}

// Re-init on HTMX swaps
document.body.addEventListener('htmx:afterSwap', (e) => {
    if (e.detail.target && e.detail.target.querySelector('#audiobook-scroll-container')) {
        setTimeout(() => initAudiobookMarquee(), 500);
    }
});

// Fallback check
setInterval(() => {
    const container = document.getElementById('audiobook-scroll-container');
    if (container && !container.dataset.marqueeInitialized) {
        console.log('Fallback: Initializing audiobook marquee');
        initAudiobookMarquee();
    }
}, 2000);
