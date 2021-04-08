class ConnectorEditExtension extends Autodesk.Viewing.Extension {
    constructor(viewer, options) {
        super(viewer, options);
        this._group = null;
        this._button = null;
        this._active = false;
        this._controls = null;
        this._connectors = [];
        this._connectorGeometry = new THREE.SphereGeometry(options && options.connectorSize || 0.5, 4, 4);
        this._connectorMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        this._onClick = this.onClick.bind(this);
        //this._onControlsChange = this.onControlsChange.bind(this);
        this._listeners = new Map();
    }

    async load() {
        this.viewer.overlays.addScene('connectors');
        this.viewer.container.addEventListener('click', this._onClick);
        this._controls = new THREE.TransformControls(this.viewer.impl.camera, this.viewer.canvas, 'translate');
        //this._controls.addEventListener('change', this._onControlsChange);
        this.viewer.impl.addOverlay('connectors', this._controls);
        console.log('ConnectorEditExtension loaded.');
        return true;
    }

    unload() {
        this.viewer.overlays.removeScene('connectors');
        this.viewer.container.removeEventListener('click', this._onClick);
        console.log('ConnectorEditExtension unloaded.');
        return true;
    }

    get connectors() {
        return this._connectors;
    }

    set connectors(value) {
        this._connectors = value;
        this.updateOverlay();
        this.triggerEvent('connectors-changed', {});
    }

    updateOverlay() {
        this.viewer.overlays.clearScene('connectors');
        for (const connector of this._connectors) {
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

    onToolbarCreated() {
        this._group = this.viewer.toolbar.getControl('connectors-toolbar');
        if (!this._group) {
            this._group = new Autodesk.Viewing.UI.ControlGroup('connectors-toolbar');
            this.viewer.toolbar.addControl(this._group);
        }

        this._button = new Autodesk.Viewing.UI.Button('connectors-edit-button');
        this._button.onClick = (ev) => {
            this._active = !this._active;
            if (this._active) {
                this._button.addClass('active');
            } else {
                this._button.removeClass('active');
            }
        };
        this._button.setToolTip('Add/Edit Connectors');
        this._group.addControl(this._button);
    }

    addEventListener(event, listener) {
        let listeners = [];
        if (this._listeners.has(event)) {
            listeners = this._listeners.get(event);
        } else {
            this._listeners.set(event, listeners);
        }
        listeners.push(listener);
    }

    triggerEvent(event, payload) {
        const listeners = this._listeners.get(event);
        if (listeners) {
            for (const listener of listeners) {
                listener.call(this, payload);
            }
        }
    }

    onClick(ev) {
        if (!this._active) {
            return;
        }
        const rect = this.viewer.container.getBoundingClientRect();
        const hit = this.viewer.hitTest(ev.clientX - rect.left, ev.clientY - rect.top);
        if (hit) {
            this._connectors.push({
                transform: [
                    1, 0, 0, hit.point.x,
                    0, 1, 0, hit.point.y,
                    0, 0, 1, hit.point.z,
                    0, 0, 0, 1
                ],
                grid: {
                    repeat: [1, 1, 1],
                    offset: [0, 0, 0]
                }
            });
            this.updateOverlay();
            this.triggerEvent('connectors-changed', {});
        }
    }
}

Autodesk.Viewing.theExtensionManager.registerExtension('ConnectorEditExtension', ConnectorEditExtension);