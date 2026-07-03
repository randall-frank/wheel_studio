import * as THREE from './threejs/three.module.min.js';
import { OrbitControls } from './threejs/examples/jsm/controls/OrbitControls.js';

const radiusInput = document.getElementById('radiusInput');
const heightInput = document.getElementById('heightInput');
const segmentsInput = document.getElementById('segmentsInput');
const shapeSelect = document.getElementById('shapeSelect');
const colorInput = document.getElementById('colorInput');
const generateButton = document.getElementById('generateButton');
const downloadButton = document.getElementById('downloadButton');
const statusText = document.getElementById('statusText');
const renderCanvas = document.getElementById('renderCanvas');
const radiusValue = document.getElementById('radiusValue');
const heightValue = document.getElementById('heightValue');
const segmentsValue = document.getElementById('segmentsValue');

let renderer, scene, camera, modelMesh, downloadData;

function updateValueLabels() {
    radiusValue.textContent = radiusInput.value;
    heightValue.textContent = heightInput.value;
    segmentsValue.textContent = segmentsInput.value;
}

function createGeometry() {
    const radius = Number(radiusInput.value);
    const height = Number(heightInput.value);
    const segments = Number(segmentsInput.value);
    const shape = shapeSelect.value;
    let geometry;

    switch (shape) {
        case 'sphere':
            geometry = new THREE.SphereGeometry(radius * 0.75, segments, segments);
            break;
        case 'cylinder':
            geometry = new THREE.CylinderGeometry(radius * 0.6, radius * 0.6, height, segments, 1, false);
            break;
        case 'torus':
            geometry = new THREE.TorusGeometry(radius * 0.6, radius * 0.18, 16, segments);
            break;
        default:
            geometry = new THREE.BoxGeometry(radius, height * 0.5, radius * 0.7);
            break;
    }

    return geometry;
}

function serializeGeometryToOBJ(geometry) {
    const position = geometry.attributes.position;
    const index = geometry.index;
    let obj = '';

    for (let i = 0; i < position.count; i++) {
        const x = position.getX(i).toFixed(6);
        const y = position.getY(i).toFixed(6);
        const z = position.getZ(i).toFixed(6);
        obj += `v ${x} ${y} ${z}\n`;
    }

    if (index) {
        for (let i = 0; i < index.count; i += 3) {
            const a = index.getX(i) + 1;
            const b = index.getX(i + 1) + 1;
            const c = index.getX(i + 2) + 1;
            obj += `f ${a} ${b} ${c}\n`;
        }
    } else {
        for (let i = 0; i < position.count; i += 3) {
            obj += `f ${i + 1} ${i + 2} ${i + 3}\n`;
        }
    }

    return obj;
}

function setStatus(message, level = 'normal') {
    statusText.textContent = message;
    statusText.className = level === 'error' ? 'text-danger' : level === 'success' ? 'text-success' : '';
}

function updatePreview() {
    const color = colorInput.value;
    const geometry = createGeometry();
    const material = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), metalness: 0.25, roughness: 0.5 });

    if (modelMesh) {
        scene.remove(modelMesh);
        modelMesh.geometry.dispose();
        modelMesh.material.dispose();
    }

    modelMesh = new THREE.Mesh(geometry, material);
    modelMesh.rotation.x = -0.2;
    modelMesh.rotation.y = 0.8;
    scene.add(modelMesh);
    frameScene();
    downloadData = serializeGeometryToOBJ(geometry);
    downloadButton.disabled = false;
    setStatus('Geometry generated and preview updated.', 'success');
}

function downloadGeometry() {
    if (!downloadData) {
        setStatus('No geometry ready to download. Click Generate Geometry first.', 'error');
        return;
    }

    const blob = new Blob([downloadData], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'geometry.obj';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setStatus('Geometry download started.', 'success');
}

let controls;

function initScene() {
    renderer = new THREE.WebGLRenderer({ canvas: renderCanvas, antialias: true, alpha: false });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(renderCanvas.clientWidth, renderCanvas.clientHeight, false);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07111f);

    camera = new THREE.PerspectiveCamera(45, renderCanvas.clientWidth / renderCanvas.clientHeight, 0.1, 1000);
    camera.position.set(0, 30, 110);

    controls = new OrbitControls(camera, renderCanvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 30;
    controls.maxDistance = 250;
    controls.maxPolarAngle = Math.PI * 0.95;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(60, 80, 40);
    scene.add(directionalLight);

    const fillLight = new THREE.DirectionalLight(0x66aaff, 0.35);
    fillLight.position.set(-40, 20, -80);
    scene.add(fillLight);

    const grid = new THREE.GridHelper(200, 24, 0x808080, 0x404040);
    grid.material.opacity = 0.5;
    grid.material.transparent = true;
    scene.add(grid);

    updatePreview();
    animate();

    window.dispatchEvent(new Event('resize'));
}

function resizeRenderer() {
    if (!renderer || !camera) return;
    const width = renderCanvas.clientWidth;
    const height = renderCanvas.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
}

function animate() {
    requestAnimationFrame(animate);
    if (controls) {
        controls.update();
    }
    renderer.render(scene, camera);
}

function frameScene() {
    const box = new THREE.Box3().setFromObject(scene);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));

    cameraZ *= 1.2;

    camera.position.set(center.x, center.y, center.z + cameraZ);
    controls.target.copy(center);
    controls.update();
}

window.addEventListener('DOMContentLoaded', () => {
    updateValueLabels();
    initScene();

    radiusInput.addEventListener('input', () => {
        updateValueLabels();
        setStatus('Parameter slider changed. Click Generate Geometry to refresh preview.');
    });

    heightInput.addEventListener('input', () => {
        updateValueLabels();
        setStatus('Parameter slider changed. Click Generate Geometry to refresh preview.');
    });

    segmentsInput.addEventListener('input', () => {
        updateValueLabels();
        setStatus('Parameter slider changed. Click Generate Geometry to refresh preview.');
    });

    shapeSelect.addEventListener('change', () => {
        setStatus('Shape changed. Click Generate Geometry to refresh preview.');
    });

    colorInput.addEventListener('input', () => {
        setStatus('Color changed. Click Generate Geometry to refresh preview.');
    });

    generateButton.addEventListener('click', updatePreview);
    downloadButton.addEventListener('click', downloadGeometry);
    window.addEventListener('resize', resizeRenderer);

    const tabElements = document.querySelectorAll('button[data-bs-toggle="tab"]');
    tabElements.forEach(tabEl => {
        tabEl.addEventListener('shown.bs.tab', function (event) {
            resizeRenderer();
        });
    });
});
