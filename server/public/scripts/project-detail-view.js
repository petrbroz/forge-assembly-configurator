/// import * as Autodesk from "@types/forge-viewer";

let viewer = null;
let urn = null;

window.addEventListener('DOMContentLoaded', function () {
    $('#preview-tab').on('shown.bs.tab', async function (event) {
        if (!viewer) {
            const preview = document.getElementById('preview');
            viewer = await initializeViewer(preview);
            if (urn)
                loadModel(viewer, urn);
        }
    });
    update();
});

async function update() {
    const resp = await fetch(`/projects/${PROJECT_ID}/status`);
    const status = await resp.json();

    // Update the status fields
    const progress = document.getElementById('progress');
    progress.style.width = `${status.progress}%`;
    progress.setAttribute('aria-valuenow', status.progress);
    document.getElementById('project-status').innerText = status.status;

    // Update the logs
    const logs = await fetch(`/projects/${PROJECT_ID}/logs.txt`);
    document.getElementById('logs').value = await logs.text();

    // Update the report
    if (status.status === 'inprogress') {
        document.getElementById('report-tab').classList.add('disabled');
    } else {
        document.getElementById('report-tab').classList.remove('disabled');
        const report = await fetch(`/projects/${PROJECT_ID}/report.txt`);
        document.getElementById('report').value = await report.text();
    }

    // Update the download buttons
    if (status.status === 'inprogress') {
        document.getElementById('download-btn-group').classList.add('disabled');
    } else {
        document.getElementById('download-btn-group').classList.remove('disabled');
    }

    // Update the viewer
    if (status.status === 'finished' && status.urn) {
        document.getElementById('preview-tab').classList.remove('disabled');
        urn = status.urn;
        if (viewer) {
            loadModel(viewer, urn);
        }
    } else {
        document.getElementById('preview-tab').classList.add('disabled');
    }

    // If the project is still being built, schedule another update
    if (status.status === 'inprogress') {
        setTimeout(update, 5000);
    }
}
