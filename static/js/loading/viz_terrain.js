/**
 * Data Core Visualization Module
 * Renders a rotating tactical data core.
 */

const VizTerrain = (function () {
    let coreGroup, outerCore, innerCore, gridHelper;

    function init(scene, camera, renderer, container) {
        scene.fog = new THREE.FogExp2(0x000000, 0.02);
        camera.position.set(0, 5, 20);
        camera.lookAt(0, 0, 0);

        // Core Group
        coreGroup = new THREE.Group();
        scene.add(coreGroup);

        // Outer Wireframe Core (Icosahedron)
        const outerGeo = new THREE.IcosahedronGeometry(6, 1);
        const outerMat = new THREE.MeshBasicMaterial({
            color: 0xf97316,
            wireframe: true,
            transparent: true,
            opacity: 0.4
        });
        outerCore = new THREE.Mesh(outerGeo, outerMat);
        coreGroup.add(outerCore);

        // Inner Solid Core
        const innerGeo = new THREE.IcosahedronGeometry(4, 2);
        const innerMat = new THREE.MeshBasicMaterial({
            color: 0xf97316,
            wireframe: true,
            transparent: true,
            opacity: 0.1
        });
        innerCore = new THREE.Mesh(innerGeo, innerMat);
        coreGroup.add(innerCore);

        // Glowing Nucleus
        const nucleusGeo = new THREE.SphereGeometry(2, 32, 32);
        const nucleusMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.8
        });
        const nucleus = new THREE.Mesh(nucleusGeo, nucleusMat);
        coreGroup.add(nucleus);

        // Floor Grid
        gridHelper = new THREE.GridHelper(100, 50, 0x333333, 0x111111);
        gridHelper.position.y = -8;
        scene.add(gridHelper);

        // Floating Particles
        createParticles(scene);

        // Lights
        const ambientLight = new THREE.AmbientLight(0x404040);
        scene.add(ambientLight);

        const pointLight = new THREE.PointLight(0xf97316, 2, 50);
        pointLight.position.set(10, 10, 10);
        scene.add(pointLight);
    }

    function createParticles(scene) {
        const particleCount = 100;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);

        for (let i = 0; i < particleCount; i++) {
            const r = 10 + Math.random() * 20;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI * 2;

            positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = r * Math.cos(phi);
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const material = new THREE.PointsMaterial({
            color: 0xf97316,
            size: 0.1,
            transparent: true,
            opacity: 0.6
        });

        const particles = new THREE.Points(geometry, material);
        scene.add(particles);
    }

    function update(time, camera) {
        if (!coreGroup) return;

        // Rotate Core
        outerCore.rotation.x = time * 0.2;
        outerCore.rotation.y = time * 0.3;

        innerCore.rotation.x = -time * 0.2;
        innerCore.rotation.y = -time * 0.1;

        // Bobbing motion
        coreGroup.position.y = Math.sin(time) * 0.5;

        // Camera Orbit
        camera.position.x = Math.sin(time * 0.1) * 25;
        camera.position.z = Math.cos(time * 0.1) * 25;
        camera.lookAt(0, 0, 0);
    }

    return { init, update };
})();
