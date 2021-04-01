const express = require('express');
const { AuthenticationClient } = require('forge-server-utils');
const { FORGE_CLIENT_ID, FORGE_CLIENT_SECRET } = require('../../config.js');

let router = express.Router();
let authenticationClient = new AuthenticationClient(FORGE_CLIENT_ID, FORGE_CLIENT_SECRET);

router.get('/token', async function(req, res, next) {
    try {
        const result = await authenticationClient.authenticate(['viewables:read']);
        res.json(result);
    } catch(err) {
        next(err);
    }
});

module.exports = router;
