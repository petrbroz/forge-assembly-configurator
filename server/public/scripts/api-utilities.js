export async function listProjects() {
    const resp = await fetch('/api/projects');
    if (!resp.ok) {
        throw new Error(await resp.text());
    }
    const projects = await resp.json();
    return projects;
}

export async function getProject(projectId) {
    const resp = await fetch(`/api/projects/${projectId}`);
    if (!resp.ok) {
        throw new Error(await resp.text());
    }
    const project = await resp.json();
    return project;
}

export async function deleteProject(projectId) {
    const resp = await fetch(`/api/projects/${projectId}`, { method: 'delete' });
    if (!resp.ok) {
        throw new Error(await resp.text());
    }
}

export async function listTemplates() {
    const resp = await fetch('/api/templates');
    if (!resp.ok) {
        throw new Error(await resp.text());
    }
    const templates = await resp.json();
    return templates;
}

export async function getTemplate(templateId) {
    const resp = await fetch(`/api/templates/${templateId}`);
    if (!resp.ok) {
        throw new Error(await resp.text());
    }
    const template = await resp.json();
    // TODO: fix this when the template is created/updated
    for (const _module of template.modules) {
        for (const connector of _module.connectors) {
            connector.transform = connector.transform.map(el => parseFloat(el));
            if (connector.grid) {
                connector.grid.repeat = connector.grid.repeat.map(el => parseFloat(el));
                connector.grid.offset = connector.grid.offset.map(el => parseFloat(el));
            }
        }
    }
    return template;
}

export async function publishTemplate(templateId) {
    const resp = await fetch(`/api/templates/${templateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ public: true })
    });
    if (!resp.ok) {
        throw new Error(await resp.text());
    }
}

export async function getTemplateAssets(templateId) {
    const resp = await fetch(`/api/templates/${templateId}/assets`);
    if (!resp.ok) {
        throw new Error(await resp.text());
    }
    const assets = await resp.json();
    return assets;
}

export async function getTemplateModules(templateId) {
    const resp = await fetch(`/api/templates/${templateId}/modules`);
    if (!resp.ok) {
        throw new Error(await resp.text());
    }
    const modules = await resp.json();
    return modules;
}

export async function addTemplateModule(templateId, name, assetPath, transform, connectors) {
    const resp = await fetch(`/api/templates/${templateId}/modules`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name,
            shared_assets_path: assetPath,
            transform,
            connectors,
        })
    });
    const _module = await resp.json();
    return _module;
}

export async function updateTemplateModule(templateId, moduleId, transform, connectors) {
    const resp = await fetch(`/api/templates/${templateId}/modules/${moduleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transform, connectors })
    });
    if (!resp.ok) {
        throw new Error(await resp.text());
    }
    const _module = await resp.json();
    return _module;
}

export async function deleteTemplate(templateId) {
    const resp = await fetch(`/api/templates/${templateId}`, { method: 'delete' });
    if (!resp.ok) {
        throw new Error(await resp.text());
    }
}

export function showAlert(title, message) {
    $(window.document.body).append(`
        <div class="position-fixed bottom-0 right-0 p-3" style="z-index: 5; right: 0; bottom: 0;">
            <div class="toast" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="toast-header">
                    <strong class="mr-auto">${title}</strong>
                    <!--<small class="text-muted">${new Date().toTimeString()}</small>-->
                    <button type="button" class="ml-2 mb-1 close" data-dismiss="toast" aria-label="Close">
                        <span aria-hidden="true">&times;</span>
                    </button>
                </div>
                <div class="toast-body">
                    ${message}
                </div>
            </div>
        </div>
    `);
    $('.toast').toast({ autohide: false }).toast('show');
}