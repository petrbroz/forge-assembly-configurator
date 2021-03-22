const path = require('path');
const express = require('express');
const multer = require('multer');
const {
    createTemplate,
    listTemplates,
    getTemplate,
    getTemplateAssets,
    getTemplateEnclosureThumbnail,
    getTemplateModuleThumbnail,
    addTemplateEnclosure,
    addTemplateModule
} = require('../../common/templates.js');

let router = express.Router();
let upload = multer({ dest: path.join(__dirname, '..', '..', 'cache', 'uploads') });

router.post('/', upload.single('assets'), async function (req, res) {
    try {
        if (!req.body.name || !req.body.author || !req.file) {
            throw new Error('One of the required fields is missing: name, author, assets');
        }
        const template = await createTemplate(req.body.name, req.body.author, req.file.path);
        res.redirect(`/templates/${template.id}`);
    } catch (err) {
        res.status(500).send(err);
    }
});

router.get('/', async function (req, res) {
    try {
        const templates = await listTemplates();
        res.render('template-list', { templates });
    } catch (err) {
        res.status(500).send(err);
    }
});

router.get('/:id', async function (req, res) {
    try {
        const template = await getTemplate(req.params.id);
        res.render('template-detail', { template, enclosures: template.enclosures, modules: template.modules });
    } catch (err) {
        res.status(500).send(err);
    }
});

router.get('/:id/assets', async function (req, res) {
    try {
        const assets = await getTemplateAssets(req.params.id);
        res.json(assets);
    } catch (err) {
        res.status(500).send(err);
    }
});

router.post('/:id/enclosures', async function (req, res) {
    try {
        const { name, asset, connectors } = req.body;
        if (!name || !asset || !connectors) {
            throw new Error('One of the required fields is missing: name, asset, connectors');
        }
        const enclosure = await addTemplateEnclosure(req.params.id, name, asset, connectors);
        res.json(enclosure);
    } catch (err) {
        res.status(500).send(err);
    }
});

router.get('/:id/enclosures', async function (req, res) {
    try {
        const template = await getTemplate(req.params.id);
        res.json(template.enclosures);
    } catch (err) {
        res.status(500).send(err);
    }
});

router.get('/:id/enclosures/:enclosure_id', async function (req, res) {
    try {
        const template = await getTemplate(req.params.id);
        const enclosure = template.enclosures.find(e => e.id === req.params.enclosure_id);
        if (enclosure) {
            res.json(enclosure);
        } else {
            res.status(404).end();
        }
    } catch (err) {
        res.status(500).send(err);
    }
});

router.get('/:id/enclosures/:enclosure_id/thumbnail.png', async function (req, res) {
    try {
        const thumbnail = await getTemplateEnclosureThumbnail(req.params.id, req.params.enclosure_id);
        if (!thumbnail) {
            res.status(404).end();
        } else {
            res.type('.png').send(thumbnail);
        }
    } catch (err) {
        res.status(500).send(err);
    }
});

router.post('/:id/modules', async function (req, res) {
    try {
        const { name, asset, connectors } = req.body;
        if (!name || !asset || !connectors) {
            throw new Error('One of the required fields is missing: name, asset, connectors');
        }
        const mod = await addTemplateModule(req.params.id, name, asset, connectors);
        res.json(mod);
    } catch (err) {
        res.status(500).send(err);
    }
});

router.get('/:id/modules', async function (req, res) {
    try {
        const template = await getTemplate(req.params.id);
        res.json(template.modules);
    } catch (err) {
        res.status(500).send(err);
    }
});

router.get('/:id/modules/:module_id', async function (req, res) {
    try {
        const template = await getTemplate(req.params.id);
        const mod = template.modules.find(e => e.id === req.params.module_id);
        if (mod) {
            res.json(mod);
        } else {
            res.status(404).end();
        }
    } catch (err) {
        res.status(500).send(err);
    }
});

router.get('/:id/modules/:module_id/thumbnail.png', async function (req, res) {
    try {
        const thumbnail = await getTemplateModuleThumbnail(req.params.id, req.params.module_id);
        if (!thumbnail) {
            res.status(404).end();
        } else {
            res.type('.png').send(thumbnail);
        }
    } catch (err) {
        res.status(500).send(err);
    }
});


module.exports = router;
