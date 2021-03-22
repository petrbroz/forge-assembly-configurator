const path = require('path');
const { createTemplate, getTemplateAssets, addTemplateEnclosure, addTemplateModule, publishTemplate } = require('../common/templates.js');

async function run() {
    const name = 'Basic Template';
    const author = 'Przemyslaw Sokolowski';
    const assetsArchive = path.join(__dirname, 'templates', 'przemek', 'assets.zip');

    // Create new template
    console.log('Creating new template...');
    const template = await createTemplate(name, author, assetsArchive);
    console.log(template);
    const assets = await getTemplateAssets(template.id);
    console.log('Available assets', assets);

    // Add new enclosure
    console.log('Creating new enclosures...');
    const enclosure1 = await addTemplateEnclosure(template.id, 'Covered Enclosure', 'Workspaces/Workspace/For Shakeel/Electrical Enclosure - Forge.iam', {
        // For now, only specifying the snapping position, later might add orientation, or full 4x4 affine xform
        snap0: [ -32.5, 44.1, 19.3 ],
        snap1: [ -30.0, 44.1, 19.3 ],
        snap2: [ -27.5, 44.1, 19.3 ],
        snap3: [ -25.0, 44.1, 19.3 ],
        snap4: [ -22.5, 44.1, 19.3 ],
        snap5: [ -20.0, 44.1, 19.3 ],
        snap6: [ -17.5, 44.1, 19.3 ],
        snap7: [ -15.0, 44.1, 19.3 ]
    });
    console.log(enclosure1);
    const enclosure2 = await addTemplateEnclosure(template.id, 'Open Enclosure', 'Workspaces/Workspace/For Shakeel/Electrical Enclosure - Forge 2.iam', {
        // For now, only specifying the snapping position, later might add orientation, or full 4x4 affine xform
        snap0: [ -32.5, 44.1, 19.3 ],
        snap1: [ -30.0, 44.1, 19.3 ],
        snap2: [ -27.5, 44.1, 19.3 ],
        snap3: [ -25.0, 44.1, 19.3 ],
        snap4: [ -22.5, 44.1, 19.3 ],
        snap5: [ -20.0, 44.1, 19.3 ],
        snap6: [ -17.5, 44.1, 19.3 ],
        snap7: [ -15.0, 44.1, 19.3 ]
    });
    console.log(enclosure2);

    // Add new modules
    console.log('Creating new modules...');
    const eb = await addTemplateModule(template.id, 'End Bracket', 'Workspaces/Workspace/For Shakeel/Lib/End bracket.ipt',
        [0, 0, 0] // For now, only specifying the snapping position, later might add orientation, or full 4x4 affine xform
    );
    console.log(eb);
    const cb2 = await addTemplateModule(template.id, 'Circuit Breaker 2', 'Workspaces/Workspace/For Shakeel/Lib/Circuit breaker-2.ipt',
        [0, 0, 0] // For now, only specifying the snapping position, later might add orientation, or full 4x4 affine xform
    );
    console.log(cb2);
    const cb3 = await addTemplateModule(template.id, 'Circuit Breaker 3', 'Workspaces/Workspace/For Shakeel/Lib/Circuit breaker-3.ipt',
        [0, 0, 0] // For now, only specifying the snapping position, later might add orientation, or full 4x4 affine xform
    );
    console.log(cb3);

    console.log('Publishing template...');
    await publishTemplate(template.id);
}

run()
    .then(() => console.log('Template has been installed.'))
    .catch((err) => console.error(err));