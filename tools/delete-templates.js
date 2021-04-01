const { listTemplates, deleteTemplate } = require('../shared/templates.js');

async function run() {
    const templates = await listTemplates();
    for (const template of templates) {
        console.log('Deleting template', template.id);
        await deleteTemplate(template.id);
    }
}

run()
    .then(() => console.log('Done!'))
    .catch(err => console.error(err));