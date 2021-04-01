const path = require('path');
const express = require('express');
const config = require('../config.js');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api/forge', require('./routes/forge'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/templates', require('./routes/templates.js'));
app.use('/', (req, res) => res.redirect('/projects.html'));

app.listen(config.PORT, () => { console.log(`Server listening on port ${config.PORT}`); });
