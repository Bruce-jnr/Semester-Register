const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const express = require('express');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const app = express();
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.json());
app.use(cookieParser());
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
app.get('/api/health', (req, res) => res.json({ success: true, status: 'ok' }));
for (const route of ['auth', 'students', 'rooms', 'fees'])
  app.use('/api/' + route, require('./routes/' + route));

app.use('/api', (req, res) =>
  res.status(404).json({ error: 'Endpoint not found' }),
);

app.use(
  '/images',
  express.static(path.join(__dirname, '..', 'public', 'images')),
);

const dist = path.join(__dirname, '..', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((error, req, res, next) => {
  console.error(error.message);
  res.status(500).json({ error: 'Server error' });
});

module.exports = app;
if (require.main === module) require('./listen').startServer(app);
