const path = require('path');
const express = require('express');
const multer = require('multer');
const {
    createTemplate,
    listTemplates,
    getTemplate,
    getTemplateSharedAssets,
    getTemplateModuleThumbnail,
    addTemplateModule,
    updateTemplateModule,
    publishTemplate,
    deleteTemplate
} = require('../../shared/templates.js');

let router = express.Router();
let upload = multer({ dest: path.join(__dirname, '..', '..', 'cache', 'uploads') });

router.post('/', upload.single('assets'), async function (req, res, next) {
    try {
        if (!req.body.name || !req.body.author || !req.file) {
            throw new Error('One of the required fields is missing: name, author, assets');
        }
        const template = await createTemplate(req.body.name, req.body.author, req.file.path);
        res.redirect(`/template.html?id=${template.id}`);
    } catch (err) {
        next(err);
    }
});

router.get('/', async function (req, res, next) {
    try {
        const templates = await listTemplates();
        res.json(templates);
    } catch (err) {
        next(err);
    }
});

router.get('/:id', async function (req, res, next) {
    try {
        const template = await getTemplate(req.params.id);
        res.json(template);
    } catch (err) {
        next(err);
    }
});

router.patch('/:id', async function (req, res, next) {
    try {
        const template = await getTemplate(req.params.id);
        //checkOwnerAccess(req, template);
        if (req.body.public) {
            await publishTemplate(template.id);
        }
        res.status(200).end();
    } catch (err) {
        next(err);
    }
});

router.delete('/:id', async function (req, res, next) {
    try {
        await deleteTemplate(req.params.id);
        res.status(200).end();
    } catch (err) {
        next(err);
    }
});

router.get('/:id/assets', async function (req, res, next) {
    try {
        const assets = await getTemplateSharedAssets(req.params.id);
        res.json(assets);
    } catch (err) {
        next(err);
    }
});

router.post('/:id/modules', async function (req, res, next) {
    try {
        const { name, shared_assets_path, connectors, transform } = req.body;
        if (!name || !shared_assets_path || !connectors) {
            throw new Error('One of the required fields is missing: name, asset, connectors');
        }
        const mod = await addTemplateModule(req.params.id, name, shared_assets_path, transform, connectors);
        res.json(mod);
    } catch (err) {
        next(err);
    }
});

router.get('/:id/modules', async function (req, res, next) {
    try {
        const template = await getTemplate(req.params.id);
        res.json(template.modules);
    } catch (err) {
        next(err);
    }
});

router.get('/:id/modules/:module_id', async function (req, res, next) {
    try {
        const template = await getTemplate(req.params.id);
        const mod = template.modules.find(e => e.id === req.params.module_id);
        if (mod) {
            res.json(mod);
        } else {
            res.status(404).end();
        }
    } catch (err) {
        next(err);
    }
});

router.patch('/:id/modules/:module_id', async function (req, res, next) {
    try {
        const { connectors, transform } = req.body;
        const mod = await updateTemplateModule(req.params.id, req.params.module_id, transform, connectors);
        res.json(mod);
    } catch (err) {
        next(err);
    }
});

router.get('/:id/modules/:module_id/thumbnail.png', async function (req, res, next) {
    try {
        const thumbnail = await getTemplateModuleThumbnail(req.params.id, req.params.module_id);
        if (!thumbnail) {
            res.status(404).end();
        } else {
            res.type('.png').send(thumbnail);
        }
    } catch (err) {
        next(err);
    }
});

router.use(function (err, req, res, next) {
    console.error(err.stack);
    res.status(500).send(err.message || err);
});

module.exports = router;
