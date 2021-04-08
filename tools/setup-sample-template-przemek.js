const path = require('path');
const { createTemplate, getTemplateSharedAssets, addTemplateModule, publishTemplate } = require('../shared/templates.js');

async function run() {
    const name = 'Basic Template';
    const author = 'Przemyslaw Sokolowski';
    const sharedAssetsFilename = path.join(__dirname, 'templates', 'przemek', 'assets.zip');

    // Create new template
    console.log('Creating new template...');
    const template = await createTemplate(name, author, sharedAssetsFilename);
    console.log(template);
    const assets = await getTemplateSharedAssets(template.id);
    console.log('Available assets', assets);

    // Add couple of enclosures
    console.log('Adding enclosures...');
    const enclosure1 = await addTemplateModule(template.id, 'Covered Enclosure', 'Workspaces/Workspace/For Shakeel/Electrical Enclosure - Forge.iam', null, [
        {
            transform: [
                1, 0, 0, -32.5,
                0, 1, 0, 44.1,
                0, 0, 1, 19.3,
                0, 0, 0, 1
            ],
            grid: { repeat: [1, 1, 1], offset: [0, 0, 0] } // optional property if this is a uniform grid of snapping points
        },
        {
            transform: [
                1, 0, 0, -30.0,
                0, 1, 0, 44.1,
                0, 0, 1, 19.3,
                0, 0, 0, 1
            ],
            grid: { repeat: [1, 1, 1], offset: [0, 0, 0] } // optional property if this is a uniform grid of snapping points
        },
        {
            transform: [
                1, 0, 0, -27.5,
                0, 1, 0, 44.1,
                0, 0, 1, 19.3,
                0, 0, 0, 1
            ],
            grid: { repeat: [1, 1, 1], offset: [0, 0, 0] } // optional property if this is a uniform grid of snapping points
        },
        {
            transform: [
                1, 0, 0, -25.0,
                0, 1, 0, 44.1,
                0, 0, 1, 19.3,
                0, 0, 0, 1
            ],
            grid: { repeat: [1, 1, 1], offset: [0, 0, 0] } // optional property if this is a uniform grid of snapping points
        }
    ]);
    console.log(enclosure1);
    const enclosure2 = await addTemplateModule(template.id, 'Open Enclosure', 'Workspaces/Workspace/For Shakeel/Electrical Enclosure - Forge 2.iam', null, [
        {
            transform: [
                1, 0, 0, -32.5,
                0, 1, 0, 44.1,
                0, 0, 1, 19.3,
                0, 0, 0, 1
            ],
            grid: { repeat: [1, 1, 1], offset: [0, 0, 0] } // optional property if this is a uniform grid of snapping points
        },
        {
            transform: [
                1, 0, 0, -30.0,
                0, 1, 0, 44.1,
                0, 0, 1, 19.3,
                0, 0, 0, 1
            ],
            grid: { repeat: [1, 1, 1], offset: [0, 0, 0] } // optional property if this is a uniform grid of snapping points
        },
        {
            transform: [
                1, 0, 0, -27.5,
                0, 1, 0, 44.1,
                0, 0, 1, 19.3,
                0, 0, 0, 1
            ],
            grid: { repeat: [1, 1, 1], offset: [0, 0, 0] } // optional property if this is a uniform grid of snapping points
        },
        {
            transform: [
                1, 0, 0, -25.0,
                0, 1, 0, 44.1,
                0, 0, 1, 19.3,
                0, 0, 0, 1
            ],
            grid: { repeat: [1, 1, 1], offset: [0, 0, 0] } // optional property if this is a uniform grid of snapping points
        }
    ]);
    console.log(enclosure2);

    // Add couple of modules
    console.log('Adding modules...');
    const eb = await addTemplateModule(template.id, 'End Bracket', 'Workspaces/Workspace/For Shakeel/Lib/End bracket.ipt', null, []);
    console.log(eb);
    const cb2 = await addTemplateModule(template.id, 'Circuit Breaker 2', 'Workspaces/Workspace/For Shakeel/Lib/Circuit breaker-2.ipt', null, []);
    console.log(cb2);
    const cb3 = await addTemplateModule(template.id, 'Circuit Breaker 3', 'Workspaces/Workspace/For Shakeel/Lib/Circuit breaker-3.ipt', null, []);
    console.log(cb3);

    console.log('Publishing template...');
    await publishTemplate(template.id);
}

run()
    .then(() => console.log('Template has been installed.'))
    .catch((err) => console.error(err));