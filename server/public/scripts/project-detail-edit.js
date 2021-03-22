/// import * as Autodesk from "@types/forge-viewer";

window.addEventListener('DOMContentLoaded', async function () {
    const preview = document.getElementById('preview');
    const viewer = await initializeViewer(preview, { extensions: ['ConnectorsExtension'] });
    const state = {
        enclosure: {
            path: null,
            connectors: null,
            model: null
        },
        modules: []
    };
    setupEnclosureUI(viewer, state);
    setupModulesUI(viewer, state);
    setupDragDrop(viewer, preview, state);
    setupBuild(state);
});

function setupEnclosureUI(viewer, state) {
    document.querySelectorAll('#enclosures a').forEach(el => {
        const urn = el.getAttribute('data-urn');
        const templateId = el.getAttribute('data-template-id');
        const enclosureId = el.getAttribute('data-enclosure-id');
        el.addEventListener('click', async function (ev) {
            state.enclosure.model = await loadModel(viewer, urn, { keepCurrentModels: false, applyScaling: 'cm', globalOffset: new THREE.Vector3(0, 0, 0) });
            fetch(`/templates/${templateId}/enclosures/${enclosureId}`)
                .then(resp => resp.json())
                .then(enc => {
                    state.enclosure.connectors = enc.connectors;
                    state.enclosure.path = enc.asset_path;
                    viewer.getExtension('ConnectorsExtension').resetConnectors(state.enclosure.connectors);
                })
                .catch(err => {
                    alert('Could not retrieve enclosure info. See console for more details.');
                    console.error(err);
                });
        });
    });
}

function setupModulesUI(viewer, state) {
    document.querySelectorAll('#modules .list-group-item').forEach(el => {
        const urn = el.getAttribute('data-urn');
        const connector = el.getAttribute('data-connector').split(',');
        const path = el.getAttribute('data-path');
        el.addEventListener('dragstart', function (ev) {
            ev.dataTransfer.effectAllowed = 'copy';
            // If the last dragged model wasn't actually inserted (dropped), remove it
            const lastModule = state.modules.length > 0 ? state.modules[state.modules.length - 1] : null;
            if (lastModule && lastModule.dragged) {
                lastModule.promise.then(model => viewer.unloadModel(model));
            }
            const newModule = {
                dragged: true,
                clashing: false,
                promise: loadModel(viewer, urn, { keepCurrentModels: true, applyScaling: 'cm', globalOffset: new THREE.Vector3(0, 0, 0) }),
                model: null,
                xform: null,
                bbox: null,
                connector,
                path
            };
            newModule.promise.then(model => {
                newModule.model = model;
                newModule.bbox = model.getBoundingBox();
            });
            state.modules.push(newModule);
        });
    });
}

function setupDragDrop(viewer, container, state) {
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
    });
}

function setupBuild(state) {
    const build = document.getElementById('build');
    build.addEventListener('click', async function () {
        let config = [];

        config.push({
            path: state.enclosure.path.replace(/\//g, '\\'),
            // xform: transpose(enclosure.model.getPlacementTransform().toArray())
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
                // xform: transpose(mod.xform.toArray())
                xform: [
                    1, 0, 0, mod.xform.elements[12],
                    0, 1, 0, mod.xform.elements[13],
                    0, 0, 1, mod.xform.elements[14],
                    0, 0, 0, 1
                ]
            };
            config.push(el);
        }

        const resp = await fetch(`/projects/${PROJECT_ID}/build`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(config)
        });
        const json = await resp.json();
        console.log(json);
        window.location.href = `/projects/${PROJECT_ID}`;
    });
}

function findSnappingPoint(viewer, clientX, clientY, enclosure) {
    const connectorsExt = viewer.getExtension('ConnectorsExtension');
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