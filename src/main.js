import * as THREE from './threejs/three.module.min.js';
import { TrackballControls } from 'three/addons/controls/TrackballControls.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';

import OpenSCAD from "./openscad/openscad.js";
import { addFonts } from "./openscad/openscad.fonts.js";
import { addMCAD } from "./openscad/openscad.mcad.js";

const generateButton = document.getElementById('generateButton');
const downloadButton = document.getElementById('downloadButton');
const statusText = document.getElementById('statusText');
const renderCanvas = document.getElementById('renderCanvas');

let renderer, scene, camera, modelMesh, downloadData;


function findParameterSet(name) {
    for (const p of scad_params) {
        if (p.name === name) {
            return p.params;
        }
    }
    return null;
}


function generateSCADScript(params, source) {
    let s = source;
    params.forEach((group, index) => {
        (group.children || []).forEach((child) => {
            const value = document.getElementById(child.key).value;
            const uckey = child.key.toUpperCase();
            s = s.replace(uckey, value);
        });
    });
    return s;
}

function renderParameterForm(params) {
    const form = document.getElementById('paraForm');
    if (!form) return;

    form.innerHTML = '';

    const fragment = document.createDocumentFragment();

    params.forEach((group, index) => {
        const section = document.createElement('details');
        section.className = 'mb-3 border rounded border-secondary p-2';
        section.open = false;  // index === 0;

        const summary = document.createElement('summary');
        summary.className = 'fw-semibold cursor-pointer';
        summary.textContent = group.name || 'Section';
        section.appendChild(summary);

        const groupWrap = document.createElement('div');
        groupWrap.className = 'mt-2';

        (group.children || []).forEach((child) => {
            const fieldWrap = document.createElement('div');
            fieldWrap.className = 'mb-3';

            const label = document.createElement('label');
            label.className = 'form-label small';
            label.innerHTML = '<strong>' + child.key + '</strong><br>' + child.title;
            label.htmlFor = child.key;

            const input = document.createElement('input');
            input.id = child.key;
            input.name = child.key;
            input.className = 'form-control form-control-sm';
            input.type = 'number';
            input.value = child.value ?? '';

            if (child.range) {
                const [min, max] = child.range;
                input.step = '1';
                input.min = min;
                input.max = max;
            } else {
                input.step = 'any';
                input.min = '0';
            }

            fieldWrap.appendChild(label);
            fieldWrap.appendChild(input);
            groupWrap.appendChild(fieldWrap);
        });

        section.appendChild(groupWrap);
        fragment.appendChild(section);
    });

    form.appendChild(fragment);
}

let scadLogOutput = [];

function captureStdOut(text) {
    scadLogOutput.push(text);
}

function captureStdErr(text) {
    scadLogOutput.push("[Warn]:" + text);
}

async function createSCADSTL(source) {
    const instance = await OpenSCAD({
        noInitialRun: true,
        print: captureStdOut,
        printErr: captureStdErr
    });

    addFonts(instance);
    addMCAD(instance);
    instance.FS.writeFile("/input.scad", source);

    let filename = "wheel.stl"; 
    let manifold = "--backend=Manifold";  // "--enable=manifold";
    instance.callMain(["/input.scad", manifold, "-o", filename]);

    console.log(scadLogOutput);
    const output = instance.FS.readFile("/" + filename);

    // convert into Three.js object
    const loader = new STLLoader();
    const geometry = loader.parse(output.buffer);
    
    return geometry;
}

function serializeGeometryToSTL() {
    const exporter = new STLExporter();
    const options = { binary: true };
    const result = exporter.parse(scene, options);
    const mimeType = options.binary ? 'application/octet-stream' : 'text/plain';
    const blob = new Blob([result], { type: mimeType });

    return blob;
}

function setStatus(message, level = 'normal') {
    statusText.textContent = message;
    statusText.className = level === 'error' ? 'text-danger' : level === 'success' ? 'text-success' : '';
}

async function updatePreview() {
    setStatus('Generating new geometry...', 'normal');
    downloadButton.disabled = true;
    generateButton.disabled = true;

    const params = findParameterSet("Default");
    const source = generateSCADScript(params, scad_src);
    const geometry = await createSCADSTL(source);

    const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color('#d4d4d4'),
        metalness: 0.25, roughness: 0.5
    });

    if (modelMesh) {
        scene.remove(modelMesh);
        modelMesh.geometry.dispose();
        modelMesh.material.dispose();
    }

    modelMesh = new THREE.Mesh(geometry, material);
    scene.add(modelMesh);
    frameScene();
    downloadData = serializeGeometryToSTL();

    downloadButton.disabled = false;
    generateButton.disabled = false;
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
    link.download = 'wheel.stl';
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

    controls = new TrackballControls(camera, renderCanvas);
    controls.enableDamping = false;
    controls.dampingFactor = 0.08;
    controls.minDistance = 20;
    controls.maxDistance = 300;
    controls.maxPolarAngle = Math.PI * 0.95;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
    directionalLight.position.set(40, 60, 40);
    scene.add(directionalLight);

    const fillLight = new THREE.DirectionalLight(0x66aaff, 0.7);
    fillLight.position.set(-40, 20, 40);
    scene.add(fillLight);

    const grid = new THREE.GridHelper(200, 20, 0x808080, 0x404040);
    grid.material.opacity = 0.5;
    grid.material.transparent = true;
    grid.rotation.x = Math.PI / 2;   // in the xy plane
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
    const params = findParameterSet("Default");
    renderParameterForm(params);
    initScene();

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
