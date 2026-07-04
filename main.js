import * as THREE from './threejs/three.module.min.js';
import { TrackballControls } from 'three/addons/controls/TrackballControls.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';

import OpenSCAD from "./openscad/openscad.js";
import { addFonts } from "./openscad/openscad.fonts.js";
import { addMCAD } from "./openscad/openscad.mcad.js";

const generateButton = document.getElementById('generateButton');
const generateWait = document.getElementById('generateWait');
const downloadButton = document.getElementById('downloadButton');
const loadParamsButton = document.getElementById('loadParamsButton');
const saveParamsButton = document.getElementById('saveParamsButton');
const paramsFileInput = document.getElementById('paramsFileInput');
const statusText = document.getElementById('statusText');
const renderCanvas = document.getElementById('renderCanvas');
const presetSelect = document.getElementById('presetSelect');

let renderer, scene, camera, modelMesh, downloadData;


function findParameterSet(name) {
    for (const p of scad_params) {
        if (p.name === name) {
            return p.params;
        }
    }
    return null;
}

function isValidNumber(str) {
  return str.trim() !== '' && !isNaN(str);
}

function generateSCADScript(params, source) {
    let s = source;
    params.forEach((group, index) => {
        (group.children || []).forEach((child) => {
            const elem = document.getElementById(child.key);
            let value = elem.value;
            if (!isValidNumber(value)) {
                value = child.value;  // If invalid, fall back to default value
                elem.value = value;
            }
            const uckey = child.key.toUpperCase();
            s = s.replace(uckey, value);
        });
    });
    return s;
}

function renderPresetSelector() {
    presetSelect.innerHTML = '';
    for(const preset of scad_params) {
        const item = document.createElement('a');
        item.classList.add('dropdown-item');
        item.href = '#';
        item.textContent = preset.name;
        item.value = preset.name;
        presetSelect.appendChild(item);
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const element = e.currentTarget; 
            const presetParams = findParameterSet(element.value);
            renderParameterForm(presetParams);
            updatePreview();
        });
    }
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
            let output = null;

            const fieldWrap = document.createElement('div');
            fieldWrap.className = 'mb-3';

            const label = document.createElement('label');
            label.className = 'form-label small';
            label.innerHTML = '<strong>' + child.key + '</strong><br>' + child.title;
            label.htmlFor = child.key;

            const input = document.createElement('input');
            input.id = child.key;
            input.name = child.key;
            input.value = child.value ?? '';
            if (child.range) {
                const [min, max] = child.range;
                input.step = '1';
                input.min = min;
                input.max = max;
                input.className = 'form-range';
                input.type = 'range';

                output = document.createElement('label');
                output.className = 'form-label small';
                output.readOnly = true; 
                output.id = child.key + "_output";
                output.textContent = child.value ?? '';

                input.addEventListener('input', function (e) {
                    const slider = e.currentTarget; 
                    const output = document.getElementById(slider.id + "_output");
                    output.textContent = slider.value;
                });
                

            } else {
                input.className = 'form-control form-control-sm';
                input.type = 'number';
                input.step = 'any';
                // input.min = '0';
            }

            fieldWrap.appendChild(label);
            fieldWrap.appendChild(input);
            if (output) fieldWrap.appendChild(output);
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

// Using the OpenSCAD JSON parameter set file format
// { "parameterSets": { "set1": { "param1": 10, "param2": 20 }}
// Import the first parameter set in the file...
function importParameterSet(s) {
    const fileObj = JSON.parse(s);
    if ("parameterSets" in fileObj) {
        const paramSets = fileObj["parameterSets"];
        const firstSetKey = Object.keys(paramSets)[0];  // "set1"
        const firstSet = paramSets[firstSetKey];
        for (const [key, value] of Object.entries(firstSet)) {
            if (document.getElementById(key)) {
                document.getElementById(key).value = value;
            }
            const outkey = key + "_output";
            if (document.getElementById(outkey)) {
                document.getElementById(outkey).textContent = value;
            }
        }
    }
}

// Export in the OpenSCAD JSON parameter set file format
function exportParameterSet() {
    let exp = {};
    // template to get the element ids from
    const params = findParameterSet("Default");
    params.forEach((group, index) => {
        (group.children || []).forEach((child) => {
            const key = child.key;
            const elem = document.getElementById(key);
            let value = elem.value;
            exp[key] = value;
        });
    });
    let exportObj = { "fileFormatVersion": "1", "parameterSets": {} };
    exportObj.parameterSets["noname"] = exp;
    return JSON.stringify(exportObj, null, 2);
}

async function loadParameterSetFromFile(event) {
    const file = event.target.files?.[0];
    if (!file) {
        return;
    }

    try {
        const contents = await file.text();
        importParameterSet(contents);
        setStatus(`Loaded parameters from ${file.name}.`, 'success');
        await updatePreview();
    } catch (error) {
        setStatus(`Unable to load parameter file: ${error.message}`, 'error');
    } finally {
        event.target.value = '';
    }
}

function saveParameterSetToFile() {
    const json = exportParameterSet();
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'wheel_params.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setStatus('Parameter set saved to JSON file.', 'success');
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

    // console.log(scadLogOutput);
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
    loadParamsButton.disabled = true;
    saveParamsButton.disabled = true;
    generateWait.style.display = "inline-flex";

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
    loadParamsButton.disabled = false;
    saveParamsButton.disabled = false;
    generateWait.style.display = "none";
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
    directionalLight.position.set(30, 30, 60);
    scene.add(directionalLight);

    const fillLight = new THREE.DirectionalLight(0x66aaff, 0.7);
    fillLight.position.set(-30, 20, 60);
    scene.add(fillLight);

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.9);
    directionalLight2.position.set(30, 30, -60);
    scene.add(directionalLight2);

    const fillLight2 = new THREE.DirectionalLight(0x66aaff, 0.7);
    fillLight2.position.set(-30, 20, -60);
    scene.add(fillLight2);

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
    renderPresetSelector();
    initScene();

    generateButton.addEventListener('click', updatePreview);
    downloadButton.addEventListener('click', downloadGeometry);
    loadParamsButton.addEventListener('click', () => paramsFileInput.click());
    saveParamsButton.addEventListener('click', saveParameterSetToFile);
    paramsFileInput.addEventListener('change', loadParameterSetFromFile);
    window.addEventListener('resize', resizeRenderer);

    const tabElements = document.querySelectorAll('button[data-bs-toggle="tab"]');
    tabElements.forEach(tabEl => {
        tabEl.addEventListener('shown.bs.tab', function (event) {
            resizeRenderer();
        });
    });
});
