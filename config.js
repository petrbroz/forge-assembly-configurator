const path = require('path');

const PORT = process.env.PORT || 3000;
const {
    FORGE_CLIENT_ID,
    FORGE_CLIENT_SECRET,
    FORGE_BUCKET,
    FORGE_CALLBACK_URL,
    SERVER_SESSION_SECRET
} = process.env;

if (!FORGE_CLIENT_ID || !FORGE_CLIENT_SECRET || !FORGE_BUCKET || !FORGE_CALLBACK_URL || !SERVER_SESSION_SECRET) {
    console.warn('Some of the environment variables are missing:');
    console.warn('FORGE_CLIENT_ID, FORGE_CLIENT_SECRET, FORGE_BUCKET, FORGE_CALLBACK_URL, SERVER_SESSION_SECRET')
    process.exit(1);
}

module.exports = {
    FORGE_CLIENT_ID,
    FORGE_CLIENT_SECRET,
    FORGE_BUCKET,
    FORGE_CALLBACK_URL,
    SERVER_SESSION_SECRET,
    PORT,
    INVENTOR_PIPELINE: {
        DESCRIPTION: 'App bundle assembling Inventor parts based on a specific layout.',
        ENGINE: 'Autodesk.Inventor+2021', // This is important because we're leveraging the recent RFA output feature!
        APPBUNDLE_NAME: 'InventorAssembler',
        APPBUNDLE_ALIAS: 'prod',
        APPBUNDLE_PATH: path.join(__dirname, 'plugins', 'DesignAutomationForInventor_DesignView2', 'Output', 'DesignAutomationForInventor1Plugin.bundle.zip'),
        ACTIVITY_ID: 'Assemble',
        ACTIVITY_ALIAS: 'prod'
    }
};
