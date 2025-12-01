/**
 * App Management
 * Handles adding, editing, deleting, and auto-detecting apps
 */

import { showToast } from './utils.js';
import { openEditApp, toggleEditMode } from './edit_panel.js';

// Edit app button (delegated)
document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-edit-app]');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const appName = btn.dataset.editApp;
    if (appName) {
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

        // Clear message after 3 seconds
        setTimeout(() => {
            slot.innerHTML = '';
        }, 3000);
    }
});

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

export async function autoDetectApps() {
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
}

export async function importSelectedApps() {
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
}

// Expose to window
window.autoDetectApps = autoDetectApps;
window.importSelectedApps = importSelectedApps;
