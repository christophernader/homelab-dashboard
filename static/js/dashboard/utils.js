/**
 * Dashboard Utilities
 * Shared helper functions
 */

export function showToast(message, type = 'success') {
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
