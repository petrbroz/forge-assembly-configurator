const path = require('path');
const express = require('express');
const multer = require('multer');
const {
    createProject,
    getProject,
    deleteProject,
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
        const projects = await listProjects();
        res.json(projects);
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
        res.redirect(`/project.html?id=${project.id}`);
    } catch (err) {
        next(err);
    }
});

// View project details
router.get('/:id', async function (req, res, next) {
    try {
        const project = await getProject(req.params.id);
        res.json(project);
    } catch (err) {
        next(err);
    }
});

// Remove project
router.delete('/:id', async function (req, res, next) {
    try {
        await deleteProject(req.params.id);
        res.status(200).end();
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
        next(err);
    }
});

// Get project status
router.get('/:id/status', async function (req, res, next) {
    try {
        const { status, progress, urn } = await getProject(req.params.id);
        res.json({ status, progress, urn });
    } catch (err) {
        next(err);
    }
});

// Get project logs
router.get('/:id/logs.txt', async function (req, res, next) {
    try {
        const logs = await getProjectLogs(req.params.id);
        res.type('.txt').send(logs);
    } catch (err) {
        next(err);
    }
});

// Get project report
router.get('/:id/config.json', async function (req, res, next) {
    try {
        const buff = await getProjectOutput(req.params.id, 'config.json');
        if (buff) {
            res.type('.json').send(buff);
        } else {
            res.status(404).end();
        }
    } catch (err) {
        next(err);
    }
});

// Get project report
router.get('/:id/report.txt', async function (req, res, next) {
    try {
        const buff = await getProjectOutput(req.params.id, 'report.txt');
        if (buff) {
            res.type('.txt').send(buff);
        } else {
            res.status(404).end();
        }
    } catch (err) {
        next(err);
    }
});

// Get project thumbnail
router.get('/:id/thumbnail.png', async function (req, res, next) {
    try {
        const buff = await getProjectThumbnail(req.params.id);
        if (buff) {
            res.type('.png').send(buff);
        } else {
            res.status(404).end();
        }
    } catch (err) {
        next(err);
    }
});

// Get project output (Inventor assembly)
router.get('/:id/output.zip', async function (req, res, next) {
    try {
        const buff = await getProjectOutput(req.params.id, 'output.zip');
        if (buff) {
            res.type('.zip').send(buff);
        } else {
            res.status(404).end();
        }
    } catch (err) {
        next(err);
    }
});

// Get project output (Revit family)
router.get('/:id/output.rfa', async function (req, res, next) {
    try {
        const buff = await getProjectOutput(req.params.id, 'output.rfa');
        if (buff) {
            res.type('.rfa').send(buff);
        } else {
            res.status(404).end();
        }
    } catch (err) {
        next(err);
    }
});

module.exports = router;
