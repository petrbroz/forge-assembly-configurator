const fs = require('fs-extra');
const path = require('path');
const { v4: uuid } = require('uuid');
const AdmZip = require('adm-zip');
const { DataManagementClient, ModelDerivativeClient, urnify, ThumbnailSize } = require('forge-server-utils');
const { FORGE_CLIENT_ID, FORGE_CLIENT_SECRET, FORGE_BUCKET, CACHE_FOLDER } = require('../config.js');

/*

_Template_ represents a collection of 3D modules with custom snapping points
that can be used to create different configurations by instantiating and snapping
these modules together.

In this implementation, templates are defined in JSON files stored in an OSS bucket
in the Forge Data Management service. The JSON looks like this:

{
    "id": <string>,                 // UUID for uniquely identifying the template
    "name": <string>,               // Display name
    "author": <string>,             // Template author name
    "created": <string>,            // Created date
    "public": <bolean>,             // Whether or not the template has been published (only public templates can be used to create new configurations),
    "shared_assets": <string>,      // Name of ZIP file uploaded to Forge that contains shared 3D assets (which can be referenced by different modules below)
    "modules": [                    // List of modules with their snapping points
        {
            "id": <string>,                 // UUID for uniquely identifying the module
            "name": <string>,               // Display name
            "shared_assets_path": <string>, // Path to one of the 3D assets in the shared ZIP file defined at the template level
            "urn": <string>,                // URN of this module in the Forge Model Derivative service
            "transform": <number[]>,        // Optional 4x4 transform placing the module to a frame where the (0,0,0) origin will be used for snapping to other modules
            "connectors": [
                {
                    "transform": <number[]>,        // 4x4 transform to apply to any moduel snapped to this connector
                    "grid": {                       // Optional definition of a grid of snapping points
                        "repeat": <number[]>,       // Array of 3 values representing the number of snapping points to replicate in X, Y, and Z direction
                        "offset": <number[]>        // Array of 3 values representing the offsets between snapping points in X, Y, and Z direction
                    }
                },
                ...
            ]
        },
        ...
    ]
}

*/

const CacheFolder = path.join(CACHE_FOLDER, 'templates');
if (!fs.existsSync(CacheFolder)) {
    console.log('Creating a template cache folder', CacheFolder);
    fs.mkdirSync(CacheFolder);
}

let dataManagementClient = new DataManagementClient({ client_id: FORGE_CLIENT_ID, client_secret: FORGE_CLIENT_SECRET });
let modelDerivativeClient = new ModelDerivativeClient({ client_id: FORGE_CLIENT_ID, client_secret: FORGE_CLIENT_SECRET });

async function createTemplate(name, authorName, authorId, sharedAssetsFilename) {
    const id = uuid();
    fs.ensureDirSync(path.join(CacheFolder, id));
    const template = {
        id,
        name,
        author: authorName,
        author_id: authorId,
        created: new Date(),
        public: false,
        modules: []
    };
    if (sharedAssetsFilename) {
        const sharedAssetsObject = await dataManagementClient.uploadObjectStream(FORGE_BUCKET, `templates/${id}/assets.zip`, 'application/octet-stream', fs.createReadStream(sharedAssetsFilename));
        template.shared_assets = sharedAssetsObject.objectKey;
    }
    await dataManagementClient.uploadObject(FORGE_BUCKET, `templates/${id}/template.json`, 'application/json', JSON.stringify(template));
    return template;
}

async function getTemplate(id) {
    const templateCachePath = path.join(CacheFolder, id, 'template.json');
    if (!fs.existsSync(templateCachePath)) {
        const buff = await dataManagementClient.downloadObject(FORGE_BUCKET, `templates/${id}/template.json`);
        const template = JSON.parse(buff.toString());
        // Only cache the JSON when the template has already been published
        if (template.public) {
            fs.ensureDirSync(path.join(CacheFolder, id));
            fs.writeFileSync(templateCachePath, buff);
        }
        return template;
    } else {
        return fs.readJsonSync(templateCachePath);
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

async function getTemplateSharedAssets(id) {
    const assetsCachePath = path.join(CacheFolder, id, 'assets.zip');
    if (!fs.existsSync(assetsCachePath)) {
        const buff = await dataManagementClient.downloadObject(FORGE_BUCKET, `templates/${id}/assets.zip`);
        fs.writeFileSync(assetsCachePath, buff);
    }
    const entries = new AdmZip(assetsCachePath).getEntries();
    return entries.map(entry => entry.entryName).filter(entry => !entry.startsWith('__MACOSX'));
}

async function addTemplateModule(id, name, sharedAssetsPath, transform, connectors) {
    const template = await getTemplate(id);
    if (!template) {
        throw new Error('Template does not exist.')
    }
    if (template.public) {
        throw new Error('Template has been published and cannot be modified anymore.');
    }

    const assetsCopy = await dataManagementClient.copyObject(FORGE_BUCKET, `templates/${id}/assets.zip`, `templates/${id}/assets.zip?${sharedAssetsPath}`);
    const module = {
        id: uuid(),
        name,
        shared_assets_path: sharedAssetsPath,
        urn: urnify(assetsCopy.objectId),
        transform,
        connectors
    };
    modelDerivativeClient.submitJob(module.urn, [{ type: 'svf', views: ['3d'] }], sharedAssetsPath);

    template.modules.push(module);
    await dataManagementClient.uploadObject(FORGE_BUCKET, `templates/${id}/template.json`, 'application/json', JSON.stringify(template));

    return module;
}

async function updateTemplateModule(templateId, moduleId, transform, connectors) {
    const template = await getTemplate(templateId);
    if (!template) {
        throw new Error('Template does not exist.')
    }
    if (template.public) {
        throw new Error('Template has been published and cannot be modified anymore.');
    }
    const _module = template.modules.find(e => e.id === moduleId);
    if (!_module) {
        throw new Error('Module does not exist.');
    }
    if (transform) {
        _module.transform = transform;
    }
    if (connectors) {
        _module.connectors = connectors;
    }
    await dataManagementClient.uploadObject(FORGE_BUCKET, `templates/${templateId}/template.json`, 'application/json', JSON.stringify(template));
    return _module;
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
    getTemplateSharedAssets,
    getTemplateModuleThumbnail,
    listTemplates,
    deleteTemplate,
    addTemplateModule,
    updateTemplateModule,
    publishTemplate
};
