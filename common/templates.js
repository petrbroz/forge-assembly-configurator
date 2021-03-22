const fs = require('fs-extra');
const path = require('path');
const { v4: uuid } = require('uuid');
const AdmZip = require('adm-zip');
const { DataManagementClient, ModelDerivativeClient, urnify, ThumbnailSize } = require('forge-server-utils');
const { FORGE_CLIENT_ID, FORGE_CLIENT_SECRET, FORGE_BUCKET } = require('../config.js');

const CacheFolder = path.join(__dirname, '..', 'cache', 'templates');
fs.ensureDirSync(CacheFolder);

let dataManagementClient = new DataManagementClient({ client_id: FORGE_CLIENT_ID, client_secret: FORGE_CLIENT_SECRET });
let modelDerivativeClient = new ModelDerivativeClient({ client_id: FORGE_CLIENT_ID, client_secret: FORGE_CLIENT_SECRET });

async function createTemplate(name, author, assetsPath) {
    const id = uuid();
    fs.ensureDirSync(path.join(CacheFolder, id));
    const template = {
        id,
        name,
        author,
        created: new Date(),
        public: false,
        enclosures: [],
        modules: []
    };
    await dataManagementClient.uploadObject(FORGE_BUCKET, `templates/${id}/template.json`, 'application/json', JSON.stringify(template));
    await dataManagementClient.uploadObjectStream(FORGE_BUCKET, `templates/${id}/assets.zip`, 'application/octet-stream', fs.createReadStream(assetsPath));
    return template;
}

async function getTemplate(id) {
    const templateCachePath = path.join(CacheFolder, id, 'template.json');
    if (!fs.existsSync(templateCachePath)) {
        const buff = await dataManagementClient.downloadObject(FORGE_BUCKET, `templates/${id}/template.json`);
        const template = JSON.parse(buff.toString());
        // Only cache the JSON when the template has already been published
        if (template.public) {
            fs.writeFileSync(templateCachePath, buff);
        }
        return template;
    } else {
        return fs.readJsonSync(templateCachePath);
    }
}

async function getTemplateAssets(id) {
    const assetsCachePath = path.join(CacheFolder, id, 'assets.zip');
    if (!fs.existsSync(assetsCachePath)) {
        const buff = await dataManagementClient.downloadObject(FORGE_BUCKET, `templates/${id}/assets.zip`);
        fs.writeFileSync(assetsCachePath, buff);
    }
    const entries = new AdmZip(assetsCachePath).getEntries();
    return entries.map(entry => entry.entryName).filter(entry => !entry.startsWith('__MACOSX'));
}

async function getTemplateEnclosureThumbnail(templateId, enclosureId) {
    const thumbnailCachePath = path.join(CacheFolder, templateId, `enclosure.${enclosureId}.png`);
    if (!fs.existsSync(thumbnailCachePath)) {
        const template = await getTemplate(templateId);
        if (!template) {
            return null;
        }
        const enclosure = template.enclosures.find(e => e.id === enclosureId);
        if (!enclosure || !enclosure.urn) {
            return null;
        }
        const buff = await modelDerivativeClient.getThumbnail(enclosure.urn, ThumbnailSize.Medium);
        // Only cache the thumbnail when the template has already been published
        if (template.public) {
            fs.writeFileSync(thumbnailCachePath, buff);
        }
        return buff;
    } else {
        return fs.readFileSync(thumbnailCachePath);
    }
}

async function getTemplateModuleThumbnail(templateId, moduleId) {
    const thumbnailCachePath = path.join(CacheFolder, templateId, `module.${moduleId}.png`);
    if (!fs.existsSync(thumbnailCachePath)) {
        const template = await getTemplate(templateId);
        if (!template) {
            return null;
        }
        const module = template.modules.find(e => e.id === moduleId);
        if (!module || !module.urn) {
            return null;
        }
        const buff = await modelDerivativeClient.getThumbnail(module.urn, ThumbnailSize.Medium);
        // Only cache the thumbnail when the template has already been published
        if (template.public) {
            fs.writeFileSync(thumbnailCachePath, buff);
        }
        return buff;
    } else {
        return fs.readFileSync(thumbnailCachePath);
    }
}

async function listTemplates() {
    let templates = [];
    const items = await dataManagementClient.listObjects(FORGE_BUCKET, 'templates/');
    for (const item of items) {
        if (item.objectKey.match(/^templates\/[a-z0-9]{8}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{12}\/template\.json$/)) {
            templates.push(getTemplate(item.objectKey.split('/')[1]));
        }
    }
    return Promise.all(templates);
}

async function deleteTemplate(id) {
    const objects = await dataManagementClient.listObjects(FORGE_BUCKET, `templates/${id}`);
    const deletes = objects.map(obj => dataManagementClient.deleteObject(FORGE_BUCKET, obj.objectKey));
    await Promise.all(deletes);
    const cachePath = path.join(CacheFolder, id);
    if (fs.existsSync(cachePath)) {
        fs.rmSync(cachePath, { force: true, recursive: true });
    }
}

async function addTemplateEnclosure(id, name, assetPath, connectors) {
    const template = await getTemplate(id);
    if (!template) {
        throw new Error('Template does not exist.')
    }
    if (template.public) {
        throw new Error('Template has been published and cannot be modified anymore.');
    }

    const assetsCopy = await dataManagementClient.copyObject(FORGE_BUCKET, `templates/${id}/assets.zip`, `templates/${id}/assets.zip?${assetPath}`);
    const enclosure = { id: uuid(), name, asset_path: assetPath, connectors, urn: urnify(assetsCopy.objectId) };
    modelDerivativeClient.submitJob(enclosure.urn, [{ type: 'svf', views: ['3d'] }], assetPath);

    template.enclosures.push(enclosure);
    await dataManagementClient.uploadObject(FORGE_BUCKET, `templates/${id}/template.json`, 'application/json', JSON.stringify(template));

    return enclosure;
}

async function addTemplateModule(id, name, assetPath, connector) {
    const template = await getTemplate(id);
    if (!template) {
        throw new Error('Template does not exist.')
    }
    if (template.public) {
        throw new Error('Template has been published and cannot be modified anymore.');
    }

    const assetsCopy = await dataManagementClient.copyObject(FORGE_BUCKET, `templates/${id}/assets.zip`, `templates/${id}/assets.zip?${assetPath}`);
    const module = { id: uuid(), name, asset_path: assetPath, connector, urn: urnify(assetsCopy.objectId) };
    modelDerivativeClient.submitJob(module.urn, [{ type: 'svf', views: ['3d'] }], assetPath);

    template.modules.push(module);
    await dataManagementClient.uploadObject(FORGE_BUCKET, `templates/${id}/template.json`, 'application/json', JSON.stringify(template));

    return module;
}

async function publishTemplate(id) {
    const template = await getTemplate(id);
    if (!template) {
        throw new Error('Template does not exist.')
    }
    if (template.public) {
        throw new Error('Template has been published and cannot be modified anymore.');
    }
    template.public = true;
    const templateCachePath = path.join(CacheFolder, id, 'template.json');
    fs.writeJsonSync(templateCachePath, template);
    await dataManagementClient.uploadObjectStream(FORGE_BUCKET, `templates/${id}/template.json`, 'application/json', fs.createReadStream(templateCachePath));
}

module.exports = {
    createTemplate,
    getTemplate,
    getTemplateAssets,
    getTemplateEnclosureThumbnail,
    getTemplateModuleThumbnail,
    listTemplates,
    deleteTemplate,
    addTemplateEnclosure,
    addTemplateModule,
    publishTemplate
};
