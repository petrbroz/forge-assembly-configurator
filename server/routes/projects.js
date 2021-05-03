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
} = require('../../shared/projects.js');
const { CACHE_FOLDER, inDebugMode } = require('../../config.js');

let router = express.Router();
let upload = multer({ dest: path.join(CACHE_FOLDER, 'uploads') });

// Check whether a web request has a read access to a project
function hasPublicAccess(req, project) {
    if (inDebugMode()) {
        return true;
    }
    if (project.public) {
        return true;
    }
    if (req.session && req.session.user_id && req.session.user_id === project.author_id) {
        return true;
    }
    return false;
}

// Check whether a web request has a write access to a project
function hasOwnerAccess(req, project) {
    if (inDebugMode()) {
        return true;
    }
    if (req.session && req.session.user_id && req.session.user_id === project.author_id) {
        return true;
    }
    return false;
}

// List existing projects
router.get('/', async function (req, res, next) {
    try {
        const projects = await listProjects();
        // List all projects that are (a) public, or (b) owned by the user
        res.json(projects.filter(project => project.public || (req.session && req.session.user_id && req.session.user_id === project.author_id)));
    } catch (err) {
        next(err);
    }
});

// Create new project
router.post('/', upload.none(), async function (req, res, next) {
    try {
        if (!req.session || !req.session.user_id) {
            throw new Error('Access denied');
        }
        const { name, template_id } = req.body;
        if (!name || !template_id) {
            throw new Error('One of the required fields is missing: name, template_id');
        }
        const project = await createProject(name, req.session.user_name || 'Unnamed', req.session.user_id, template_id);
        res.redirect(`/project.html?id=${project.id}`);
    } catch (err) {
        next(err);
    }
});

// Retrieve project details
router.get('/:id', async function (req, res, next) {
    try {
        const project = await getProject(req.params.id);
        if (!hasPublicAccess(req, project)) {
            throw new Error('Access denied');
        }
        res.json(project);
    } catch (err) {
        next(err);
    }
});

// Remove project
router.delete('/:id', async function (req, res, next) {
    try {
        const project = await getProject(req.params.id);
        if (!hasOwnerAccess(req, project)) {
            throw new Error('Access denied');
        }
        await deleteProject(project.id);
        res.status(200).end();
    } catch (err) {
        next(err);
    }
});

// Build the project
router.post('/:id/build', async function (req, res, next) {
    try {
        const project = await getProject(req.params.id);
        if (!hasOwnerAccess(req, project)) {
            throw new Error('Access denied');
        }
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
        const project = await getProject(req.params.id);
        if (!hasPublicAccess(req, project)) {
            throw new Error('Access denied');
        }
        res.json({ status: project.status, progress: project.progress, urn: project.urn });
    } catch (err) {
        next(err);
    }
});

// Get project logs
router.get('/:id/logs.txt', async function (req, res, next) {
    try {
        const project = await getProject(req.params.id);
        if (!hasPublicAccess(req, project)) {
            throw new Error('Access denied');
        }
        const logs = await getProjectLogs(project.id);
        res.type('.txt').send(logs);
    } catch (err) {
        next(err);
    }
});

// Get project report
router.get('/:id/config.json', async function (req, res, next) {
    try {
        const project = await getProject(req.params.id);
        if (!hasPublicAccess(req, project)) {
            throw new Error('Access denied');
        }
        const buff = await getProjectOutput(project.id, 'config.json');
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
        const project = await getProject(req.params.id);
        if (!hasPublicAccess(req, project)) {
            throw new Error('Access denied');
        }
        const buff = await getProjectOutput(project.id, 'report.txt');
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
        const project = await getProject(req.params.id);
        if (!hasPublicAccess(req, project)) {
            throw new Error('Access denied');
        }
        const buff = await getProjectThumbnail(project.id);
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
        const project = await getProject(req.params.id);
        if (!hasPublicAccess(req, project)) {
            throw new Error('Access denied');
        }
        const buff = await getProjectOutput(project.id, 'output.zip');
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
        const project = await getProject(req.params.id);
        if (!hasPublicAccess(req, project)) {
            throw new Error('Access denied');
        }
        const buff = await getProjectOutput(project.id, 'output.rfa');
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
