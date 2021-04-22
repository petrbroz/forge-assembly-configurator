const express = require('express');
const { AuthenticationClient } = require('forge-server-utils');
const { FORGE_CLIENT_ID, FORGE_CLIENT_SECRET, FORGE_CALLBACK_URL } = require('../../config.js');

const EmailRegExp = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
let router = express.Router();
let authenticationClient = new AuthenticationClient(FORGE_CLIENT_ID, FORGE_CLIENT_SECRET);

router.get('/login', async function (req, res, next) {
    const url = authenticationClient.getAuthorizeRedirect(['user-profile:read', 'user:read'], FORGE_CALLBACK_URL);
    res.redirect(url);
});

router.get('/logout', async function (req, res, next) {
    delete req.session.access_token;
    delete req.session.refresh_token;
    delete req.session.expires_at;
    delete req.session.user_id;
    delete req.session.user_name;
    res.redirect('/');
});

router.get('/callback', async function (req, res, next) {
    try {
        const token = await authenticationClient.getToken(req.query.code, FORGE_CALLBACK_URL);
        req.session.access_token = token.access_token;
        req.session.refresh_token = token.refresh_token;
        req.session.expires_at = Date.now() + token.expires_in * 1000;
        const profile = await authenticationClient.getUserProfile(req.session.access_token);
        // Clean up the user name if it's an email
        if (EmailRegExp.test(profile.userName.toLowerCase())) {
            profile.userName = profile.userName.substr(0, profile.userName.indexOf('@'));
        }
        req.session.user_id = profile.userId;
        req.session.user_name = profile.userName;
        res.redirect('/');
    } catch(err) {
        next(err);
    }
});

router.get('/user.js', async function (req, res, next) {
    if (req.session && req.session.user_id && req.session.user_name) {
        res.type('.js').send(`const USER = { id: "${req.session.user_id}", name: "${req.session.user_name}" };`);
    } else {
        res.type('.js').send(`const USER = null;`);
    }
});

module.exports = router;
