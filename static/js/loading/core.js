/**
 * Core Loading Screen Logic
 * Orchestrates data fetching and visualization.
 */

const LoadingScreen = (function () {
    let scene, camera, renderer, animationId;
    let time = 0;
    let systemData = null;

    // Determine style from global or default to server
    const style = window.loadingScreenStyle || 'server';

    const loadingSteps = [
        { key: 'system', endpoint: '/api/system-info', message: 'SCANNING HARDWARE...', weight: 20 },
        { key: 'apps', endpoint: '/api/apps', message: 'LOADING SERVICES...', weight: 15 },
        { key: 'stats', endpoint: '/api/stats', message: 'FETCHING METRICS...', weight: 10 },
        { key: 'threats', endpoint: '/api/widgets/threats-full', message: 'THREAT ANALYSIS...', weight: 15 },
        { key: 'weather', endpoint: '/api/widgets/weather-bar', message: 'WEATHER DATA...', weight: 10 },
        { key: 'crypto', endpoint: '/api/widgets/crypto-bar', message: 'MARKET SYNC...', weight: 10 },
        { key: 'news', endpoint: '/api/widgets/news-detailed', message: 'INTEL FEEDS...', weight: 10 },
        { key: 'headlines', endpoint: '/api/widgets/headlines', message: 'AGGREGATING...', weight: 10 }
    ];

    window.preloadedData = {};

    function init() {
        // If loading screen is disabled, skip straight to data loading
        if (!window.showLoadingScreen) {
            loadAllData(true); // true = skip interaction
            return;
        }

        const container = document.getElementById('terrain-container');
        if (!container || typeof THREE === 'undefined') {
            finishLoading();
            return;
        }

        scene = new THREE.Scene();
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setClearColor(0x0a0a0a, 1);
        container.appendChild(renderer.domElement);

        // Initialize Camera (will be updated by viz modules)
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

        window.addEventListener('resize', onResize);
        animate();
        loadAllData(false);
        updateBootTime();
    }

    function animate() {
        animationId = requestAnimationFrame(animate);
        time += style === 'terrain' ? 0.008 : 0.01;

        if (style === 'terrain') {
            if (typeof VizTerrain !== 'undefined') VizTerrain.update(time, camera);
        } else {
            if (typeof VizServer !== 'undefined') VizServer.update(time);
        }

        renderer.render(scene, camera);
    }

    function onResize() {
        if (!camera || !renderer) return;
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    async function loadAllData(skipInteraction = false) {
        const loadBar = document.getElementById('load-bar');
        const loadPercent = document.getElementById('load-percent');
        const loadStatus = document.getElementById('load-status');
        let completedWeight = 0;

        for (const step of loadingSteps) {
            if (loadStatus) loadStatus.textContent = step.message;
            try {
                const response = await fetch(step.endpoint);
                if (response.ok) {
                    if (step.key === 'system') {
                        systemData = await response.json();
                        if (!skipInteraction && style === 'server' && typeof VizServer !== 'undefined') {
                            VizServer.updatePinoutLabels(systemData);
                            VizServer.showPinouts();
                        }
                    } else {
                        window.preloadedData[step.key] = await response.text();
                    }
                }
            } catch (e) { console.warn(`Failed to preload ${step.key}:`, e); }
            completedWeight += step.weight;
            if (loadBar) loadBar.style.width = completedWeight + '%';
            if (loadPercent) loadPercent.textContent = Math.floor(completedWeight) + '%';
        }

        if (loadBar) loadBar.style.width = '100%';
        if (loadPercent) loadPercent.textContent = '100%';

        if (skipInteraction) {
            injectPreloadedData();
            triggerEntranceAnimations();
            document.body.classList.add('loaded');
        } else {
            if (loadStatus) loadStatus.innerHTML = '<span class="text-[#22c55e]">SYSTEM READY</span><br><span class="text-[#666] text-[8px] mt-2 block animate-pulse">MOVE MOUSE TO CONTINUE</span>';
            waitForMouseToDismiss();
        }
    }

    function waitForMouseToDismiss() {
        const loadingScreen = document.getElementById('loading-screen');
        if (!loadingScreen) return;
        loadingScreen.style.pointerEvents = 'auto';
        loadingScreen.style.cursor = 'none';
        let dismissed = false;
        const handleInteraction = () => {
            if (dismissed) return;
            dismissed = true;
            loadingScreen.removeEventListener('mousemove', handleInteraction);
            loadingScreen.removeEventListener('click', handleInteraction);
            loadingScreen.removeEventListener('touchstart', handleInteraction);
            finishLoading();
        };
        loadingScreen.addEventListener('mousemove', handleInteraction);
        loadingScreen.addEventListener('click', handleInteraction);
        loadingScreen.addEventListener('touchstart', handleInteraction);
    }

    function updateBootTime() {
        const bootTimeEl = document.getElementById('boot-time');
        if (!bootTimeEl) return;
        const startTime = Date.now();
        const updateTime = () => {
            const elapsed = Date.now() - startTime;
            const seconds = Math.floor(elapsed / 1000);
            const ms = Math.floor((elapsed % 1000) / 10);
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            bootTimeEl.textContent = String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0') + ':' + String(ms).padStart(2, '0');
            if (document.getElementById('loading-screen')) requestAnimationFrame(updateTime);
        };
        updateTime();
    }

    function finishLoading() {
        const loadingScreen = document.getElementById('loading-screen');
        if (!loadingScreen) return;
        document.body.classList.add('loaded');
        loadingScreen.style.transition = 'opacity 0.5s ease-out';
        loadingScreen.style.opacity = '0';
        setTimeout(() => {
            if (animationId) cancelAnimationFrame(animationId);
            if (renderer) renderer.dispose();
            window.removeEventListener('resize', onResize);
            loadingScreen.remove();
            triggerEntranceAnimations();
            injectPreloadedData();
        }, 500);
    }

    function triggerEntranceAnimations() {
        document.querySelectorAll('[data-animate]').forEach((el, index) => {
            el.style.animationDelay = `${index * 0.08}s`;
            el.classList.add('animate-in');
        });
    }

    function injectPreloadedData() {
        [{ key: 'apps', target: '#apps-container' }, { key: 'stats', target: '#live-stats' }, { key: 'headlines', target: '#news-ticker' }].forEach(({ key, target }) => {
            if (window.preloadedData[key]) {
                const container = document.querySelector(target);
                if (container) {
                    container.innerHTML = window.preloadedData[key];
                    if (key === 'apps' && typeof initSortable === 'function') initSortable();
                }
            }
        });
    }

    return { init };
})();

document.addEventListener('DOMContentLoaded', LoadingScreen.init);
