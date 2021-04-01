import { initializeViewer, loadModel } from './viewer-utilities.js';
import { deleteProject, getProject, getTemplate, showAlert } from './api-utilities.js';

const state = {
    enclosure: {
        path: null,
        connectors: null,
        model: null
    },
    modules: []
};

let viewer = null;
let urn = null;

$(async function () {
    const id = new URLSearchParams(window.location.search).get('id');
    if (!id) {
        showAlert('Error', 'Missing project ID.');
        return;
    }

    try {
        const project = await getProject(id);
        const template = await getTemplate(project.template_id);
        if (project.status !== '' && project.status !== null) {
            updateGeneralUI(project, template);
            updateViewingUI(project, template);
        } else {
            updateGeneralUI(project, template);
            updateEditingUI(project, template);
        }
    } catch (err) {
        showAlert('Error', 'Could not retrieve project information: ' + err);
    }
});

async function updateGeneralUI(project, template) {
    $('.breadcrumb-item.active').text(project.name);
    $('#project-author').val(project.author);
    $('#project-created').val(new Date(project.created));
    $('#project-template').val(template.name);
    $('#project-status').val(project.status);
    $('#remove').click(async function () {
        try {
            await deleteProject(project.id);
            window.location.href = `/projects.html`;
        } catch (err) {
            showAlert('Error', 'Could not delete project: ' + err);
        }
    });
}

async function updateViewingUI(project, template) {
    $('[data-hidden-when=viewing]').hide();
    $('[data-disabled-when=viewing]').attr('disabled', 'true');
    $('[data-readonly-when=viewing]').attr('readonly', 'true');
    $('#metadata-tab').tab('show');

    try {
        viewer = await initializeViewer(document.getElementById('viewer'));
    } catch (err) {
        showAlert('Error', 'Could not initialize viewer: ' + err);
        return;
    }

    if (project.urn) {
        urn = project.urn;
        loadModel(viewer, urn, { keepCurrentModels: false, applyScaling: 'cm', globalOffset: new THREE.Vector3(0, 0, 0) });
    } else {
        $('#logs-tab').tab('show');
    }
    updateStatus(project);
}

async function updateEditingUI(project, template) {
    $('[data-hidden-when=editing]').hide();
    $('[data-disabled-when=editing]').attr('disabled', 'true');
    $('[data-readonly-when=editing]').attr('readonly', 'true');
    $('#configuration-tab').tab('show');

    const $availableEnclosures = $('#project-enclosure');
    $availableEnclosures.empty();
    for (const enclosure of template.enclosures) {
        $availableEnclosures.append(`
            <option value="${enclosure.id}">
                ${enclosure.name}
            </option>
        `);
    }

    const $availableModules = $('#available-modules');
    $availableModules.empty();
    for (const _module of template.modules) {
        $availableModules.append(`
            <li>
                <img src="/api/templates/${template.id}/modules/${_module.id}/thumbnail.png" alt="${_module.name}" data-module-id="${_module.id}">
            </li>
        `);
    }

    try {
        viewer = await initializeViewer(document.getElementById('viewer'), { extensions: ['ConnectorRuntimeExtension'] });
    } catch (err) {
        showAlert('Error', 'Could not initialize viewer: ' + err);
        return;
    }

    $('#project-enclosure').change({ viewer, project, template }, onEnclosureChange);
    onEnclosureChange({ data: { viewer, project, template } });
    setupDragDrop(template, viewer, document.getElementById('viewer'), state);
    setupBuildButton(project, state);
}

async function onEnclosureChange(ev) {
    const { viewer, project, template } = ev.data;
    const enclosureId = $('#project-enclosure').val();
    const enclosure = template.enclosures.find(e => e.id === enclosureId);
    if (enclosure && enclosure.urn) {
        const { urn } = enclosure;
        state.enclosure.model = await loadModel(viewer, urn, { keepCurrentModels: false, applyScaling: 'cm', globalOffset: new THREE.Vector3(0, 0, 0) });
        fetch(`/api/templates/${template.id}/enclosures/${enclosure.id}`)
            .then(resp => resp.json())
            .then(enc => {
                state.enclosure.connectors = enc.connectors;
                state.enclosure.path = enc.asset_path;
                state.modules = [];
                viewer.getExtension('ConnectorRuntimeExtension').resetConnectors(state.enclosure.connectors);
                updatePlacedModules();
            })
            .catch(err => {
                showAlert('Error', 'Could not retrieve enclosure information: ' + err);
            });
    } else {
        showAlert('Error', 'Enclosure not found.');
    }
}

