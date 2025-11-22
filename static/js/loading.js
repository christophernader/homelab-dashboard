/**
 * Military-style Loading Screen
 * Supports two styles: "server" (3D wireframe) and "terrain" (Perlin noise landscape)
 * Style is set via window.loadingScreenStyle
 */

// Simplex Noise for terrain mode
class SimplexNoise {
  constructor(seed = Math.random()) {
    this.p = new Uint8Array(256);
    this.perm = new Uint8Array(512);
    this.permMod12 = new Uint8Array(512);
    for (let i = 0; i < 256; i++) this.p[i] = i;
    let n, q;
    for (let i = 255; i > 0; i--) {
      seed = (seed * 16807) % 2147483647;
      n = seed % (i + 1);
      q = this.p[i];
      this.p[i] = this.p[n];
      this.p[n] = q;
    }
    for (let i = 0; i < 512; i++) {
      this.perm[i] = this.p[i & 255];
      this.permMod12[i] = this.perm[i] % 12;
    }
  }
  noise2D(x, y) {
    const F2 = 0.5 * (Math.sqrt(3) - 1);
    const G2 = (3 - Math.sqrt(3)) / 6;
    const grad3 = [[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]];
    let n0, n1, n2;
    const s = (x + y) * F2;
    const i = Math.floor(x + s), j = Math.floor(y + s);
    const t = (i + j) * G2;
    const x0 = x - (i - t), y0 = y - (j - t);
    let i1, j1;
    if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    const gi0 = this.permMod12[ii + this.perm[jj]];
    const gi1 = this.permMod12[ii + i1 + this.perm[jj + j1]];
    const gi2 = this.permMod12[ii + 1 + this.perm[jj + 1]];
    let t0 = 0.5 - x0*x0 - y0*y0;
    n0 = t0 < 0 ? 0 : (t0 *= t0, t0 * t0 * (grad3[gi0][0]*x0 + grad3[gi0][1]*y0));
    let t1 = 0.5 - x1*x1 - y1*y1;
    n1 = t1 < 0 ? 0 : (t1 *= t1, t1 * t1 * (grad3[gi1][0]*x1 + grad3[gi1][1]*y1));
    let t2 = 0.5 - x2*x2 - y2*y2;
    n2 = t2 < 0 ? 0 : (t2 *= t2, t2 * t2 * (grad3[gi2][0]*x2 + grad3[gi2][1]*y2));
    return 70 * (n0 + n1 + n2);
  }
}

