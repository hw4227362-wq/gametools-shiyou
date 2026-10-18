const path = require('node:path');
const packager = require('@electron/packager');

const appRoot = path.resolve(__dirname, '..');

packager({
  dir: appRoot,
  name: '拾游',
  platform: 'win32',
  arch: 'x64',
  out: path.join(appRoot, 'release'),
  overwrite: true,
  asar: true,
  prune: false,
  executableName: '拾游',
  appVersion: require('../package.json').version,
  ignore: [
    /[\\/]node_modules([\\/]|$)/,
    /[\\/]release([\\/]|$)/,
    /[\\/]tests([\\/]|$)/,
    /[\\/]\.git([\\/]|$)/,
  ],
}).then(outputDirectories => {
  for (const outputDirectory of outputDirectories) {
    process.stdout.write(`拾游桌面版已生成：${path.join(outputDirectory, '拾游.exe')}\n`);
  }
}).catch(error => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
