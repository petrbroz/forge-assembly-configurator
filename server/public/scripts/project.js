import { initializeViewer, loadModel } from './viewer-utilities.js';
import { deleteProject, getProject, getTemplate, showAlert } from './api-utilities.js';
import { updateLoginUI, userLoggedIn } from './user-utilities.js';

const state = {
    modules: []
};

let viewer = null;
let urn = null;

$(async function () {
    updateLoginUI();

    const id = new URLSearchParams(window.location.search).get('id');
    if (!id) {
        showAlert('Error', 'Missing project ID.');
        return;
    }

    try {
        const project = await getProject(id);
        const template = await getTemplate(project.template_id);
        if (userLoggedIn() && USER.id === project.author_id && !project.public && !project.status) {
            updateGeneralUI(project, template);
            updateEditingUI(project, template);
        } else if (DEBUG_MODE) {
            updateGeneralUI(project, template);
            updateEditingUI(project, template);
        } else {
            updateGeneralUI(project, template);
            updateViewingUI(project, template);
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

    setupDragDrop(template, viewer, document.getElementById('viewer'), state);
    setupBuildButton(project, state);
    setupRemoveModuleButton();
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
                path: _module.shared_assets_path
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
            lastModule.xform = lastModule.model.getPlacementTransform();
            if (state.modules.length === 1) {
                lastModule.xform.elements[12] = 0;
                lastModule.xform.elements[13] = 0;
                lastModule.xform.elements[14] = 0;
            } else {
                const rect = viewer.container.getBoundingClientRect();
                const snappingPoint = findSnappingPoint(viewer, ev.clientX - rect.left, ev.clientY - rect.top);
                if (snappingPoint) {
                    lastModule.xform.elements[12] = snappingPoint.x;
                    lastModule.xform.elements[13] = snappingPoint.y;
                    lastModule.xform.elements[14] = snappingPoint.z;
                }

                /*
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
                */
            }
            lastModule.model.setPlacementTransform(lastModule.xform);
            lastModule.bbox = lastModule.model.getBoundingBox().clone();
            viewer.impl.invalidate(true, true, true);
        }
    });
    container.addEventListener('drop', function (ev) {
        ev.preventDefault();
        const lastModule = state.modules.length > 0 ? state.modules[state.modules.length - 1] : null;
        if (lastModule) {
            const connectorsExt = viewer.getExtension('ConnectorRuntimeExtension');
            connectorsExt.addConnectors(lastModule.module.connectors.map(connector => {
                let newConnector = {
                    transform: connector.transform.slice(),
                    grid: connector.grid,
                    model: lastModule.model
                };
                newConnector.transform[3] += lastModule.xform.elements[12];
                newConnector.transform[7] += lastModule.xform.elements[13];
                newConnector.transform[11] += lastModule.xform.elements[14];
                return newConnector;
            }));
            delete lastModule.dragged;
        }
        updatePlacedModules();
    });
}

function findSnappingPoint(viewer, clientX, clientY) {
    const connectorsExt = viewer.getExtension('ConnectorRuntimeExtension');
    const nearest = connectorsExt.findNearest(clientX, clientY, 50.0); // try snapping to the nearest connector in 50px radius
    if (nearest) {
        return nearest;
    }
    return null;

    /*
    let modelIDs = viewer.getAllModels().map(model => model.id);
    modelIDs.pop();
    let hit = viewer.impl.hitTest(clientX, clientY, true, null, modelIDs);
    if (hit) {
        return hit.intersectPoint;
    } else {
        return viewer.impl.intersectGround(clientX, clientY);
    }
    */
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
    const logsTextArea = document.getElementById('logs-content');
    logsTextArea.value = await logs.text();
    logsTextArea.scrollTop = logsTextArea.scrollHeight;

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
        if (viewer && urn !== status.urn) {
            urn = status.urn;
            loadModel(viewer, urn);
        }
    } else {
        document.getElementById('preview-tab').classList.add('disabled');
    }

    // If the project is still being built, schedule another update
    if (status.status === 'inprogress') {
        setTimeout(updateStatus, 10 * 1000, project);
    }
}

function setupRemoveModuleButton() {
    const $placedModules = $('#placed-modules');
    const $removeModuleButton = $('#remove-module');
    function onModulesChange() {
        if ($placedModules.val()) {
            $removeModuleButton.show();
        } else {
            $removeModuleButton.hide();
        }
    }
    function onButtonClick() {
        if ($placedModules.val()) {
            const index = $placedModules[0].selectedIndex;
            const module = state.modules[index];
            state.modules.splice(index, 1);
            const connectorsExt = viewer.getExtension('ConnectorRuntimeExtension');
            connectorsExt.removeConnectors(module.model);
            viewer.unloadModel(module.model);
            updatePlacedModules();
        }
    }
    $placedModules.on('change', onModulesChange);
    $removeModuleButton.on('click', onButtonClick);
    onModulesChange();
}