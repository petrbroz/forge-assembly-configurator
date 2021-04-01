# forge-assembly-configurator

A simple, generic assembly configurator built using the [Autodesk Forge](https://forge.autodesk.com) platform.

![preview](./docs/preview.gif)

## Development

### Prerequisites

- [Node.js](https://nodejs.org/en/download) (LTS version is recommended)
- [Forge application](https://forge.autodesk.com/en/docs/oauth/v2/tutorials/create-app)

### Folder structure

- _shared_ - the code for basic CRUD operations on "templates" and "projects"
- _plugins_ - an Inventor plugin that is used to assemble parts
- _server_ - a simple Express.js server providing a web interface for the configurator
  - _public_ - client side assets
  - _routes_ - server side endpoints
- _tools_ - helper scripts for bootstrapping the pipeline, creating sample templates, etc.
  - _templates_ - a couple of design files (Inventor, SolidWorks, STEP) for sample templates

### Running locally

- install dependencies: `yarn install`
- setup env. variables listed in _config.js_
- if not available, setup the Design Automation pipeline: `node tools/setup-inventor-pipeline.js`
- if not available, setup a sample template: `node tools/setup-template-przemek.js`
- run the server `yarn start`
- visit http://localhost:3000