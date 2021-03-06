class ConnectorRuntimeExtension extends Autodesk.Viewing.Extension {
    constructor(viewer, options) {
        super(viewer, options);
        this._connectors = [];
        this._projected = [];
        this._onCameraChange = this.onCameraChange.bind(this);
        this._onModelChange = this.onModelChange.bind(this);
        this._connectorGeometry = new THREE.SphereGeometry(options.connectorSize || 0.5, 4, 4);
        this._connectorMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    }

    load() {
        this.viewer.addEventListener(Autodesk.Viewing.CAMERA_CHANGE_EVENT, this._onCameraChange);
        this.viewer.addEventListener(Autodesk.Viewing.HIDE_EVENT, this._onModelChange);
        this.viewer.addEventListener(Autodesk.Viewing.SHOW_EVENT, this._onModelChange);
        this.viewer.addEventListener(Autodesk.Viewing.ISOLATE_EVENT, this._onModelChange);
        this.viewer.overlays.addScene('connectors');
        console.log('Connectors extension loaded.');
        return true;
    }

    unload() {
        this.viewer.removeEventListener(Autodesk.Viewing.CAMERA_CHANGE_EVENT, this._onCameraChange);
        this.viewer.removeEventListener(Autodesk.Viewing.HIDE_EVENT, this._onModelChange);
        this.viewer.removeEventListener(Autodesk.Viewing.SHOW_EVENT, this._onModelChange);
        this.viewer.removeEventListener(Autodesk.Viewing.ISOLATE_EVENT, this._onModelChange);
        this.viewer.overlays.removeScene('connectors');
        console.log('Connectors extension unloaded.');
        return true;
    }

    addConnectors(connectors) {
        this._connectors = this._connectors.concat(connectors);
        this.updateOverlay();
        this.updateProjected();
    }

    // Removes connectors associated with specific model
    removeConnectors(model) {
        this._connectors = this._connectors.filter(connector => connector.model !== model);
        this.updateOverlay();
        this.updateProjected();
    }

    updateOverlay() {
        const aggregatHiddenNodes = this.viewer.getAggregateHiddenNodes();
        this.viewer.overlays.clearScene('connectors');
        for (const connector of this._connectors) {
            // If the root of connector's model is hidden (we check if dbIDs 1 or 2 are hidden), skip it
            connector.hidden = aggregatHiddenNodes.findIndex(group => group.model === connector.model && (group.ids.includes(1) || group.ids.includes(2))) !== -1;
            if (connector.hidden) {
                continue;
            }
            const group = new THREE.Group();
            if (connector.grid) {
                for (let z = 0; z < connector.grid.repeat[2]; z++) {
                    for (let y = 0; y < connector.grid.repeat[1]; y++) {
                        for (let x = 0; x < connector.grid.repeat[0]; x++) {
                            const mesh = new THREE.Mesh(this._connectorGeometry, this._connectorMaterial);
                            mesh.position.x = x * connector.grid.offset[0];
                            mesh.position.y = y * connector.grid.offset[1];
                            mesh.position.z = z * connector.grid.offset[2];
                            group.add(mesh);
                        }
                    }
                }
            } else {
                const mesh = new THREE.Mesh(this._connectorGeometry, this._connectorMaterial);
                group.add(mesh);
            }
            group.position.set(connector.transform[3], connector.transform[7], connector.transform[11]);
            this.viewer.overlays.addMesh(group, 'connectors');
        }
        this.viewer.impl.invalidate(true, false, true);
    }

    updateProjected() {
        this._projected = [];
        for (const connector of this._connectors) {
            if (connector.grid) {
                for (let z = 0; z < connector.grid.repeat[2]; z++) {
                    for (let y = 0; y < connector.grid.repeat[1]; y++) {
                        for (let x = 0; x < connector.grid.repeat[0]; x++) {
                            const worldPos = new THREE.Vector3(
                                connector.transform[3] + x * connector.grid.offset[0],
                                connector.transform[7] + y * connector.grid.offset[1],
                                connector.transform[11] + z * connector.grid.offset[2]
                            );
                            const screenPos = this.viewer.impl.worldToClient(worldPos);
                            this._projected.push({ worldPos, screenPos, hidden: connector.hidden });
                        }
                    }
                }
            } else {
                const worldPos = new THREE.Vector3(
                    connector.transform[3],
                    connector.transform[7],
                    connector.transform[11]
                );
                const screenPos = this.viewer.impl.worldToClient(worldPos);
                this._projected.push({ worldPos, screenPos, hidden: connector.hidden });
            }
        }
    }

    onCameraChange() {
        this.updateProjected();
    }

    onModelChange() {
        this.updateOverlay();
        this.updateProjected();
    }

    findNearest(clientX, clientY, maxRadius) {
        let nearest = null;
        let minDist = Number.MAX_VALUE;
        for (let i = 0; i < this._projected.length; i++) {
            const proj = this._projected[i];
            if (proj.hidden) {
                continue;
            }
            const dx = proj.screenPos.x - clientX;
            const dy = proj.screenPos.y - clientY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < maxRadius && dist < minDist) {
                nearest = proj;
                minDist = dist;
            }
        }
        return nearest ? nearest.worldPos : null;
    }
}

Autodesk.Viewing.theExtensionManager.registerExtension('ConnectorRuntimeExtension', ConnectorRuntimeExtension);