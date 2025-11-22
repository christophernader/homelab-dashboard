/**
 * Terrain Visualization Module
 * Uses Simplex Noise to generate a 3D wireframe landscape.
 */

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
        const grad3 = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
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
        let t0 = 0.5 - x0 * x0 - y0 * y0;
        n0 = t0 < 0 ? 0 : (t0 *= t0, t0 * t0 * (grad3[gi0][0] * x0 + grad3[gi0][1] * y0));
        let t1 = 0.5 - x1 * x1 - y1 * y1;
        n1 = t1 < 0 ? 0 : (t1 *= t1, t1 * t1 * (grad3[gi1][0] * x1 + grad3[gi1][1] * y1));
        let t2 = 0.5 - x2 * x2 - y2 * y2;
        n2 = t2 < 0 ? 0 : (t2 *= t2, t2 * t2 * (grad3[gi2][0] * x2 + grad3[gi2][1] * y2));
        return 70 * (n0 + n1 + n2);
    }
}

const VizTerrain = (function () {
    let terrain, noise;

    function init(scene, camera, renderer, container) {
        scene.fog = new THREE.FogExp2(0x0a0a0a, 0.015);
        camera.position.set(0, 15, 30);
        camera.lookAt(0, 0, 0);

        noise = new SimplexNoise();
        createTerrain(scene);

        const gridHelper = new THREE.GridHelper(100, 50, 0x1a1a1a, 0x1a1a1a);
        gridHelper.position.y = -5;
        scene.add(gridHelper);

        createParticles(scene);
    }

    function createTerrain(scene) {
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
    }

    function createParticles(scene) {
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

    function update(time, camera) {
        if (!terrain) return;

        // Update terrain vertices
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

        // Update camera movement
        camera.position.x = Math.sin(time * 0.2) * 25;
        camera.position.z = Math.cos(time * 0.2) * 30;
        camera.lookAt(0, 0, 0);
    }

    return { init, update };
})();
