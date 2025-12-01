/**
 * Edit Panel Logic
 * Handles opening/closing the edit panel and form management
 */

import { showToast } from './utils.js';

let editMode = false;
let pendingClose = false;
export let isEditMode = false; // Track if we're opening in edit mode

export function toggleEditMode() {
    const panel = document.getElementById('edit-panel');
    const isClosed = panel.classList.contains('translate-x-full');

    if (!isClosed) {
        // Closing - use close function
        closeEditPanel();
    } else {
        // Opening fresh (Add mode) - reset first, then open
        if (!isEditMode) {
            resetEditForm();
        }
        openPanel();
    }
}

function openPanel() {
    if (pendingClose) return;
    editMode = true;
    const panel = document.getElementById('edit-panel');
    const overlay = document.getElementById('edit-overlay');
    const toggleText = document.getElementById('edit-toggle-text');

    panel.classList.remove('translate-x-full');
    overlay.classList.remove('hidden');
    requestAnimationFrame(() => overlay.classList.remove('opacity-0'));
    if (toggleText) toggleText.textContent = 'CLOSE';
}

export function closeEditPanel() {
    const panel = document.getElementById('edit-panel');
    const overlay = document.getElementById('edit-overlay');
    const toggleText = document.getElementById('edit-toggle-text');

    panel.classList.add('translate-x-full');
    overlay.classList.add('opacity-0');
    setTimeout(() => overlay.classList.add('hidden'), 300);
    if (toggleText) toggleText.textContent = 'ADD SERVICE';

    editMode = false;
    isEditMode = false;

    // Reset form
    resetEditForm();
}

export function resetEditForm() {
    const form = document.getElementById('add-app-form');
    if (!form) return;

    form.reset();
    form.onsubmit = null;
    const originalNameInput = document.getElementById('original-name');
    if (originalNameInput) originalNameInput.value = '';

    const title = document.getElementById('edit-panel-title');
    if (title) title.textContent = 'ADD SERVICE';

    const submitText = document.getElementById('submit-text');
    if (submitText) submitText.textContent = 'ADD TO DASHBOARD';

    const submitBtn = document.getElementById('submit-btn');
    if (submitBtn) {
        const icon = submitBtn.querySelector('i');
        if (icon) icon.className = 'fa-solid fa-plus text-xs';
    }

    const autoDetectSection = document.getElementById('auto-detect-section');
    if (autoDetectSection) autoDetectSection.classList.remove('hidden');

    const autoDetectPreview = document.getElementById('auto-detect-preview');
    if (autoDetectPreview) autoDetectPreview.classList.add('hidden');

    const detectedList = document.getElementById('detected-apps-list');
    if (detectedList) detectedList.innerHTML = '';

    const panelFooter = document.getElementById('panel-footer');
    if (panelFooter) panelFooter.classList.remove('hidden');

    // Reset icon preview to default
    const iconPreview = document.getElementById('icon-preview');
    if (iconPreview && iconPreview.dataset.defaultIcon) {
        iconPreview.src = iconPreview.dataset.defaultIcon;
        const iconUrl = document.getElementById('icon-url');
        if (iconUrl) iconUrl.value = iconPreview.dataset.defaultIcon;
    }

    // Restore HTMX attributes
    form.setAttribute('hx-post', '/api/apps/add');
    form.setAttribute('hx-target', '#apps-container');
    form.setAttribute('hx-swap', 'innerHTML');
    if (typeof htmx !== 'undefined') htmx.process(form);
}

export async function openEditApp(name) {
    try {
        const resp = await fetch(`/api/apps/${encodeURIComponent(name)}`);
        if (!resp.ok) throw new Error('Failed to fetch app');
        const app = await resp.json();

        // Set edit mode flag BEFORE opening panel
        isEditMode = true;

        // Open panel first
        const panel = document.getElementById('edit-panel');
        const overlay = document.getElementById('edit-overlay');
        if (panel.classList.contains('translate-x-full')) {
            openPanel();
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
}

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

// Close edit panel on successful app add/update
document.body.addEventListener('htmx:afterOnLoad', (e) => {
    const xhr = e.detail.xhr;
    const reqPath = e.detail.requestConfig?.path || '';
    if (xhr.status >= 200 && xhr.status < 300) {
        if (reqPath.includes('/api/apps/add') || (e.detail.requestConfig?.verb === 'put' && reqPath.includes('/api/apps/'))) {
            closeEditPanel();
            showToast('Service saved');
        }
    }
});

// Expose to window
window.toggleEditMode = toggleEditMode;
window.closeEditPanel = closeEditPanel;
window.openEditApp = openEditApp;
window.isEditMode = isEditMode;
