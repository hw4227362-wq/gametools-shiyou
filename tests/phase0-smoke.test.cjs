const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

test('the local app shell references only workspace assets', () => {
  const html = read('index.html');
  assert.match(html, /href="styles\.css"/);
  assert.match(html, /src="app\.js"/);
  assert.doesNotMatch(html, /<script[^>]+src="https?:\/\//i);
  assert.doesNotMatch(html, /<link[^>]+href="https?:\/\//i);
});

test('the app JavaScript parses before any feature tests run', () => {
  const result = spawnSync(process.execPath, ['--check', path.join(root, 'app.js')], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('the Windows launcher binds its local server to loopback only', () => {
  const launcher = read('启动拾游.bat');
  const startup = read('启动拾游.ps1');
  assert.match(launcher, /WindowsPowerShell\\v1\.0\\powershell\.exe.*-File "%~dp0启动拾游\.ps1"/i);
  assert.doesNotMatch(launcher, /where node/i, 'the batch file must not reject a runtime that is available outside PATH');
  assert.match(startup, /-ArgumentList 'server\.mjs'/i);
  assert.match(startup, /function Find-NodeRuntime/);
  assert.match(startup, /Get-Command node/);
  assert.match(startup, /\.cache\\codex-runtimes/);
  assert.match(startup, /Programs\\nodejs\\node\.exe/);
  assert.match(startup, /127\.0\.0\.1:8765/);
  assert.match(startup, /AddSeconds\(20\)/);
  assert.match(startup, /Invoke-WebRequest/);
  assert.match(startup, /<title>拾游/);
  assert.match(launcher, /start "" "http:\/\/127\.0\.0\.1:8765"/);
  assert.ok(launcher.indexOf('-File "%~dp0启动拾游.ps1"') < launcher.indexOf('start "" "http://127.0.0.1:8765"'), 'browser must open only after the readiness check succeeds');
  assert.match(startup, /服务在 20 秒内没有就绪/);
});

test('all eight PRD modules have navigation entries', () => {
  const html = read('index.html');
  for (const page of ['home', 'games', 'videos', 'articles', 'resources', 'favorites', 'versions', 'settings']) {
    assert.match(html, new RegExp(`data-page="${page}"`), `missing navigation page: ${page}`);
  }
});

test('the shared domain layer loads before the app shell', () => {
  const html = read('index.html');
  assert.ok(html.indexOf('src="domain.js"') >= 0);
  assert.ok(html.indexOf('src="domain.js"') < html.indexOf('src="backup.js"'));
  assert.ok(html.indexOf('src="backup.js"') < html.indexOf('src="app.js"'));
});

test('the built-in server serves local app files and blocks traversal', async (t) => {
  const port = 19000 + Math.floor(Math.random() * 1000);
  const child = spawn(process.execPath, [path.join(root, 'server.mjs')], {
    cwd: root,
    env: { ...process.env, SHIYOU_PORT: String(port) },
    stdio: 'ignore',
  });
  t.after(() => child.kill());
  const base = `http://127.0.0.1:${port}`;
  let response;
  for (let attempt = 0; attempt < 40; attempt++) {
    try { response = await fetch(`${base}/`); break; }
    catch { await new Promise((resolve) => setTimeout(resolve, 50)); }
  }
  assert.ok(response, 'server did not start');
  assert.equal(response.status, 200);
  assert.match(await response.text(), /src="domain\.js"/);
  assert.equal((await fetch(`${base}/app.js`)).status, 200);
  assert.equal((await fetch(`${base}/backup.js`)).status, 200);
  assert.equal((await fetch(`${base}/cover-image.js`)).status, 200);
  assert.equal((await fetch(`${base}/video-player.js`)).status, 200);
  assert.equal((await fetch(`${base}/PRD.md`)).status, 404);
  assert.equal((await fetch(`${base}/api/video-metadata?url=${encodeURIComponent('https://example.com/video/BV1xx411c7mD')}`)).status, 400);
  assert.equal((await fetch(`${base}/video-metadata.cjs`)).status, 404);
  assert.equal((await fetch(`${base}/%2e%2e%2fPRD.md`)).status, 403);
});

test('the UI does not import remote styles or scripts', () => {
  const html = read('index.html');
  const css = read('styles.css');
  assert.doesNotMatch(html, /(?:src|href)="https?:\/\//i);
  assert.doesNotMatch(css, /@import|url\([^)]*https?:\/\//i);
});
