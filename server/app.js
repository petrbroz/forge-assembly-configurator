const path = require('path');
const express = require('express');
const session = require('cookie-session');
const config = require('../config.js');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    name: 'ForgeConfiguratorDemo',
    keys: [config.SERVER_SESSION_SECRET],
    maxAge: 7 * 24 * 60 * 60 * 1000
}));
app.use('/auth', require('./routes/auth'));
app.use('/api/forge', require('./routes/forge'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/templates', require('./routes/templates.js'));
app.use('/', (req, res) => res.redirect('/projects.html'));

app.listen(config.PORT, () => { console.log(`Server listening on port ${config.PORT}`); });
