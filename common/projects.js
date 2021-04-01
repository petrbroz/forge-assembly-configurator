const path = require('path');
const fs = require('fs-extra');
const { v4: uuid } = require('uuid');
const fetch = require('node-fetch');
const { DataManagementClient, DesignAutomationClient, DesignAutomationID, ModelDerivativeClient, urnify, ThumbnailSize } = require('forge-server-utils');
const { FORGE_CLIENT_ID, FORGE_CLIENT_SECRET, FORGE_BUCKET, INVENTOR_PIPELINE } = require('../config.js');
const { getTemplate } = require('./templates.js');

const FullActivityID = new DesignAutomationID(FORGE_CLIENT_ID, INVENTOR_PIPELINE.ACTIVITY_ID, INVENTOR_PIPELINE.ACTIVITY_ALIAS).toString();
const CacheFolder = path.join(__dirname, '..', 'cache', 'projects');
fs.ensureDirSync(CacheFolder);

const dataManagementClient = new DataManagementClient({ client_id: FORGE_CLIENT_ID, client_secret: FORGE_CLIENT_SECRET });
const modelDerivativeClient = new ModelDerivativeClient({ client_id: FORGE_CLIENT_ID, client_secret: FORGE_CLIENT_SECRET });
const designAutomationClient = new DesignAutomationClient({ client_id: FORGE_CLIENT_ID, client_secret: FORGE_CLIENT_SECRET });

async function createProject(name, author, templateId) {
    const id = uuid();
    fs.ensureDirSync(path.join(CacheFolder, id));
    const project = {
        id,
        name,
        author,
        created: new Date(),
        template_id: templateId,
        public: false,
        status: null,
        progress: 0,
        urn: null
    };
    await dataManagementClient.uploadObject(FORGE_BUCKET, `projects/${id}/project.json`, 'application/json', JSON.stringify(project));
    return project;
}

async function getProject(id) {
    const projectCachePath = path.join(CacheFolder, id, 'project.json');
    if (!fs.existsSync(projectCachePath)) {
        const buff = await dataManagementClient.downloadObject(FORGE_BUCKET, `projects/${id}/project.json`);
        const project = JSON.parse(buff.toString());
        // Only cache the JSON when the project has already been published
        if (project.public) {
            fs.ensureDirSync(path.dirname(projectCachePath));
            fs.writeFileSync(projectCachePath, buff);
        }
        return project;
    } else {
        return fs.readJsonSync(projectCachePath);
    }
}

async function updateProject(id, callback) {
    let project = await getProject(id);
    if (project.public) {
        throw new Error('Project has been published and cannot be modified anymore.');
    }
    callback(project);
    await dataManagementClient.uploadObject(FORGE_BUCKET, `projects/${id}/project.json`, 'application/json', JSON.stringify(project));
    return project;
}

async function deleteProject(id) {
    const objects = await dataManagementClient.listObjects(FORGE_BUCKET, `projects/${id}`);
    const deletes = objects.map(obj => dataManagementClient.deleteObject(FORGE_BUCKET, obj.objectKey));
    await Promise.all(deletes);
    const cachePath = path.join(CacheFolder, id);
    if (fs.existsSync(cachePath)) {
        fs.rmSync(cachePath, { force: true, recursive: true });
    }
}

async function getProjectLogs(id) {
    const project = await getProject(id);
    const logsCachePath = path.join(CacheFolder, id, 'logs.txt');
    if (!fs.existsSync(logsCachePath)) {
        const buff = await dataManagementClient.downloadObject(FORGE_BUCKET, `projects/${id}/logs.txt`);
        // Cache the logs only if the build has already completed
        if (project.status === 'finished' || project.status === 'failed') {
            fs.ensureDirSync(path.dirname(logsCachePath));
            fs.writeFileSync(logsCachePath, buff);
        }
        return buff.toString();
    }
    const buff = fs.readFileSync(logsCachePath);
    return buff.toString();
}

async function addProjectLogs(id, message) {
    const project = await getProject(id);
    if (project.public) {
        throw new Error('Project has been published and cannot be modified anymore.');
    }
    // Unfortunately the only way to append the logs today is to download, extend, and re-upload...
    let buff;
    try {
        buff = await dataManagementClient.downloadObject(FORGE_BUCKET, `projects/${id}/logs.txt`);
    } catch (err) {
        buff = '';
    }
    buff = buff.toString() + `[${new Date().toISOString()}] ${message}\n`;
    await dataManagementClient.uploadObject(FORGE_BUCKET, `projects/${id}/logs.txt`, 'plain/text', buff);
}

async function listProjects() {
    let projects = [];
    const items = await dataManagementClient.listObjects(FORGE_BUCKET, 'projects/');
    for (const item of items) {
        if (item.objectKey.match(/^projects\/[a-z0-9]{8}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{12}\/project\.json$/)) {
            projects.push(getProject(item.objectKey.split('/')[1]));
        }
    }
    return Promise.all(projects);
}

async function getProjectThumbnail(id) {
    const project = await getProject(id);
    if (!project.urn) {
        return null;
    }
    const thumbnailCachePath = path.join(CacheFolder, id, 'thumbnail.png');
    if (!fs.existsSync(thumbnailCachePath)) {
        const buff = await modelDerivativeClient.getThumbnail(project.urn, ThumbnailSize.Medium);
        fs.ensureDirSync(path.dirname(thumbnailCachePath));
        fs.writeFileSync(thumbnailCachePath, buff);
        return buff;
    } else {
        return fs.readFileSync(thumbnailCachePath);
    }
}

