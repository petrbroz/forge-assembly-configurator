import { initializeViewer, loadModel } from './viewer-utilities.js';
import {
    getTemplate,
    deleteTemplate,
    getTemplateAssets,
    getTemplateModules,
    addTemplateModule,
    updateTemplateModule,
    showAlert
} from './api-utilities.js';

const state = {
    modules: [],
    selected: null
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
        state.modules = template.modules;
        initGeneralUI(template);
        if (template.public) {
            initViewingUI(template);
        } else {
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
        try {
            // modules expect a single connector
            await updateTemplateModule(template.id, state.selected.id, null, ext.connectors);
        } catch (err) {
            showAlert('Error', 'Could not update module: ' + err);
        }
    });
    initModals(template);
    updateModuleList(template);
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
    const $availableModules = $('#available-modules');
    $availableModules.empty();
    const assets = await getTemplateAssets(template.id);
    for (const asset of assets) {
        $availableModules.append(`
            <option value="${asset}">${asset}</option>
        `);
    }

    $('#create-module').click(async function () {
        $('#new-module-modal').modal('hide');
        await addTemplateModule(template.id, $('#new-module-name').val(), $availableModules.val(), null, []);
        window.location.reload();
    });
}

async function updateModuleList(template) {
    const $components = $('#component-list');
    $components.empty();
    try {
        state.modules = await getTemplateModules(template.id);
    } catch (err) {
        showAlert('Error', 'Could not retrieve template modules: ' + err);
        return;
    }

    let needsRefresh = false;
    for (const _module of state.modules) {
        // TODO: instead of checking the existence of URN, check the Model Derivative manifest instead
        if (_module.urn) {
            $components.append(`
                <option value="${_module.id}" data-type="module" data-urn="${_module.urn}">${_module.name}</option>
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
        setTimeout(updateModuleList, 5000, template);
    }
}

async function updateConnectorList() {
    const $connectors = $('#connector-list');
    $connectors.empty();

    const ext = viewer.getExtension('ConnectorEditExtension');
    const connectors = ext.connectors;
    for (let i = 0; i < connectors.length; i++) {
        $connectors.append(`
            <option value="${i}">Connector #${i}</option>
        `);
    }

    $connectors.off('change', onConnectorListSelectionChanged).on('change', onConnectorListSelectionChanged);
    $('#connector-props').hide();
}

async function onComponentListSelectionChange(ev) {
    const id = $(ev.target).val();
    state.selected = state.modules.find(m => m.id === id);

    if (state.selected) {
        $('#connectors').show();
        await loadModel(viewer, state.selected.urn, { keepCurrentModels: false, applyScaling: 'cm', globalOffset: new THREE.Vector3(0, 0, 0) });
        const ext = await viewer.loadExtension('ConnectorEditExtension');
        ext.addEventListener('connectors-changed', function (ev) {
            updateConnectorList();
        });
        ext.connectors = state.selected.connectors || [];
    } else {
        $('#connectors').hide();
    }
}

async function onConnectorListSelectionChanged(ev) {
    $('#connector-props').show();
    const ext = viewer.getExtension('ConnectorEditExtension');
    const index = parseInt($(ev.target).val());
    const connector = ext.connectors[index];
    const $x = $('#connector-pos-x');
    const $y = $('#connector-pos-y');
    const $z = $('#connector-pos-z');
    const $rx = $('#connector-repeat-x');
    const $ry = $('#connector-repeat-y');
    const $rz = $('#connector-repeat-z');
    const $ox = $('#connector-offset-x');
    const $oy = $('#connector-offset-y');
    const $oz = $('#connector-offset-z');
    // For now we only support editing the position, not the entire 4x4 transform
    $x.val(connector.transform[3]);
    $y.val(connector.transform[7]);
    $z.val(connector.transform[11]);
    if (connector.grid) {
        $rx.val(connector.grid.repeat[0]);
        $ry.val(connector.grid.repeat[1]);
        $rz.val(connector.grid.repeat[2]);
        $ox.val(connector.grid.offset[0]);
        $oy.val(connector.grid.offset[1]);
        $oz.val(connector.grid.offset[2]);
    } else {
        $rx.val(1);
        $ry.val(1);
        $rz.val(1);
        $ox.val(0);
        $oy.val(0);
        $oz.val(0);
    }

    function update() {
        connector.transform[3] = parseFloat($x.val());
        connector.transform[7] = parseFloat($y.val());
        connector.transform[11] = parseFloat($z.val());
        connector.grid.repeat[0] = parseInt($rx.val());
        connector.grid.repeat[1] = parseInt($ry.val());
        connector.grid.repeat[2] = parseInt($rz.val());
        connector.grid.offset[0] = parseFloat($ox.val());
        connector.grid.offset[1] = parseFloat($oy.val());
        connector.grid.offset[2] = parseFloat($oz.val());
        ext.updateOverlay();
    }
    for (const el of [$x, $y, $z, $rx, $ry, $rz, $ox, $oy, $oz]) {
        el.off().on('change', update);
    }
}
