# forge-assembly-configurator

A simple, generic assembly configurator built using the [Autodesk Forge](https://forge.autodesk.com) platform.

[![Preview](https://img.youtube.com/vi/Jz3izhFTEps/0.jpg)](https://www.youtube.com/watch?v=Jz3izhFTEps "Forge Configurator Demo")

Live demo: https://forge-assembly-configurator.autodesk.io

## Development

### Prerequisites

- [Node.js](https://nodejs.org/en/download) (LTS version is recommended)
- [Forge application](https://forge.autodesk.com/en/docs/oauth/v2/tutorials/create-app)

### Folder structure

- _shared_ - basic CRUD operations on "templates" and "projects", used by the server and command-line tools
- _plugins_ - an Inventor plugin used to assemble parts
- _server_ - a simple Express.js server providing a web interface for the configurator
  - _public_ - client side assets
  - _routes_ - server side endpoints
- _tools_ - helper scripts for bootstrapping the pipeline, creating sample templates, etc.
  - _templates_ - a couple of design files (Inventor, SolidWorks, STEP) for sample templates

### Running locally

- install dependencies: `yarn install`
- setup env. variables listed in _config.js_
- if not available, create the Design Automation pipeline: `node tools/setup-inventor-pipeline.js`
- if not available, create a sample template: `node tools/setup-sample-template-przemek.js`
- run the server `yarn start`
- visit http://localhost:3000

## Asset preparation

When preparing your own 3D assets for this application, make sure that their origin is
setup properly. When you are dropping a part into an assembly, the application logic
will always try and find a "connector point" (on modules that are already in the assembly)
that's closest to your mouse cursor, and it will move your part's **origin** to that location.
