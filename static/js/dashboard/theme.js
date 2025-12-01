/**
 * Theme Management
 * Handles light/dark mode toggling
 */

let lightMode = localStorage.getItem('lightMode') === 'true';

export function initTheme() {
    if (lightMode) {
        document.body.classList.add('light-mode');
        updateThemeIcon();
    }
}

export function toggleTheme() {
    lightMode = !lightMode;
    localStorage.setItem('lightMode', lightMode);
    document.body.classList.toggle('light-mode', lightMode);
    updateThemeIcon();
}

function updateThemeIcon() {
    const icon = document.getElementById('theme-icon');
    if (icon) {
        icon.className = lightMode ? 'fa-solid fa-moon text-xs' : 'fa-solid fa-sun text-xs';
    }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', initTheme);

// Expose to window for onclick handlers
window.toggleTheme = toggleTheme;