async function getProjectOutput(id, name) {
    const project = await getProject(id);
    if (!project.urn) {
        return null;
    }
    const outputCachePath = path.join(CacheFolder, id, name);
    if (!fs.existsSync(outputCachePath)) {
        const buff = await dataManagementClient.downloadObject(FORGE_BUCKET, `projects/${id}/${name}`);
        fs.ensureDirSync(path.dirname(outputCachePath));
        fs.writeFileSync(outputCachePath, buff);
        return buff;
    } else {
        return fs.readFileSync(outputCachePath);
    }
}

async function buildProject(id, config) {
    const log = async (message) => {
        await addProjectLogs(id, message)
        console.log(message);
    };
    const status = async (status, progress, urn) => {
        await updateProject(id, project => {
            if (status !== undefined) {
                project.status = status;
            }
            if (progress !== undefined) {
                project.progress = progress;
            }
            if (urn !== undefined) {
                project.urn = urn;
            }
        });
    };
    const wait = (ms) => new Promise(function (resolve, reject) {
        setTimeout(resolve, ms);
    });

    const project = await getProject(id);
    const template = await getTemplate(project.template_id);
    if (!template) {
        await status('failed', 0);
        await log(`Template not found: ${project.template_id}`);
    }

    try {
        await log('Starting Inventor pipeline');

        // Upload config JSON
        await log(`Uploading configuration file`);
        const configJsonObject = await dataManagementClient.uploadObject(FORGE_BUCKET, `projects/${id}/config.json`, 'application/json', JSON.stringify(config));
        await status('inprogress', 10);

        // Preparing ZIP file with template assets
        await log(`Preparing template assets`);
        const assetsZipObject = await dataManagementClient.getObjectDetails(FORGE_BUCKET, `templates/${project.template_id}/assets.zip`);
        await status('inprogress', 20);

        // Generate signed urls for input and output files in DM
        await log('Generating signed urls for input and output files');
        const assetsZipSignedUrl = await dataManagementClient.createSignedUrl(FORGE_BUCKET, assetsZipObject.objectKey, 'read');
        const configJsonSignedUrl = await dataManagementClient.createSignedUrl(FORGE_BUCKET, configJsonObject.objectKey, 'read');
        const outputZipSignedUrl = await dataManagementClient.createSignedUrl(FORGE_BUCKET, `projects/${id}/output.zip`, 'readwrite');
        const outputRfaSignedUrl = await dataManagementClient.createSignedUrl(FORGE_BUCKET, `projects/${id}/output.rfa`, 'readwrite');
        await status('inprogress', 30);

        // Create a work item
        await log('Creating a work item');
        const args = {
            templateArchive: {
                url: assetsZipSignedUrl.signedUrl,
                zip: true,
                localName: 'template'
            },
            configJson: {
                url: configJsonSignedUrl.signedUrl,
                zip: false,
                localName: 'config.json'
            },
            outputZip: {
                url: outputZipSignedUrl.signedUrl,
                verb: 'put'
            },
            outputRfa: {
                url: outputRfaSignedUrl.signedUrl,
                verb: 'put'
            }
        };
        const job = await designAutomationClient.createWorkItem(FullActivityID, args);
        await log('Job started: ' + JSON.stringify(job));
        await status('inprogress', 40);

        // Get work item status
        await log('Waiting for work item to complete');
        let workItem = await designAutomationClient.getWorkItem(job.id);
        while (workItem.status === 'pending' || workItem.status === 'inprogress') {
            await log('Job still running ...');
            await wait(5000);
            workItem = await designAutomationClient.getWorkItem(job.id);
        }
        const resp = await fetch(workItem.reportUrl);
        const report = await resp.text();
        await dataManagementClient.uploadObject(FORGE_BUCKET, `projects/${id}/report.txt`, 'plain/text', report);
        if (workItem.status === 'success') {
            await log('Job finished successfully: ' + JSON.stringify(workItem));
        } else {
            await log('Job failed: ' + JSON.stringify(workItem));
            return;
        }
        await status('inprogress', 50);

        // Download the outputs
        await log('Downloading results');
        let outputResponse = await fetch(outputZipSignedUrl.signedUrl);
        fs.writeFileSync(path.join(CacheFolder, id, 'output.zip'), await outputResponse.buffer());
        outputResponse = await fetch(outputRfaSignedUrl.signedUrl);
        fs.writeFileSync(path.join(CacheFolder, id, 'output.rfa'), await outputResponse.buffer());
        await status('inprogress', 60);

        // Translate the output for viewing
        await log('Converting results for viewing');
        const outputZipObject = await dataManagementClient.getObjectDetails(FORGE_BUCKET, `projects/${id}/output.zip`);
        const urn = urnify(outputZipObject.objectId);
        const translation = await modelDerivativeClient.submitJob(urn, [{ type: 'svf', views: ['2d', '3d'] }], 'template.iam', true);
        await log(JSON.stringify(translation));
        let manifest = await modelDerivativeClient.getManifest(urn);
        while (manifest.status === 'pending' || manifest.status === 'inprogress') {
            await log('Conversion running ...');
            await wait(5000);
            manifest = await modelDerivativeClient.getManifest(urn);
        }
        await log('Manifest status: ' + manifest.status);
        await status('inprogress', 80);

        await log('Inventor pipeline completed');
        await status('finished', 100, urn);
    } catch (err) {
        await status('failed', 100);
        await log(err);
    } finally {
        await updateProject(id, project => {
            project.public = true;
        });
    }
}

module.exports = {
    createProject,
    updateProject,
    deleteProject,
    getProject,
    listProjects,
    getProjectLogs,
    getProjectThumbnail,
    getProjectOutput,
    buildProject
};
