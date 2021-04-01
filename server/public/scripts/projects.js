import { deleteProject, listProjects, listTemplates, showAlert } from './api-utilities.js';

$(function () {
    updateProjects();
    updateTemplates();
});

async function updateProjects() {
    const $projects = $('#projects');
    $projects.html(`
        <div class="col alert alert-info" role="alert">
            Loading...
        </div>
    `);

    let projects;
    try {
        projects = await listProjects();
    } catch (err) {
        showAlert('Error', 'Could not retrieve projects: ' + err);
        return;
    }

    $projects.empty();
    for (const project of projects) {
        $projects.append(`
            <div class="col-lg-3 col-md-4 col-sm-6 col-12 pb-3">
                <div class="card">
                    <img src="/api/projects/${project.id}/thumbnail.png" class="card-img-top" alt="${project.name}" onerror="this.onerror=null; this.src='https://via.placeholder.com/200x200';">
                    <div class="card-body">
                        <h5 class="card-title">${project.name}</h5>
                        <p class="card-text">Author: ${project.author}</p>
                    </div>
                    <div class="card-footer">
                        <a href="/project.html?id=${project.id}" class="btn btn-sm btn-outline-primary">${project.status ? 'View' : 'Edit'}</a>
                        <a href="#" data-remove-id="${project.id}" class="btn btn-sm btn-outline-danger">Remove</a>
                    </div>
                </div>
            </div>
        `);
    }
    $('#projects a.btn-outline-danger').click(async function (ev) {
        const projectId = $(ev.target).data('remove-id');
        if (projectId) {
            try {
                await deleteProject(projectId);
                window.location.reload();
            } catch (err) {
                showAlert('Error', 'Could not delete project: ' + err);
            }
        }
    });
}

async function updateTemplates() {
    const $templates = $('#project-template');
    $templates.empty();

    let templates;
    try {
        templates = await listTemplates();
    } catch (err) {
        showAlert('Error', 'Could not retrieve templates: ' + err);
        return;
    }

    for (const template of templates) {
        $templates.append(`
            <option value="${template.id}">${template.name} (${template.author})</option>
        `);
    }
}