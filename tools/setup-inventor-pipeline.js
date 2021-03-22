const fs = require('fs-extra');
const { FORGE_CLIENT_ID, FORGE_CLIENT_SECRET, INVENTOR_PIPELINE } = require('../config.js');
const { APPBUNDLE_NAME, APPBUNDLE_ALIAS, APPBUNDLE_PATH, ACTIVITY_ID, ACTIVITY_ALIAS, ENGINE, DESCRIPTION } = INVENTOR_PIPELINE;
const { DesignAutomationClient, DesignAutomationID } = require('forge-server-utils');

const FullAppBundleID = new DesignAutomationID(FORGE_CLIENT_ID, APPBUNDLE_NAME, APPBUNDLE_ALIAS).toString();
const ActivityCommands = [`$(engine.path)\\InventorCoreConsole.exe /al "$(appbundles[${APPBUNDLE_NAME}].path)" "$(args[configJson].path)" "$(args[templateArchive].path)"`];
const ActivityParams = {
    configJson: {
        verb: 'get',
        zip: false,
        required: true,
        localName: 'config.json',
        description: 'JSON file describing which assemblies/parts from the template archive go where.'
    },
    templateArchive: {
        verb: 'get',
        zip: true,
        required: true,
        localName: 'template',
        description: 'Archive containing various assemblies/parts that can be included in the newly configured project.'
    },
    outputZip: {
        verb: 'put',
        zip: false,
        localName: 'output.zip'
    },
    outputRfa: {
        verb: 'put',
        zip: false,
        localName: 'output.rfa'
    }
};

async function setup() {
    const designAutomationClient = new DesignAutomationClient({ client_id: FORGE_CLIENT_ID, client_secret: FORGE_CLIENT_SECRET });

    try {
        // Create/update app bundle
        console.log('Creating/updating app bundle...');
        const appBundleIDs = await designAutomationClient.listAppBundles();
        let appBundleExists = false;
        for (const appBundleID of appBundleIDs) {
            if (DesignAutomationID.parse(appBundleID).id === APPBUNDLE_NAME) {
                appBundleExists = true;
            }
        }
        let appBundle = null;
        if (appBundleExists) {
            appBundle = await designAutomationClient.updateAppBundle(APPBUNDLE_NAME, ENGINE, {}, DESCRIPTION);
        } else {
            appBundle = await designAutomationClient.createAppBundle(APPBUNDLE_NAME, ENGINE, {}, DESCRIPTION);
        }
        console.log('Uploading app bundle binaries...');
        await designAutomationClient.uploadAppBundleArchive(appBundle, fs.createReadStream(APPBUNDLE_PATH));

        // Create/update app bundle alias
        console.log('Creating/updating app bundle alias...');
        const appBundleAliases = await designAutomationClient.listAppBundleAliases(APPBUNDLE_NAME);
        let appBundleAliasExists = false;
        for (const appBundleAlias of appBundleAliases) {
            if (appBundleAlias.id === APPBUNDLE_ALIAS) {
                appBundleAliasExists = true;
            }
        }
        let appBundleAlias = null;
        if (appBundleAliasExists) {
            appBundleAlias = await designAutomationClient.updateAppBundleAlias(APPBUNDLE_NAME, APPBUNDLE_ALIAS, appBundle.version);
        } else {
            appBundleAlias = await designAutomationClient.createAppBundleAlias(APPBUNDLE_NAME, APPBUNDLE_ALIAS, appBundle.version);
        }

        // Create/update activity
        console.log('Creating/updating activity...');
        const activityIDs = await designAutomationClient.listActivities();
        let activityExists = false;
        for (const activityID of activityIDs) {
            if (DesignAutomationID.parse(activityID).id === ACTIVITY_ID) {
                activityExists = true;
            }
        }
        let activity = null;
        if (activityExists) {
            activity = await designAutomationClient.updateActivity(ACTIVITY_ID, ENGINE, ActivityCommands, FullAppBundleID, ActivityParams, null, DESCRIPTION); 
        } else {
            activity = await designAutomationClient.createActivity(ACTIVITY_ID, ENGINE, ActivityCommands, FullAppBundleID, ActivityParams, null, DESCRIPTION); 
        }

        // Create/update activity alias
        console.log('Creating/updating activity alias...');
        const activityAliases = await designAutomationClient.listActivityAliases(ACTIVITY_ID);
        let activityAliasExists = false;
        for (const activityAlias of activityAliases) {
            if (activityAlias.id === ACTIVITY_ALIAS) {
                activityAliasExists = true;
            }
        }
        let activityAlias = null;
        if (activityAliasExists) {
            activityAlias = await designAutomationClient.updateActivityAlias(ACTIVITY_ID, ACTIVITY_ALIAS, activity.version);
        } else {
            activityAlias = await designAutomationClient.createActivityAlias(ACTIVITY_ID, ACTIVITY_ALIAS, activity.version);
        }
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
    console.log('Inventor pipeline setup completed!');
}

setup();