function setupDragDrop(template, viewer, container, state) {
    // Setup the dragstart event
    document.querySelectorAll('#available-modules img').forEach(el => {
        const id = el.getAttribute('data-module-id');
        const _module = template.modules.find(m => m.id === id);
        el.addEventListener('dragstart', function (ev) {
            ev.dataTransfer.effectAllowed = 'copy';
            // If the last dragged model wasn't actually inserted (dropped), remove it
            const lastModule = state.modules.length > 0 ? state.modules[state.modules.length - 1] : null;
            if (lastModule && lastModule.dragged) {
                lastModule.promise.then(model => viewer.unloadModel(model));
            }
            const newModule = {
                module: _module,
                dragged: true,
                clashing: false,
                promise: loadModel(viewer, _module.urn, { keepCurrentModels: true, applyScaling: 'cm', globalOffset: new THREE.Vector3(0, 0, 0) }),
                model: null,
                xform: null,
                bbox: null,
                connector: _module.connector,
                path: _module.asset_path
            };
            newModule.promise.then(model => {
                newModule.model = model;
                newModule.bbox = model.getBoundingBox();
            });
            state.modules.push(newModule);
        });
    });

    // Setup the drag events for the viewer
    container.addEventListener('dragover', function (ev) {
        ev.preventDefault();
        const lastModule = state.modules.length > 0 ? state.modules[state.modules.length - 1] : null;
        if (lastModule && lastModule.dragged && lastModule.model) {
            const rect = viewer.container.getBoundingClientRect();
            const snappingPoint = findSnappingPoint(viewer, ev.clientX - rect.left, ev.clientY - rect.top, state.enclosure);
            lastModule.xform = lastModule.model.getPlacementTransform();
            lastModule.xform.elements[12] = snappingPoint.x - lastModule.connector[0];
            lastModule.xform.elements[13] = snappingPoint.y - lastModule.connector[1];
            lastModule.xform.elements[14] = snappingPoint.z - lastModule.connector[2];
            lastModule.model.setPlacementTransform(lastModule.xform);
            lastModule.bbox = lastModule.model.getBoundingBox().clone();

            // Check if the current position clashes with any other modules
            lastModule.clashing = false;
            for (let i = 0, len = state.modules.length - 1; i < len; i++) {
                if (state.modules[i].bbox.isIntersectionBox(lastModule.bbox)) {
                    lastModule.clashing = true;
                }
            }
            if (lastModule.clashing === true) {
                viewer.setThemingColor(1, new THREE.Vector4(1, 0, 0, 0.5), lastModule.model, true);
            } else {
                viewer.clearThemingColors(lastModule.model);
                //viewer.setThemingColor(1, new THREE.Vector4(0, 1, 0, 0.5), lastModule.model, true);
            }

            viewer.impl.invalidate(true, true, true);
        }
    });
    container.addEventListener('drop', function (ev) {
        ev.preventDefault();
        const lastModule = state.modules.length > 0 ? state.modules[state.modules.length - 1] : null;
        if (lastModule) {
            delete lastModule.dragged;
        }
        updatePlacedModules();
    });
}

function findSnappingPoint(viewer, clientX, clientY, enclosure) {
    const connectorsExt = viewer.getExtension('ConnectorRuntimeExtension');
    const nearest = connectorsExt.findNearest(clientX, clientY, 50.0); // try snapping to the nearest connector in 50px radius
    if (nearest) {
        const pos = nearest.position;
        return new THREE.Vector3(pos[0], pos[1], pos[2]);
    }
    let hit = viewer.impl.hitTest(clientX, clientY, true, null, [enclosure.model.getModelId()]);
    if (hit) {
        return hit.intersectPoint;
    } else {
        return viewer.impl.intersectGround(clientX, clientY);
    }
}

function updatePlacedModules() {
    const $placedModules = $('#placed-modules');
    $placedModules.empty();
    for (const _module of state.modules) {
        $placedModules.append(`
            <option>${_module.module.name}</option>
        `);
    }
}

function setupBuildButton(project, state) {
    $('#build').click(async function () {
        let config = [];
        config.push({
            path: state.enclosure.path.replace(/\//g, '\\'),
            xform: [
                1, 0, 0, 0,
                0, 1, 0, 0,
                0, 0, 1, 0,
                0, 0, 0, 1
            ]
        });

        for (const mod of state.modules) {
            const el = {
                path: mod.path.replace(/\//g, '\\'),
                xform: [
                    1, 0, 0, mod.xform.elements[12],
                    0, 1, 0, mod.xform.elements[13],
                    0, 0, 1, mod.xform.elements[14],
                    0, 0, 0, 1
                ]
            };
            config.push(el);
        }

        const resp = await fetch(`/api/projects/${project.id}/build`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(config)
        });
        const json = await resp.json();
        console.log(json);
        window.location.reload(); // window.location.href = `/projects/${project.id}`;
    });
}

async function updateStatus(project) {
    const resp = await fetch(`/api/projects/${project.id}/status`);
    const status = await resp.json();

    // Update the status fields
    const progress = document.getElementById('progress');
    progress.style.width = `${status.progress}%`;
    progress.setAttribute('aria-valuenow', status.progress);
    document.getElementById('project-status').value = status.status;

    // Update the logs
    const logs = await fetch(`/api/projects/${project.id}/logs.txt`);
    document.getElementById('logs-content').value = await logs.text();

    // Update the report
    if (status.status === 'inprogress') {
        document.getElementById('report-tab').classList.add('disabled');
    } else {
        document.getElementById('report-tab').classList.remove('disabled');
        const report = await fetch(`/api/projects/${project.id}/report.txt`);
        document.getElementById('report-content').value = await report.text();
    }

    // Update the download buttons
    if (status.status === 'inprogress') {
        document.getElementById('download-btn-group').classList.add('disabled');
    } else {
        document.getElementById('download-zip').setAttribute('href', `/api/projects/${project.id}/output.zip`);
        document.getElementById('download-rfa').setAttribute('href', `/api/projects/${project.id}/output.rfa`);
        document.getElementById('download-btn-group').classList.remove('disabled');
    }

    // Update the viewer
    if (status.status === 'finished' && status.urn) {
        document.getElementById('preview-tab').classList.remove('disabled');
        urn = status.urn;
        if (viewer) {
            loadModel(viewer, urn);
        }
    } else {
        document.getElementById('preview-tab').classList.add('disabled');
    }

    // If the project is still being built, schedule another update
    if (status.status === 'inprogress') {
        setTimeout(updateStatus, 5000, project);
    }
}