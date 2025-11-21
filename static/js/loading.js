/**
 * Military-style Loading Screen with Three.js Perlin Noise Terrain
 */

// Simplex Noise implementation
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
    const grad3 = [
      [1, 1], [-1, 1], [1, -1], [-1, -1],
      [1, 0], [-1, 0], [0, 1], [0, -1],
      [1, 1], [-1, 1], [1, -1], [-1, -1]
    ];

    let n0, n1, n2;
    const s = (x + y) * F2;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);
    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;
    const x0 = x - X0;
    const y0 = y - Y0;

    let i1, j1;
    if (x0 > y0) { i1 = 1; j1 = 0; }
    else { i1 = 0; j1 = 1; }

    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;

    const ii = i & 255;
    const jj = j & 255;
    const gi0 = this.permMod12[ii + this.perm[jj]];
    const gi1 = this.permMod12[ii + i1 + this.perm[jj + j1]];
    const gi2 = this.permMod12[ii + 1 + this.perm[jj + 1]];

    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 < 0) n0 = 0;
    else {
      t0 *= t0;
      n0 = t0 * t0 * (grad3[gi0][0] * x0 + grad3[gi0][1] * y0);
    }

    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 < 0) n1 = 0;
    else {
      t1 *= t1;
      n1 = t1 * t1 * (grad3[gi1][0] * x1 + grad3[gi1][1] * y1);
    }

    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 < 0) n2 = 0;
    else {
      t2 *= t2;
      n2 = t2 * t2 * (grad3[gi2][0] * x2 + grad3[gi2][1] * y2);
    }

    return 70 * (n0 + n1 + n2);
  }
}

// Loading Screen Controller
const LoadingScreen = (function() {
  let scene, camera, renderer, terrain, animationId;
  let noise, time = 0;
  let loadProgress = 0;

  const loadingMessages = [
    'INITIALIZING CORE SYSTEMS...',
    'ESTABLISHING SECURE CONNECTION...',
    'LOADING NETWORK PROTOCOLS...',
    'SCANNING AVAILABLE SERVICES...',
    'MAPPING INFRASTRUCTURE...',
    'AUTHENTICATING USER SESSION...',
    'LOADING DASHBOARD MODULES...',
    'FINALIZING SYSTEM CHECK...',
    'READY FOR DEPLOYMENT...'
  ];

  function init() {
    const container = document.getElementById('terrain-container');
    if (!container || typeof THREE === 'undefined') {
      finishLoading();
      return;
    }

    // Scene setup
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0a0a, 0.015);

    // Camera
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 15, 30);
    camera.lookAt(0, 0, 0);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x0a0a0a, 1);
    container.appendChild(renderer.domElement);

    // Noise generator
    noise = new SimplexNoise();

    // Create terrain
    createTerrain();

    // Add grid helper
    const gridHelper = new THREE.GridHelper(100, 50, 0x1a1a1a, 0x1a1a1a);
    gridHelper.position.y = -5;
    scene.add(gridHelper);

    // Add ambient particles
    createParticles();

    // Handle resize
    window.addEventListener('resize', onResize);

    // Start animation
    animate();

    // Start loading simulation
    simulateLoading();

    // Update boot time
    updateBootTime();
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

  function createParticles() {
    const particleCount = 200;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 100;
      positions[i * 3 + 1] = Math.random() * 30;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 100;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: 0xf97316,
      size: 0.1,
      transparent: true,
      opacity: 0.5
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);
  }

  function animate() {
    animationId = requestAnimationFrame(animate);

    time += 0.008;

    // Update terrain
    updateTerrain();

    // Rotate camera slowly around terrain
    camera.position.x = Math.sin(time * 0.2) * 25;
    camera.position.z = Math.cos(time * 0.2) * 30;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  }

  function onResize() {
    if (!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function simulateLoading() {
    const loadBar = document.getElementById('load-bar');
    const loadPercent = document.getElementById('load-percent');
    const loadStatus = document.getElementById('load-status');
    const terrainStatus = document.getElementById('terrain-status');

    let messageIndex = 0;

    const interval = setInterval(() => {
      loadProgress += Math.random() * 8 + 2;

      if (loadProgress >= 100) {
        loadProgress = 100;
        clearInterval(interval);

        if (loadBar) loadBar.style.width = '100%';
        if (loadPercent) loadPercent.textContent = '100%';
        if (loadStatus) loadStatus.textContent = 'SYSTEM READY';
        if (terrainStatus) terrainStatus.textContent = 'COMPLETE';

        setTimeout(finishLoading, 800);
        return;
      }

      if (loadBar) loadBar.style.width = loadProgress + '%';
      if (loadPercent) loadPercent.textContent = Math.floor(loadProgress) + '%';

      // Update status message
      const newMessageIndex = Math.floor(loadProgress / 12);
      if (newMessageIndex !== messageIndex && newMessageIndex < loadingMessages.length) {
        messageIndex = newMessageIndex;
        if (loadStatus) loadStatus.textContent = loadingMessages[messageIndex];
      }

      // Update terrain status
      if (terrainStatus) {
        if (loadProgress < 30) terrainStatus.textContent = 'MAPPING...';
        else if (loadProgress < 60) terrainStatus.textContent = 'ANALYZING...';
        else if (loadProgress < 90) terrainStatus.textContent = 'RENDERING...';
        else terrainStatus.textContent = 'COMPLETE';
      }
    }, 100);
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

    // Fade out
    loadingScreen.style.transition = 'opacity 0.5s ease-out';
    loadingScreen.style.opacity = '0';

    setTimeout(() => {
      // Cleanup
      if (animationId) cancelAnimationFrame(animationId);
      if (renderer) renderer.dispose();
      window.removeEventListener('resize', onResize);

      loadingScreen.remove();
    }, 500);
  }

  return { init };
})();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', LoadingScreen.init);
