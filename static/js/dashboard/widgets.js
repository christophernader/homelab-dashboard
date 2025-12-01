/**
 * Widget Logic
 * Handles specific widget functionality
 */

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
export function initAudiobookMarquee() {
    const container = document.getElementById('audiobook-scroll-container');

    if (!container) {
        return;
    }

    if (container.dataset.marqueeInitialized) {
        return;
    }

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
        isHovered = true;
    });

    container.addEventListener('mouseleave', () => {
        isHovered = false;
    });

    // Start animation
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
        initAudiobookMarquee();
    }
}, 2000);
