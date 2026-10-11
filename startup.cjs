// cPanel Application root: uploaded project root. Startup file: startup.cjs.
const path = require('path');
const fs = require('fs');
require('./server/node_modules/dotenv').config({
  path: path.join(__dirname, '.env'),
});

if (!process.env.NODE_ENV) process.env.NODE_ENV = 'production';
const required = ['DB_HOST', 'DB_USER', 'DB_NAME', 'JWT_SECRET'];
const missing = required.filter((key) => !process.env[key]?.trim());
if (process.env.DB_PASSWORD === undefined) missing.push('DB_PASSWORD');
if (missing.length)
  throw new Error(
    'Missing required environment variables: ' + missing.join(', '),
  );

const frontend = path.join(__dirname, 'dist', 'index.html');
if (!fs.existsSync(frontend))
  throw new Error(
    'React build is missing. Run npm run build in the project root and upload dist/.',
  );

const { startServer } = require('./server/listen');
const app = require('./server/app');
module.exports = startServer(app);
