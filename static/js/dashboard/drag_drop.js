/**
 * Drag and Drop Logic
 * Uses SortableJS for app reordering
 */

let sortableInstance = null;

export function initSortable() {
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

// Initialize on load
document.addEventListener('DOMContentLoaded', initSortable);

// Re-init after HTMX swaps
document.body.addEventListener('htmx:afterSwap', (e) => {
    if (e.detail.target?.id === 'apps-container') {
        initSortable();
    }
});
