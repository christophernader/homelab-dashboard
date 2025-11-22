/**
 * Military-style Loading Screen with 3D Wireframe Server Object
 * Features animated pinout lines showing dynamic system specs
 */

// Loading Screen Controller
const LoadingScreen = (function() {
  let scene, camera, renderer, serverGroup, animationId;
  let time = 0;
  let systemData = null;
  let pinoutLines = [];
  let pinoutLabels = [];

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

  // Pinout configuration - positions relative to server object
  const pinoutConfig = [
    { id: 'hostname', label: 'HOSTNAME', side: 'left', yOffset: 0.8, getValue: d => d?.hostname || 'UNKNOWN' },
    { id: 'platform', label: 'PLATFORM', side: 'left', yOffset: 0.4, getValue: d => `${d?.platform || 'N/A'} ${d?.architecture || ''}` },
    { id: 'cpu', label: 'CPU', side: 'left', yOffset: 0, getValue: d => `${d?.cpu_cores || '?'} CORES @ ${d?.cpu_percent || 0}%` },
    { id: 'ram', label: 'MEMORY', side: 'left', yOffset: -0.4, getValue: d => `${d?.ram_used || '?'} / ${d?.ram_total || '?'}` },
    { id: 'disk', label: 'STORAGE', side: 'right', yOffset: 0.8, getValue: d => `${d?.disk_used || '?'} / ${d?.disk_total || '?'}` },
    { id: 'containers', label: 'CONTAINERS', side: 'right', yOffset: 0.4, getValue: d => `${d?.containers_running || 0} / ${d?.containers_total || 0} ACTIVE` },
    { id: 'network', label: 'NETWORK', side: 'right', yOffset: 0, getValue: d => d?.ip_address || 'N/A' },
    { id: 'uptime', label: 'UPTIME', side: 'right', yOffset: -0.4, getValue: d => d?.uptime || 'N/A' },
  ];

  function init() {
    const container = document.getElementById('terrain-container');
    if (!container || typeof THREE === 'undefined') {
      finishLoading();
      return;
    }

    // Scene setup
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0a0a, 0.008);

    // Camera
    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 2, 12);
    camera.lookAt(0, 0, 0);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x0a0a0a, 1);
    container.appendChild(renderer.domElement);

    // Create server object
    createServerObject();

    // Create pinout lines (initially hidden)
    createPinoutLines();

    // Add ambient particles
    createParticles();

    // Add floor grid
    createFloorGrid();

    // Handle resize
    window.addEventListener('resize', onResize);

    // Start animation
    animate();

    // Start data loading
    loadAllData();

    // Update boot time
    updateBootTime();
  }

  function createServerObject() {
    serverGroup = new THREE.Group();

    // Main server body - rectangular box like a server rack unit
    const bodyGeometry = new THREE.BoxGeometry(3, 2, 1.5);
    const bodyEdges = new THREE.EdgesGeometry(bodyGeometry);
    const bodyLine = new THREE.LineSegments(
      bodyEdges,
      new THREE.LineBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.8 })
    );
    serverGroup.add(bodyLine);

    // Inner wireframe details - circuit board pattern
    const innerGroup = new THREE.Group();

    // Horizontal circuit lines
    for (let y = -0.6; y <= 0.6; y += 0.3) {
      const points = [
        new THREE.Vector3(-1.4, y, 0.76),
        new THREE.Vector3(1.4, y, 0.76)
      ];
      const lineGeom = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(lineGeom, new THREE.LineBasicMaterial({
        color: 0xf97316, transparent: true, opacity: 0.3
      }));
      innerGroup.add(line);
    }

    // Vertical circuit lines
    for (let x = -1.2; x <= 1.2; x += 0.4) {
      const points = [
        new THREE.Vector3(x, -0.8, 0.76),
        new THREE.Vector3(x, 0.8, 0.76)
      ];
      const lineGeom = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(lineGeom, new THREE.LineBasicMaterial({
        color: 0xf97316, transparent: true, opacity: 0.2
      }));
      innerGroup.add(line);
    }

    // CPU/processor square
    const cpuGeometry = new THREE.PlaneGeometry(0.6, 0.6);
    const cpuEdges = new THREE.EdgesGeometry(cpuGeometry);
    const cpuLine = new THREE.LineSegments(
      cpuEdges,
      new THREE.LineBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.9 })
    );
    cpuLine.position.set(-0.5, 0.2, 0.76);
    innerGroup.add(cpuLine);

    // RAM slots
    for (let i = 0; i < 4; i++) {
      const ramGeometry = new THREE.PlaneGeometry(0.15, 0.5);
      const ramEdges = new THREE.EdgesGeometry(ramGeometry);
      const ramLine = new THREE.LineSegments(
        ramEdges,
        new THREE.LineBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.6 })
      );
      ramLine.position.set(0.3 + i * 0.2, 0.2, 0.76);
      innerGroup.add(ramLine);
    }

    // Storage indicators
    for (let i = 0; i < 3; i++) {
      const diskGeometry = new THREE.PlaneGeometry(0.3, 0.2);
      const diskEdges = new THREE.EdgesGeometry(diskGeometry);
      const diskLine = new THREE.LineSegments(
        diskEdges,
        new THREE.LineBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.5 })
      );
      diskLine.position.set(-0.8 + i * 0.4, -0.5, 0.76);
      innerGroup.add(diskLine);
    }

    serverGroup.add(innerGroup);

    // Corner brackets for military look
    const bracketMaterial = new THREE.LineBasicMaterial({ color: 0xf97316, transparent: true, opacity: 1 });
    const bracketSize = 0.3;
    const corners = [
      [-1.5, 1, 0.75], [1.5, 1, 0.75], [-1.5, -1, 0.75], [1.5, -1, 0.75]
    ];

    corners.forEach(([x, y, z], i) => {
      const xDir = x > 0 ? -1 : 1;
      const yDir = y > 0 ? -1 : 1;

      // Horizontal part
      const hPoints = [
        new THREE.Vector3(x, y, z),
        new THREE.Vector3(x + bracketSize * xDir, y, z)
      ];
      const hGeom = new THREE.BufferGeometry().setFromPoints(hPoints);
      serverGroup.add(new THREE.Line(hGeom, bracketMaterial));

      // Vertical part
      const vPoints = [
        new THREE.Vector3(x, y, z),
        new THREE.Vector3(x, y + bracketSize * yDir, z)
      ];
      const vGeom = new THREE.BufferGeometry().setFromPoints(vPoints);
      serverGroup.add(new THREE.Line(vGeom, bracketMaterial));
    });

    // Scanning line effect
    const scanGeometry = new THREE.PlaneGeometry(3.2, 0.02);
    const scanMaterial = new THREE.MeshBasicMaterial({
      color: 0xf97316,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide
    });
    const scanLine = new THREE.Mesh(scanGeometry, scanMaterial);
    scanLine.position.z = 0.77;
    scanLine.name = 'scanLine';
    serverGroup.add(scanLine);

    scene.add(serverGroup);
  }

  function createPinoutLines() {
    const labelContainer = document.getElementById('pinout-labels');
    if (!labelContainer) return;

    pinoutConfig.forEach((config, index) => {
      // Create 3D line from server to edge
      const isLeft = config.side === 'left';
      const startX = isLeft ? -1.6 : 1.6;
      const endX = isLeft ? -4 : 4;
      const y = config.yOffset;

      // Line points with elbow
      const points = [
        new THREE.Vector3(startX, y, 0.5),
        new THREE.Vector3(startX + (isLeft ? -0.5 : 0.5), y, 0.5),
        new THREE.Vector3(endX, y, 0.5)
      ];

      const lineGeom = new THREE.BufferGeometry().setFromPoints(points);
      const lineMat = new THREE.LineBasicMaterial({
        color: 0xf97316,
        transparent: true,
        opacity: 0
      });
      const line = new THREE.Line(lineGeom, lineMat);
      line.userData = { targetOpacity: 0.6, config };
      scene.add(line);
      pinoutLines.push(line);

      // Create HTML label
      const label = document.createElement('div');
      label.className = `pinout-label ${isLeft ? 'left' : 'right'}`;
      label.innerHTML = `
        <span class="pinout-title">${config.label}</span>
        <span class="pinout-value" id="pinout-${config.id}">---</span>
      `;
      label.style.opacity = '0';
      labelContainer.appendChild(label);
      pinoutLabels.push({ element: label, config, index });
    });
  }

  function updatePinoutLabels() {
    if (!systemData) return;

    pinoutLabels.forEach(({ element, config }) => {
      const valueEl = element.querySelector('.pinout-value');
      if (valueEl) {
        valueEl.textContent = config.getValue(systemData);
      }
    });
  }

  function showPinouts() {
    // Animate pinout lines appearing
    pinoutLines.forEach((line, i) => {
      setTimeout(() => {
        line.material.opacity = line.userData.targetOpacity;
      }, i * 100);
    });

    // Animate labels appearing
    pinoutLabels.forEach(({ element }, i) => {
      setTimeout(() => {
        element.style.opacity = '1';
        element.classList.add('visible');
      }, i * 100 + 50);
    });
  }

  function createParticles() {
    const particleCount = 100;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 30;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 20;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 20;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: 0xf97316,
      size: 0.03,
      transparent: true,
      opacity: 0.4
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);
  }

  function createFloorGrid() {
    const gridHelper = new THREE.GridHelper(30, 30, 0x1a1a1a, 0x1a1a1a);
    gridHelper.position.y = -3;
    scene.add(gridHelper);

    // Add subtle glow plane
    const planeGeometry = new THREE.PlaneGeometry(30, 30);
    const planeMaterial = new THREE.MeshBasicMaterial({
      color: 0xf97316,
      transparent: true,
      opacity: 0.02,
      side: THREE.DoubleSide
    });
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = -2.99;
    scene.add(plane);
  }

  function animate() {
    animationId = requestAnimationFrame(animate);
    time += 0.01;

    if (serverGroup) {
      // Gentle rotation
      serverGroup.rotation.y = Math.sin(time * 0.3) * 0.2;
      serverGroup.rotation.x = Math.sin(time * 0.2) * 0.05;

      // Scanning line animation
      const scanLine = serverGroup.getObjectByName('scanLine');
      if (scanLine) {
        scanLine.position.y = Math.sin(time * 2) * 0.9;
        scanLine.material.opacity = 0.3 + Math.sin(time * 4) * 0.2;
      }
    }

    // Update pinout line positions to follow rotation
    updatePinoutPositions();

    renderer.render(scene, camera);
  }

  function updatePinoutPositions() {
    if (!pinoutLabels.length) return;

    pinoutLabels.forEach(({ element, config, index }) => {
      const isLeft = config.side === 'left';

      // Calculate screen position based on 3D position
      const baseY = config.yOffset;
      const screenY = 50 - (baseY * 15); // Convert to percentage

      element.style.top = `${screenY}%`;

      if (isLeft) {
        element.style.left = '5%';
        element.style.right = 'auto';
      } else {
        element.style.right = '5%';
        element.style.left = 'auto';
      }
    });
  }

  function onResize() {
    if (!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  async function loadAllData() {
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
            updatePinoutLabels();
            showPinouts();
          } else {
            const html = await response.text();
            window.preloadedData[step.key] = html;
          }
        }
      } catch (e) {
        console.warn(`Failed to preload ${step.key}:`, e);
      }

      completedWeight += step.weight;

      if (loadBar) loadBar.style.width = completedWeight + '%';
      if (loadPercent) loadPercent.textContent = Math.floor(completedWeight) + '%';
    }

    // Final - show READY and wait for mouse movement
    if (loadBar) loadBar.style.width = '100%';
    if (loadPercent) loadPercent.textContent = '100%';
    if (loadStatus) {
      loadStatus.innerHTML = '<span class="text-[#22c55e]">SYSTEM READY</span><br><span class="text-[#666] text-[8px] mt-2 block animate-pulse">MOVE MOUSE TO CONTINUE</span>';
    }

    // Wait for mouse movement to dismiss
    waitForMouseToDismiss();
  }

  function waitForMouseToDismiss() {
    const loadingScreen = document.getElementById('loading-screen');
    if (!loadingScreen) return;

    // Re-enable pointer events so we can detect mouse movement
    loadingScreen.style.pointerEvents = 'auto';
    loadingScreen.style.cursor = 'none';

    let dismissed = false;

    const handleInteraction = (e) => {
      if (dismissed) return;
      dismissed = true;

      // Remove listeners
      loadingScreen.removeEventListener('mousemove', handleInteraction);
      loadingScreen.removeEventListener('click', handleInteraction);
      loadingScreen.removeEventListener('touchstart', handleInteraction);

      finishLoading();
    };

    // Listen for any interaction
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

      bootTimeEl.textContent =
        String(mins).padStart(2, '0') + ':' +
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
    const elements = document.querySelectorAll('[data-animate]');
    elements.forEach((el, index) => {
      el.style.animationDelay = `${index * 0.08}s`;
      el.classList.add('animate-in');
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
          if (key === 'apps' && typeof initSortable === 'function') {
            initSortable();
          }
        }
      }
    });
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', LoadingScreen.init);
