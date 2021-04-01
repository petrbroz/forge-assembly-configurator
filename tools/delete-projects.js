const { listProjects, deleteProject } = require('../shared/projects.js');

async function run() {
    const projects = await listProjects();
    for (const project of projects) {
        console.log('Deleting project', project.id);
        await deleteProject(project.id);
    }
}

run()
    .then(() => console.log('Done!'))
    .catch(err => console.error(err));