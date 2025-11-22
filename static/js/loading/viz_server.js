/**
 * Server Visualization Module
 * Renders a 3D wireframe server with pinout labels.
 */

const VizServer = (function () {
    let serverGroup;
    let pinoutLines = [];
    let pinoutLabels = [];

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

    function init(scene, camera, renderer, container) {
        scene.fog = new THREE.FogExp2(0x0a0a0a, 0.008);
        camera.position.set(0, 2, 12);
        camera.lookAt(0, 0, 0);

        createServerObject(scene);
        createPinoutLines(scene);
        createParticles(scene);
        createFloorGrid(scene);
    }

    function createServerObject(scene) {
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

    function createPinoutLines(scene) {
        const labelContainer = document.getElementById('pinout-labels');
        if (!labelContainer) return;

        // Clear existing labels
        labelContainer.innerHTML = '';
        pinoutLabels = [];
        pinoutLines = [];

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

    function createParticles(scene) {
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

    function createFloorGrid(scene) {
        const gridHelper = new THREE.GridHelper(30, 30, 0x1a1a1a, 0x1a1a1a);
        gridHelper.position.y = -3;
        scene.add(gridHelper);
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.02, side: THREE.DoubleSide }));
        plane.rotation.x = -Math.PI / 2;
        plane.position.y = -2.99;
        scene.add(plane);
    }

    function update(time) {
        if (serverGroup) {
            serverGroup.rotation.y = Math.sin(time * 0.3) * 0.2;
            serverGroup.rotation.x = Math.sin(time * 0.2) * 0.05;
            const scanLine = serverGroup.getObjectByName('scanLine');
            if (scanLine) {
                scanLine.position.y = Math.sin(time * 2) * 0.9;
                scanLine.material.opacity = 0.3 + Math.sin(time * 4) * 0.2;
            }
            updatePinoutPositions();
        }
    }

    function updatePinoutLabels(systemData) {
        if (!systemData) return;
        pinoutLabels.forEach(({ element, config }) => {
            const valueEl = element.querySelector('.pinout-value');
            if (valueEl) valueEl.textContent = config.getValue(systemData);
        });
    }

    function showPinouts() {
        pinoutLines.forEach((line, i) => setTimeout(() => { line.material.opacity = line.userData.targetOpacity; }, i * 100));
        pinoutLabels.forEach(({ element }, i) => setTimeout(() => { element.style.opacity = '1'; element.classList.add('visible'); }, i * 100 + 50));
    }

    function updatePinoutPositions() {
        if (!pinoutLabels.length) return;
        pinoutLabels.forEach(({ element, config }) => {
            const isLeft = config.side === 'left';
            const screenY = 50 - (config.yOffset * 15);
            element.style.top = `${screenY}%`;
            if (isLeft) { element.style.left = '5%'; element.style.right = 'auto'; }
            else { element.style.right = '5%'; element.style.left = 'auto'; }
        });
    }

    return { init, update, updatePinoutLabels, showPinouts };
})();
