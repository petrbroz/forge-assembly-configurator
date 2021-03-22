class ConnectorsExtension extends Autodesk.Viewing.Extension {
    constructor(viewer, options) {
        super(viewer, options);
        this._connectors = {};
        this._projected = {};
        this._onCameraChange = this.onCameraChange.bind(this);
        this._connectorGeometry = new THREE.SphereGeometry(1.0, 4, 4);
        this._connectorMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    }

    load() {
        this.viewer.addEventListener(Autodesk.Viewing.CAMERA_CHANGE_EVENT, this._onCameraChange);
        this.viewer.overlays.addScene('connectors');
        console.log('Connectors extension loaded.');
        return true;
    }

    unload() {
        this.viewer.removeEventListener(Autodesk.Viewing.CAMERA_CHANGE_EVENT, this._onCameraChange);
        this.viewer.overlays.removeScene('connectors');
        console.log('Connectors extension unloaded.');
        return true;
    }

    resetConnectors(connectors) {
        this._connectors = connectors;
        this._projected = {};
        for (const key in connectors) {
            const c = connectors[key];
            const mesh = new THREE.Mesh(this._connectorGeometry, this._connectorMaterial);
            mesh.position.set(c[0], c[1], c[2]);
            this.viewer.overlays.addMesh(mesh, 'connectors');
        }
        this.updateConnectors();
    }

    updateConnectors() {
        for (const key in this._connectors) {
            const c = this._connectors[key];
            this._projected[key] = this.viewer.impl.worldToClient(new THREE.Vector3(c[0], c[1], c[2]));
        }
    }

    onCameraChange() {
        this.updateConnectors();
    }

    findNearest(clientX, clientY, maxRadius) {
        let nearest = null;
        let minDist = Number.MAX_VALUE;
        for (const key in this._projected) {
            const proj = this._projected[key];
            const dx = proj.x - clientX;
            const dy = proj.y - clientY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < maxRadius && dist < minDist) {
                nearest = key;
                minDist = dist;
            }
        }
        return nearest ? { id: nearest, position: this._connectors[nearest] } : null;
    }
}

Autodesk.Viewing.theExtensionManager.registerExtension('ConnectorsExtension', ConnectorsExtension);