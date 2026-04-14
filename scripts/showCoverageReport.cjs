const { resolve } = require('path');
const { pathToFileURL } = require('url');

const reportPath = resolve('coverage/lcov-report/index.html');

console.log('Coverage report:', pathToFileURL(reportPath).href);
