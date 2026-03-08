const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
if (!fs.existsSync(path.join(root, 'node_modules'))) {
  console.log('Installing dependencies (first run)...');
  require('child_process').execSync('npm install', { cwd: root, stdio: 'inherit' });
}
