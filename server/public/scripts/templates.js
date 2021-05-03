import { listTemplates, deleteTemplate, showAlert } from './api-utilities.js';
import { updateLoginUI, userLoggedIn } from './user-utilities.js';

$(function () {
    updateLoginUI();
    updateTemplates();
});

async function updateTemplates() {
    const $templates = $('#templates');
    $templates.html(`
        <div class="col alert alert-info" role="alert">
            Loading...
        </div>
    `);

    let templates;
    try {
        templates = await listTemplates();
    } catch (err) {
        showAlert('Error', 'Could not retrieve templates: ' + err);
        return;
    } finally {
        $templates.empty();
    }

    for (const template of templates) {
        $templates.append(`
            <div class="col-lg-3 col-md-4 col-sm-6 col-12 pb-3">
                <div class="card">
                    <img src="/api/templates/${template.id}/thumbnail.png" class="card-img-top" alt="${template.name}" onerror="this.onerror=null; this.src='https://via.placeholder.com/200x200';">
                    <div class="card-body">
                        <h5 class="card-title">${template.name}</h5>
                        <p class="card-text">Author: ${template.author}</p>
                    </div>
                    <div class="card-footer">
                        <a href="/template.html?id=${template.id}" class="btn btn-sm btn-outline-primary">${template.public || !userLoggedIn() || USER.id !== template.author_id ? 'View' : 'Edit'}</a>
                        ${(userLoggedIn() && USER.id === template.author_id && !template.public) || DEBUG_MODE ? `<a href="#" data-remove-id="${template.id}" class="btn btn-sm btn-outline-danger">Remove</a>` : ``}
                    </div>
                </div>
            </div>
        `);
    }
    $('#templates a.btn-outline-danger').click(async function (ev) {
        const templateId = $(ev.target).data('remove-id');
        if (templateId) {
            try {
                await deleteTemplate(templateId);
                window.location.reload();
            } catch (err) {
                showAlert('Error', 'Could not delete template: ' + err);
            }
        }
    });
}
