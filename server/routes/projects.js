const path = require('path');
const express = require('express');
const multer = require('multer');
const {
    getTemplate,
    listTemplates,
} = require('../../common/templates.js');
const {
    createProject,
    getProject,
    listProjects,
    updateProject,
    buildProject,
    getProjectLogs,
    getProjectThumbnail,
    getProjectOutput
} = require('../../common/projects.js');

let router = express.Router();
let upload = multer({ dest: path.join(__dirname, '..', '..', 'cache', 'uploads') });

// List existing projects
router.get('/', async function (req, res, next) {
    try {
        const templates = await listTemplates();
        const projects = await listProjects();
        res.render('project-list', { projects, templates });
    } catch (err) {
        next(err);
    }
});

// Create new project
router.post('/', upload.none(), async function (req, res, next) {
    try {
        const { name, author, template_id } = req.body;
        if (!name || !author || !template_id) {
            throw new Error('One of the required fields is missing: name, author, template_id');
        }
        const project = await createProject(name, author, template_id);
        res.redirect(`/projects/${project.id}`);
    } catch (err) {
        next(err);
    }
});

// View project details
router.get('/:id', async function (req, res, next) {
    try {
        const project = await getProject(req.params.id);
        if (project.status !== null && project.status !== '') {
            res.render('project-detail-view', { project });
        } else {
            const template = await getTemplate(project.template_id);
            const { enclosures, modules } = template;
            res.render('project-detail-edit', { project, template, enclosures, modules });
        }
    } catch (err) {
        next(err);
    }
});

// Build the project
router.post('/:id/build', async function (req, res, next) {
    try {
        await updateProject(req.params.id, project => {
            project.status = 'inprogress';
            project.progress = 0;
        });
        buildProject(req.params.id, req.body);
        res.json({ status: 'ok' });
    } catch (err) {
        res.status(500).send(err);
    }
});

// Get project status
router.get('/:id/status', async function (req, res) {
    const { status, progress, urn } = await getProject(req.params.id);
    res.json({ status, progress, urn });
});

// Get project logs
router.get('/:id/logs.txt', async function (req, res) {
    const logs = await getProjectLogs(req.params.id);
    res.type('.txt').send(logs);
});

// Get project report
router.get('/:id/config.json', async function (req, res) {
    const buff = await getProjectOutput(req.params.id, 'config.json');
    if (buff) {
        res.type('.json').send(buff);
    } else {
        res.status(404).end();
    }
});

// Get project report
router.get('/:id/report.txt', async function (req, res) {
    const buff = await getProjectOutput(req.params.id, 'report.txt');
    if (buff) {
        res.type('.txt').send(buff);
    } else {
        res.status(404).end();
    }
});

// Get project thumbnail
router.get('/:id/thumbnail.png', async function (req, res) {
    const buff = await getProjectThumbnail(req.params.id);
    if (buff) {
        res.type('.png').send(buff);
    } else {
        res.status(404).end();
    }
});

// Get project output (Inventor assembly)
router.get('/:id/output.zip', async function (req, res) {
    const buff = await getProjectOutput(req.params.id, 'output.zip');
    if (buff) {
        res.type('.zip').send(buff);
    } else {
        res.status(404).end();
    }
});

// Get project output (Revit family)
router.get('/:id/output.rfa', async function (req, res) {
    const buff = await getProjectOutput(req.params.id, 'output.rfa');
    if (buff) {
        res.type('.rfa').send(buff);
    } else {
        res.status(404).end();
    }
});

module.exports = router;
