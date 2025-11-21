/**
 * Drag and Drop Module for Homelab Dashboard
 * Handles smooth card reordering with live preview
 */

const DragDrop = (function() {
  let draggedCard = null;
  let placeholder = null;
  let offsetX = 0;
  let offsetY = 0;
  let grid = null;
  let lastSave = 0;
  const SAVE_THROTTLE_MS = 400;

  function init() {
    grid = document.querySelector('#apps-grid .grid');
    if (!grid) return;

    document.querySelectorAll('.app-card').forEach(card => {
      const handle = card.querySelector('.drag-handle');
      if (!handle) return;
      handle.onpointerdown = (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        startDrag(card, e.clientX, e.clientY);
      };
    });
  }

  function startDrag(card, clientX, clientY) {
    draggedCard = card;
    const rect = card.getBoundingClientRect();
    offsetX = clientX - rect.left;
    offsetY = clientY - rect.top;

    placeholder = document.createElement('div');
    placeholder.className = 'drag-placeholder';
    placeholder.style.width = `${rect.width}px`;
    placeholder.style.height = `${rect.height}px`;

    card.classList.add('dragging');
    Object.assign(card.style, {
      position: 'fixed',
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      left: `${clientX - offsetX}px`,
      top: `${clientY - offsetY}px`,
      zIndex: '1000',
      pointerEvents: 'none'
    });

    card.parentNode.insertBefore(placeholder, card);
    document.body.appendChild(card);

    document.addEventListener('pointermove', onDrag, { passive: false });
    document.addEventListener('pointerup', endDrag, { passive: true, once: true });
  }

  function onDrag(e) {
    if (!draggedCard) return;
    e.preventDefault();
    moveTo(e.clientX, e.clientY);
  }

  function moveTo(clientX, clientY) {
    draggedCard.style.left = `${clientX - offsetX}px`;
    draggedCard.style.top = `${clientY - offsetY}px`;

    // Find nearest card center (more stable at edges) and use that for placement
    const candidates = [...document.querySelectorAll('.app-card')].filter(c => c !== draggedCard);
    let target = null;
    let targetRect = null;
    let bestDist = Infinity;
    candidates.forEach(card => {
      const rect = card.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const d = Math.hypot(clientX - cx, clientY - cy);
      if (d < bestDist) {
        bestDist = d;
        target = card;
        targetRect = rect;
      }
    });

    document.querySelectorAll('.app-card').forEach(c => c.classList.remove('drag-over'));

    if (target && target !== draggedCard && targetRect) {
      target.classList.add('drag-over');
      const before = clientY < targetRect.top + targetRect.height / 2 ||
        (Math.abs(clientY - (targetRect.top + targetRect.height / 2)) < targetRect.height / 3 &&
         clientX < targetRect.left + targetRect.width / 2);
      if (before) {
        target.parentNode.insertBefore(placeholder, target);
      } else {
        target.parentNode.insertBefore(placeholder, target.nextSibling);
      }
    } else if (grid && placeholder && !grid.contains(placeholder)) {
      grid.appendChild(placeholder);
    }
  }

  function endDrag() {
    if (!draggedCard) return;

    document.removeEventListener('pointermove', onDrag);

    draggedCard.classList.remove('dragging');
    ['position','width','height','left','top','zIndex','pointerEvents'].forEach(p => draggedCard.style[p] = '');

    if (placeholder && placeholder.parentNode) {
      placeholder.parentNode.insertBefore(draggedCard, placeholder);
      placeholder.remove();
    }

    document.querySelectorAll('.app-card').forEach(c => c.classList.remove('drag-over'));

    const order = [...document.querySelectorAll('.app-card')]
      .map(c => c.dataset.appName)
      .filter(Boolean)
      .filter((name, idx, arr) => arr.indexOf(name) === idx);
    const now = Date.now();
    if (order.length && now - lastSave > SAVE_THROTTLE_MS) {
      lastSave = now;
      fetch('/api/apps/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order })
      }).catch(err => console.error('Reorder failed:', err));
    }

    draggedCard = null;
    placeholder = null;
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', DragDrop.init);
document.body.addEventListener('htmx:afterSwap', (e) => {
  if (e.detail.target?.id === 'apps-grid') {
    DragDrop.init();
  }
});
