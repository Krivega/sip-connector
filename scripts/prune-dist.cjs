const fs = require('node:fs');
const path = require('node:path');

const distRoot = path.resolve(__dirname, '..', 'dist');

const removePaths = ['playwright.config.d.ts'];

for (const relativePath of removePaths) {
  fs.rmSync(path.join(distRoot, relativePath), { force: true });
}
