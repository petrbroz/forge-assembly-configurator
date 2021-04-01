const path = require('path');

const PORT = process.env.PORT || 3000;
const { FORGE_CLIENT_ID, FORGE_CLIENT_SECRET, FORGE_BUCKET } = process.env;
if (!FORGE_CLIENT_ID || !FORGE_CLIENT_SECRET || !FORGE_BUCKET) {
    console.warn('Missing environment variables FORGE_CLIENT_ID, FORGE_CLIENT_SECRET, or FORGE_BUCKET.');
    process.exit(1);
}

module.exports = {
    FORGE_CLIENT_ID,
    FORGE_CLIENT_SECRET,
    FORGE_BUCKET,
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