const LoadingScreen = (function() {
  let scene, camera, renderer, animationId;
  let time = 0;
  let systemData = null;
  let pinoutLines = [];
  let pinoutLabels = [];
  let terrain, serverGroup, noise;

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

    scene = new THREE.Scene();

    if (style === 'terrain') {
      initTerrainMode(container);
    } else {
      initServerMode(container);
    }

    window.addEventListener('resize', onResize);
    animate();
    loadAllData();
    updateBootTime();
  }

  // ========== TERRAIN MODE ==========
  function initTerrainMode(container) {
    scene.fog = new THREE.FogExp2(0x0a0a0a, 0.015);
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 15, 30);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x0a0a0a, 1);
    container.appendChild(renderer.domElement);

    noise = new SimplexNoise();
    createTerrain();

    const gridHelper = new THREE.GridHelper(100, 50, 0x1a1a1a, 0x1a1a1a);
    gridHelper.position.y = -5;
    scene.add(gridHelper);

    createParticlesTerrain();
  }

  function createTerrain() {
    const geometry = new THREE.PlaneGeometry(80, 80, 100, 100);
    const material = new THREE.MeshBasicMaterial({
      color: 0xf97316,
      wireframe: true,
      transparent: true,
      opacity: 0.3
    });
    terrain = new THREE.Mesh(geometry, material);
    terrain.rotation.x = -Math.PI / 2;
    terrain.position.y = -2;
    scene.add(terrain);
    updateTerrain();
  }

  function updateTerrain() {
    if (!terrain) return;
    const positions = terrain.geometry.attributes.position;
    const vertex = new THREE.Vector3();
    for (let i = 0; i < positions.count; i++) {
      vertex.fromBufferAttribute(positions, i);
      const noiseValue =
        noise.noise2D(vertex.x * 0.05 + time * 0.5, vertex.y * 0.05) * 3 +
        noise.noise2D(vertex.x * 0.1 + time * 0.3, vertex.y * 0.1) * 1.5 +
        noise.noise2D(vertex.x * 0.02, vertex.y * 0.02 + time * 0.2) * 5;
      positions.setZ(i, noiseValue);
    }
    positions.needsUpdate = true;
    terrain.geometry.computeVertexNormals();
  }

  function createParticlesTerrain() {
    const particleCount = 200;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 100;
      positions[i * 3 + 1] = Math.random() * 30;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 100;
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({ color: 0xf97316, size: 0.1, transparent: true, opacity: 0.5 });
    scene.add(new THREE.Points(geometry, material));
  }

  // ========== SERVER MODE ==========
  function initServerMode(container) {
    scene.fog = new THREE.FogExp2(0x0a0a0a, 0.008);
    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 2, 12);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x0a0a0a, 1);
    container.appendChild(renderer.domElement);

    createServerObject();
    createPinoutLines();
    createParticlesServer();
    createFloorGrid();
  }

  function createServerObject() {
    serverGroup = new THREE.Group();
    const bodyGeometry = new THREE.BoxGeometry(3, 2, 1.5);
    const bodyEdges = new THREE.EdgesGeometry(bodyGeometry);
    const bodyLine = new THREE.LineSegments(bodyEdges, new THREE.LineBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.8 }));
    serverGroup.add(bodyLine);

    const innerGroup = new THREE.Group();
    for (let y = -0.6; y <= 0.6; y += 0.3) {
      const points = [new THREE.Vector3(-1.4, y, 0.76), new THREE.Vector3(1.4, y, 0.76)];
      const lineGeom = new THREE.BufferGeometry().setFromPoints(points);
      innerGroup.add(new THREE.Line(lineGeom, new THREE.LineBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.3 })));
    }
    for (let x = -1.2; x <= 1.2; x += 0.4) {
      const points = [new THREE.Vector3(x, -0.8, 0.76), new THREE.Vector3(x, 0.8, 0.76)];
      const lineGeom = new THREE.BufferGeometry().setFromPoints(points);
      innerGroup.add(new THREE.Line(lineGeom, new THREE.LineBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.2 })));
    }

    const cpuEdges = new THREE.EdgesGeometry(new THREE.PlaneGeometry(0.6, 0.6));
    const cpuLine = new THREE.LineSegments(cpuEdges, new THREE.LineBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.9 }));
    cpuLine.position.set(-0.5, 0.2, 0.76);
    innerGroup.add(cpuLine);

    for (let i = 0; i < 4; i++) {
      const ramEdges = new THREE.EdgesGeometry(new THREE.PlaneGeometry(0.15, 0.5));
      const ramLine = new THREE.LineSegments(ramEdges, new THREE.LineBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.6 }));
      ramLine.position.set(0.3 + i * 0.2, 0.2, 0.76);
      innerGroup.add(ramLine);
    }

    for (let i = 0; i < 3; i++) {
      const diskEdges = new THREE.EdgesGeometry(new THREE.PlaneGeometry(0.3, 0.2));
      const diskLine = new THREE.LineSegments(diskEdges, new THREE.LineBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.5 }));
      diskLine.position.set(-0.8 + i * 0.4, -0.5, 0.76);
      innerGroup.add(diskLine);
    }
    serverGroup.add(innerGroup);

    const bracketMaterial = new THREE.LineBasicMaterial({ color: 0xf97316, transparent: true, opacity: 1 });
    const bracketSize = 0.3;
    [[-1.5, 1, 0.75], [1.5, 1, 0.75], [-1.5, -1, 0.75], [1.5, -1, 0.75]].forEach(([x, y, z]) => {
      const xDir = x > 0 ? -1 : 1, yDir = y > 0 ? -1 : 1;
      serverGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, y, z), new THREE.Vector3(x + bracketSize * xDir, y, z)]), bracketMaterial));
      serverGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, y, z), new THREE.Vector3(x, y + bracketSize * yDir, z)]), bracketMaterial));
    });

    const scanLine = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.02), new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
    scanLine.position.z = 0.77;
    scanLine.name = 'scanLine';
    serverGroup.add(scanLine);

    scene.add(serverGroup);
  }

  function createPinoutLines() {
    const labelContainer = document.getElementById('pinout-labels');
    if (!labelContainer) return;

    pinoutConfig.forEach((config, index) => {
      const isLeft = config.side === 'left';
      const startX = isLeft ? -1.6 : 1.6;
      const endX = isLeft ? -4 : 4;
      const y = config.yOffset;
      const points = [new THREE.Vector3(startX, y, 0.5), new THREE.Vector3(startX + (isLeft ? -0.5 : 0.5), y, 0.5), new THREE.Vector3(endX, y, 0.5)];
      const lineGeom = new THREE.BufferGeometry().setFromPoints(points);
      const lineMat = new THREE.LineBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0 });
      const line = new THREE.Line(lineGeom, lineMat);
      line.userData = { targetOpacity: 0.6, config };
      scene.add(line);
      pinoutLines.push(line);

      const label = document.createElement('div');
      label.className = `pinout-label ${isLeft ? 'left' : 'right'}`;
      label.innerHTML = `<span class="pinout-title">${config.label}</span><span class="pinout-value" id="pinout-${config.id}">---</span>`;
      label.style.opacity = '0';
      labelContainer.appendChild(label);
      pinoutLabels.push({ element: label, config, index });
    });
  }

  function createParticlesServer() {
    const particleCount = 100;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 30;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 20;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 20;
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    scene.add(new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xf97316, size: 0.03, transparent: true, opacity: 0.4 })));
  }

  function createFloorGrid() {
    const gridHelper = new THREE.GridHelper(30, 30, 0x1a1a1a, 0x1a1a1a);
    gridHelper.position.y = -3;
    scene.add(gridHelper);
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.02, side: THREE.DoubleSide }));
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = -2.99;
    scene.add(plane);
  }

  // ========== SHARED FUNCTIONS ==========
  function updatePinoutLabels() {
    if (!systemData || style !== 'server') return;
    pinoutLabels.forEach(({ element, config }) => {
      const valueEl = element.querySelector('.pinout-value');
      if (valueEl) valueEl.textContent = config.getValue(systemData);
    });
  }

  function showPinouts() {
    if (style !== 'server') return;
    pinoutLines.forEach((line, i) => setTimeout(() => { line.material.opacity = line.userData.targetOpacity; }, i * 100));
    pinoutLabels.forEach(({ element }, i) => setTimeout(() => { element.style.opacity = '1'; element.classList.add('visible'); }, i * 100 + 50));
  }

  function updatePinoutPositions() {
    if (!pinoutLabels.length || style !== 'server') return;
    pinoutLabels.forEach(({ element, config }) => {
      const isLeft = config.side === 'left';
      const screenY = 50 - (config.yOffset * 15);
      element.style.top = `${screenY}%`;
      if (isLeft) { element.style.left = '5%'; element.style.right = 'auto'; }
      else { element.style.right = '5%'; element.style.left = 'auto'; }
    });
  }

  function animate() {
    animationId = requestAnimationFrame(animate);
    time += style === 'terrain' ? 0.008 : 0.01;

    if (style === 'terrain') {
      updateTerrain();
      camera.position.x = Math.sin(time * 0.2) * 25;
      camera.position.z = Math.cos(time * 0.2) * 30;
      camera.lookAt(0, 0, 0);
    } else if (serverGroup) {
      serverGroup.rotation.y = Math.sin(time * 0.3) * 0.2;
      serverGroup.rotation.x = Math.sin(time * 0.2) * 0.05;
      const scanLine = serverGroup.getObjectByName('scanLine');
      if (scanLine) {
        scanLine.position.y = Math.sin(time * 2) * 0.9;
        scanLine.material.opacity = 0.3 + Math.sin(time * 4) * 0.2;
      }
      updatePinoutPositions();
    }

    renderer.render(scene, camera);
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
    if (loadStatus) loadStatus.innerHTML = '<span class="text-[#22c55e]">SYSTEM READY</span><br><span class="text-[#666] text-[8px] mt-2 block animate-pulse">MOVE MOUSE TO CONTINUE</span>';
    waitForMouseToDismiss();
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
