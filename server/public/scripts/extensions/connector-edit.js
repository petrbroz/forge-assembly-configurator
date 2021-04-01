class ConnectorEditExtension extends Autodesk.Viewing.Extension {
    constructor(viewer, options) {
        super(viewer, options);
        this._group = null;
        this._button = null;
        this._active = false;
        this._controls = null;
        this._connectors = {};
        this._selectedConnector = null;
        this._connectorGeometry = new THREE.SphereGeometry(options && options.connectorSize || 0.5, 4, 4);
        this._connectorMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        this._onClick = this.onClick.bind(this);
        this._onControlsChange = this.onControlsChange.bind(this);
        this._listeners = new Map();
    }

    async load() {
        this.viewer.overlays.addScene('connectors');
        this.viewer.container.addEventListener('click', this._onClick);
        this._controls = new THREE.TransformControls(this.viewer.impl.camera, this.viewer.canvas, 'translate');
        this._controls.addEventListener('change', this._onControlsChange);
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
        const result = {};
        for (const key in this._connectors) {
            const pos = this._connectors[key].position;
            result[key] = [pos.x, pos.y, pos.z];
        }
        return result;
    }

    set connectors(value) {
        this._connectors = {};
        for (const key in value) {
            const pos = value[key];
            const mesh = new THREE.Mesh(this._connectorGeometry, this._connectorMaterial);
            mesh.position.set(pos[0], pos[1], pos[2]);
            this.viewer.overlays.addMesh(mesh, 'connectors');
            this._connectors[key] = {
                mesh,
                position: {
                    x: pos[0],
                    y: pos[1],
                    z: pos[2]
                }
            };
        }
        this.triggerEvent('connectors-changed', {});
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

    onControlsChange(ev) {
        console.log('change', ev);
        this.viewer.impl.invalidate(false, false, true);
    }

    selectConnector(name) {
        const connector = this._connectors[name];
        if (connector) {
            this._selectedConnector = connector;
            // this._controls.attach(connector.mesh);
            // this.viewer.impl.invalidate(false, false, true);
            return [connector.position.x, connector.position.y, connector.position.z];
        } else {
            this._selectedConnector = null;
            // this._controls.dettach();
            return null;
        }
    }

    updateConnector(name, x, y, z) {
        const connector = this._connectors[name];
        if (connector) {
            connector.position.x = connector.mesh.position.x = x;
            connector.position.y = connector.mesh.position.y = y;
            connector.position.z = connector.mesh.position.z = z;
            this.viewer.impl.invalidate(false, false, true);
        }
    }

    // onPanelClick(ev) {
    //     const connector = this._connectors[ev.name];
    //     if (connector) {
    //         this._selectedConnector = connector;
    //         this._controls.attach(connector.mesh);
    //         //this._controls.setPosition(connector.mesh.position);
    //         //this._controls.visible = true;
    //         this.viewer.impl.invalidate(false, false, true);
    //     } else {
    //         this._selectedConnector = null;
    //         this._controls.dettach();
    //     }
    // }

    onClick(ev) {
        if (!this._active) {
            return;
        }
        const rect = this.viewer.container.getBoundingClientRect();
        const hit = this.viewer.hitTest(ev.clientX - rect.left, ev.clientY - rect.top);
        if (hit) {
            const mesh = new THREE.Mesh(this._connectorGeometry, this._connectorMaterial);
            mesh.position.set(hit.point.x, hit.point.y, hit.point.z);
            const index = Object.keys(this._connectors).length;
            this._connectors[`snap${index}`] = {
                position: {
                    x: hit.point.x,
                    y: hit.point.y,
                    z: hit.point.z
                },
                mesh: mesh
            };
            this.viewer.overlays.addMesh(mesh, 'connectors');
            this.triggerEvent('connectors-changed', {});
        }
    }
}

Autodesk.Viewing.theExtensionManager.registerExtension('ConnectorEditExtension', ConnectorEditExtension);