const path = require('path');
const express = require('express');
const config = require('../config.js');

const app = express();
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, '/views'));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api/forge', require('./routes/forge'));
app.use('/projects', require('./routes/projects'));
app.use('/templates', require('./routes/templates.js'));
app.use('/', (req, res) => res.redirect('/projects'));

app.listen(config.PORT, () => { console.log(`Server listening on port ${config.PORT}`); });
