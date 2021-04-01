import { initializeViewer, loadModel } from './viewer-utilities.js';
import {
    getTemplate,
    deleteTemplate,
    getTemplateAssets,
    getTemplateEnclosures,
    addTemplateEnclosure,
    updateTemplateEnclosure,
    getTemplateModules,
    addTemplateModule,
    updateTemplateModule,
    showAlert
} from './api-utilities.js';

const state = {
    enclosures: [],
    modules: [],
    selected: null,
    connectors: []
};

let viewer = null;

$(async function () {
    const id = new URLSearchParams(window.location.search).get('id');
    if (!id) {
        showAlert('Error', 'Missing template ID.');
        return;
    }

    try {
        const template = await getTemplate(id);
        state.enclosures = template.enclosures;
        state.modules = template.modules;
        if (template.public) {
            initGeneralUI(template);
            initViewingUI(template);
        } else {
            initGeneralUI(template);
            initEditingUI(template);
        }
    } catch (err) {
        showAlert('Error', 'Could not retrieve template information: ' + err);
    }
});

async function initGeneralUI(template) {
    $('.breadcrumb-item.active').text(template.name);
    $('#template-author').val(template.author);
    $('#template-created').val(new Date(template.created));
    $('#template-template').val(template.name);
    $('#template-status').val(template.public ? 'published' : 'unpublished');
    $('#remove').click(async function () {
        try {
            await deleteTemplate(id);
            window.location.href = `/templates.html`;
        } catch (err) {
            showAlert('Error', 'Could not delete template: ' + err);
        }
    });
    $('#save-connectors').click(async function () {
        const ext = viewer.getExtension('ConnectorEditExtension');
        const connectors = ext.connectors;
        const id = state.selected.id;
        if (state.enclosures.find(e => e.id === id)) {
            try {
                await updateTemplateEnclosure(template.id, id, connectors);
            } catch (err) {
                showAlert('Error', 'Could not update enclosure: ' + err);
            }
        } else {
            try {
                // modules expect a single connector
                const connector = connectors[Object.keys(connectors)[0]];
                await updateTemplateModule(template.id, id, connector);
            } catch (err) {
                showAlert('Error', 'Could not update module: ' + err);
            }
        }
    });
    initModals(template);
    updateComponentList(template);
}

async function initViewingUI(template) {
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
}

async function initEditingUI(template) {
    $('[data-hidden-when=editing]').hide();
    $('[data-disabled-when=editing]').attr('disabled', 'true');
    $('[data-readonly-when=editing]').attr('readonly', 'true');
    $('#components-tab').tab('show');

    try {
        viewer = await initializeViewer(document.getElementById('viewer'), { extensions: ['ConnectorEditExtension'] });
    } catch (err) {
        showAlert('Error', 'Could not initialize viewer: ' + err);
        return;
    }
}

async function initModals(template) {
    const $availableEnclosures = $('#available-enclosures');
    const $availableModules = $('#available-modules');

    $availableEnclosures.empty();
    $availableModules.empty();
    const assets = await getTemplateAssets(template.id);
    for (const asset of assets) {
        $availableEnclosures.append(`
            <option value="${asset}">${asset}</option>
        `);
        $availableModules.append(`
            <option value="${asset}">${asset}</option>
        `);
    }

    $('#create-enclosure').click(async function () {
        $('#new-enclosure-modal').modal('hide');
        await addTemplateEnclosure(template.id, $('#new-enclosure-name').val(), $availableEnclosures.val(), []);
        window.location.reload();
    });
    $('#create-module').click(async function () {
        $('#new-module-modal').modal('hide');
        await addTemplateModule(template.id, $('#new-module-name').val(), $availableModules.val(), []);
        window.location.reload();
    });
}

async function updateComponentList(template) {
    const $components = $('#component-list');
    $components.empty();

    try {
        state.enclosures = await getTemplateEnclosures(template.id);
        state.modules = await getTemplateModules(template.id);
    } catch (err) {
        showAlert('Error', 'Could not retrieve template enclosures or modules: ' + err);
        return;
    }

    let needsRefresh = false;
    for (const enclosure of state.enclosures) {
        if (enclosure.urn) {
            $components.append(`
                <option value="${enclosure.id}" data-type="enclosure" data-urn="${enclosure.urn}">${enclosure.name} (enclosure)</option>
            `);
        } else {
            $components.append(`
                <option value="${enclosure.id}" data-type="enclosure" data-urn="" disabled>${enclosure.name} (processing...)</option>
            `);
            needsRefresh = true;
        }
    }
    for (const _module of state.modules) {
        if (_module.urn) {
            $components.append(`
                <option value="${_module.id}" data-type="module" data-urn="${_module.urn}">${_module.name} (module)</option>
            `);
        } else {
            $components.append(`
                <option value="${_module.id}" data-type="module" data-urn="" disabled>${_module.name} (processing...)</option>
            `);
            needsRefresh = true;
        }
    }

    $components.off('change', onComponentListSelectionChange).on('change', onComponentListSelectionChange);

    if (needsRefresh) {
        setTimeout(updateComponentList, 5000, template);
    }
}

async function updateConnectorList() {
    const $connectors = $('#connector-list');
    $connectors.empty();

    const ext = viewer.getExtension('ConnectorEditExtension');
    state.connectors = ext.connectors;
    for (const key in state.connectors) {
        const pos = state.connectors[key];
        $connectors.append(`
            <option value="${key}" data-x="${pos[0]}" data-y="${pos[1]}" data-z="${pos[2]}">${key}</option>
        `);
    }

    $connectors.off('change', onConnectorListSelectionChanged).on('change', onConnectorListSelectionChanged);
}

async function onComponentListSelectionChange(ev) {
    const id = $(ev.target).val();
    const matchingEnclosure = state.enclosures.find(e => e.id === id);
    const matchingModule = state.modules.find(m => m.id === id);
    state.selected = matchingEnclosure || matchingModule;

    if (matchingEnclosure) {
        $('#connectors').show();
    } else {
        $('#connectors').hide();
    }

    if (state.selected) {
        if (state.selected.urn) {
            await loadModel(viewer, state.selected.urn, { keepCurrentModels: false, applyScaling: 'cm', globalOffset: new THREE.Vector3(0, 0, 0) });
            const ext = await viewer.loadExtension('ConnectorEditExtension');
            ext.addEventListener('connectors-changed', function (ev) {
                updateConnectorList();
            });
            ext.connectors = state.selected.connectors || {};
        }
    }
}

async function onConnectorListSelectionChanged(ev) {
    const ext = viewer.getExtension('ConnectorEditExtension');
    const name = $(ev.target).val();
    const connector = ext.selectConnector(name);
    const $x = $('#connector-pos-x');
    const $y = $('#connector-pos-y');
    const $z = $('#connector-pos-z');
    $x.val(connector[0]);
    $y.val(connector[1]);
    $z.val(connector[2]);

    function update() {
        ext.updateConnector(name, parseFloat($x.val()), parseFloat($y.val()), parseFloat($z.val()));
    }
    $x.off().on('change', update);
    $y.off().on('change', update);
    $z.off().on('change', update);
}