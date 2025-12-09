/**
 * Core Loading Screen Logic - Optimized for Speed
 * "Instant Shell, Progressive Enhancement"
 * 
 * Strategy:
 * 1. Show dashboard shell immediately with CSS skeleton animations
 * 2. Load all data in PARALLEL (not sequential)
 * 3. Animate content in as data arrives
 * 4. Auto-transition without requiring user interaction
 */

const LoadingScreen = (function () {
    let scene, camera, renderer, animationId;
    let time = 0;
    let loadStartTime = performance.now();
    let isThreeInitialized = false;

    // Determine style from global or default to server
    const style = window.loadingScreenStyle || 'server';

    // Loading steps with weights for progress calculation
    const loadingSteps = [
        { key: 'system', endpoint: '/api/system-info', message: 'HARDWARE SCAN', weight: 25, critical: true },
        { key: 'apps', endpoint: '/api/apps', message: 'SERVICES', weight: 20, critical: true },
        { key: 'stats', endpoint: '/api/stats', message: 'METRICS', weight: 15, critical: true },
        { key: 'threats', endpoint: '/api/widgets/threats-full', message: 'THREATS', weight: 10 },
        { key: 'weather', endpoint: '/api/widgets/weather-bar', message: 'WEATHER', weight: 10 },
        { key: 'crypto', endpoint: '/api/widgets/crypto-bar', message: 'CRYPTO', weight: 10 },
        { key: 'news', endpoint: '/api/widgets/news-detailed', message: 'NEWS', weight: 5 },
        { key: 'headlines', endpoint: '/api/widgets/headlines', message: 'HEADLINES', weight: 5 }
    ];

    window.preloadedData = {};

    function init() {
        // If loading screen is disabled, load data directly
        if (!window.showLoadingScreen) {
            loadAllDataParallel().then(() => {
                injectPreloadedData();
                triggerEntranceAnimations();
                document.body.classList.add('loaded');
            });
            return;
        }

        const container = document.getElementById('terrain-container');
        if (!container) {
            finishLoading();
            return;
        }

        // Start data loading immediately (don't wait for 3D)
        loadAllDataParallel();

        // Defer Three.js initialization slightly to prioritize data fetch
        if (typeof THREE !== 'undefined') {
            requestAnimationFrame(() => initThreeScene(container));
        }

        updateBootTime();
    }

    function initThreeScene(container) {
        if (isThreeInitialized) return;
        isThreeInitialized = true;

        scene = new THREE.Scene();
        renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance'
        });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // Cap for performance
        renderer.setClearColor(0x0a0a0a, 1);
        container.appendChild(renderer.domElement);

        camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);

        if (style === 'terrain') {
            if (typeof VizTerrain !== 'undefined') {
                VizTerrain.init(scene, camera, renderer, container);
            }
        } else {
            if (typeof VizServer !== 'undefined') {
                VizServer.init(scene, camera, renderer, container);
            }
        }

        window.addEventListener('resize', onResize, { passive: true });
        animate();
    }

    function animate() {
        animationId = requestAnimationFrame(animate);
        time += style === 'terrain' ? 0.008 : 0.01;

        if (style === 'terrain') {
            if (typeof VizTerrain !== 'undefined') VizTerrain.update(time, camera);
        } else {
            if (typeof VizServer !== 'undefined') VizServer.update(time);
        }

        if (renderer && scene && camera) {
            renderer.render(scene, camera);
        }
    }

    function onResize() {
        if (!camera || !renderer) return;
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    /**
     * Load all data in PARALLEL for maximum speed
     * This is the key optimization - replaces sequential loading
     */
    async function loadAllDataParallel() {
        const loadBar = document.getElementById('load-bar');
        const loadPercent = document.getElementById('load-percent');
        const loadStatus = document.getElementById('load-status');
        const systemLog = document.getElementById('system-log');

        let completedWeight = 0;
        const totalWeight = loadingSteps.reduce((sum, step) => sum + step.weight, 0);

        // Create all fetch promises at once
        const fetchPromises = loadingSteps.map(step => {
            return fetch(step.endpoint)
                .then(async response => {
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);

                    const data = step.key === 'system'
                        ? await response.json()
                        : await response.text();

                    // Update progress immediately when each item completes
                    completedWeight += step.weight;
                    const percent = Math.round((completedWeight / totalWeight) * 100);

                    if (loadBar) loadBar.style.width = percent + '%';
                    if (loadPercent) loadPercent.textContent = percent + '%';
                    if (loadStatus) loadStatus.textContent = step.message;

                    // Add to system log with typing effect
                    if (systemLog) {
                        addLogEntry(systemLog, `> ${step.message}... OK`);
                    }

                    return { key: step.key, data, success: true };
                })
                .catch(error => {
                    console.warn(`Failed to load ${step.key}:`, error);
                    completedWeight += step.weight; // Still count as "complete"

                    if (systemLog) {
                        addLogEntry(systemLog, `> ${step.message}... SKIP`, true);
                    }

                    return { key: step.key, data: null, success: false };
                });
        });

        // Wait for ALL requests to complete (parallel!)
        const results = await Promise.allSettled(fetchPromises);

        // Process results
        results.forEach(result => {
            if (result.status === 'fulfilled' && result.value.success) {
                const { key, data } = result.value;
                if (key === 'system') {
                    // Update viz with system data
                    if (style === 'server' && typeof VizServer !== 'undefined') {
                        VizServer.updatePinoutLabels(data);
                        VizServer.showPinouts();
                    }
                } else {
                    window.preloadedData[key] = data;
                }
            }
        });

        // Finalize progress
        if (loadBar) loadBar.style.width = '100%';
        if (loadPercent) loadPercent.textContent = '100%';
        if (loadStatus) {
            loadStatus.innerHTML = '<span class="text-[#22c55e] font-bold">READY</span>';
        }

        // Log completion time
        const loadTime = ((performance.now() - loadStartTime) / 1000).toFixed(2);
        if (systemLog) {
            addLogEntry(systemLog, `> COMPLETE [${loadTime}s]`);
        }

        // Auto-transition after brief pause for visual polish
        setTimeout(() => finishLoading(), 400);
    }

    function addLogEntry(container, text, isError = false) {
        const entry = document.createElement('div');
        entry.className = isError ? 'text-mil-error' : '';
        entry.textContent = text;
        container.appendChild(entry);

        // Keep only last 4 entries
        while (container.children.length > 4) {
            container.removeChild(container.firstChild);
        }

        // Scroll to bottom
        container.scrollTop = container.scrollHeight;
    }

    function updateBootTime() {
        const bootTimeEl = document.getElementById('boot-time');
        if (!bootTimeEl) return;

        const updateTime = () => {
            const elapsed = performance.now() - loadStartTime;
            const seconds = Math.floor(elapsed / 1000);
            const ms = Math.floor((elapsed % 1000) / 10);
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            bootTimeEl.textContent = String(mins).padStart(2, '0') + ':' +
                String(secs).padStart(2, '0') + ':' +
                String(ms).padStart(2, '0');

            if (document.getElementById('loading-screen')) {
                requestAnimationFrame(updateTime);
            }
        };
        updateTime();
    }

    function finishLoading() {
        const loadingScreen = document.getElementById('loading-screen');
        if (!loadingScreen) return;

        document.body.classList.add('loaded');

        // Fast, smooth fade out
        loadingScreen.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';
        loadingScreen.style.opacity = '0';
        loadingScreen.style.transform = 'scale(1.02)';

        setTimeout(() => {
            // Cleanup Three.js resources
            if (animationId) cancelAnimationFrame(animationId);
            if (renderer) {
                renderer.dispose();
                renderer.forceContextLoss();
            }
            window.removeEventListener('resize', onResize);

            loadingScreen.remove();

            // Inject data and trigger animations
            injectPreloadedData();
            triggerEntranceAnimations();
        }, 300);
    }

    function triggerEntranceAnimations() {
        const elements = document.querySelectorAll('[data-animate]');

        elements.forEach((el, index) => {
            // Stagger animations for smooth reveal
            const delay = 50 + (index * 60); // 60ms stagger

            setTimeout(() => {
                el.classList.add('animate-in');
            }, delay);
        });
    }

    function injectPreloadedData() {
        const injections = [
            { key: 'apps', target: '#apps-container' },
            { key: 'stats', target: '#live-stats' },
            { key: 'headlines', target: '#news-ticker' }
        ];

        injections.forEach(({ key, target }) => {
            if (window.preloadedData[key]) {
                const container = document.querySelector(target);
                if (container) {
                    container.innerHTML = window.preloadedData[key];

                    // Initialize sortable for apps
                    if (key === 'apps' && typeof initSortable === 'function') {
                        initSortable();
                    }
                }
            }
        });
    }

    return { init };
})();

// Initialize as soon as DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', LoadingScreen.init);
} else {
    LoadingScreen.init();
}
