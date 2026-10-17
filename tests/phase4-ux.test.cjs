const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

test('home metrics have distinct destinations for each content type', () => {
  const metrics = app.slice(app.indexOf('const cards='), app.indexOf('];', app.indexOf('const cards=')) + 1);
  for (const route of ['videos', 'articles', 'resources', 'versions', 'favorites']) {
    assert.match(metrics, new RegExp(`'${route}'`), `missing metric route ${route}`);
  }
  assert.match(metrics, /counts\.videos/);
  assert.match(metrics, /counts\.articles/);
  assert.match(app, /data\.games\.length\?gameCards/);
  assert.match(app, /没有找到匹配的游戏/);
});

test('confirmation dialogs resolve as cancelled on Escape', () => {
  assert.match(app, /const cancel=document\.querySelector\('#modal-root \[data-cancel\]'\);if\(cancel\)cancel\.click\(\)/);
  assert.match(app, /function confirmAction\(/);
});

test('failed localStorage save happens before assigning the new app state', () => {
  const save = app.indexOf('save(next)');
  const toggle = app.slice(app.indexOf("case'toggle-compact'"), app.indexOf("case'toggle-compact'") + 280);
  assert.ok(save >= 0);
  assert.ok(toggle.indexOf('save(next)') < toggle.indexOf('data=next'));
  const upsert = app.slice(app.indexOf('const nextData=Domain.upsert'), app.indexOf('function readArticle'));
  assert.ok(upsert.indexOf('save(nextData)') < upsert.indexOf('data=nextData'));
});

test('game details include a filtered version-record section with valid actions', () => {
  const detail = app.slice(app.indexOf('function renderGameDetail'), app.indexOf('function renderSettings'));
  assert.match(detail, /\['版本记录',data\.versions\.filter\(x=>x\.gameId===g\.id\),'versions'/);
  assert.match(detail, /data-page="\$\{type\}" data-filter-game="\$\{g\.id\}"/);
  assert.match(app, /itemType==='versions'\?`<button class="icon-btn" data-action="view-version"/);
  assert.match(app, /n\.dataset\.page===page/);
});

test('danger action and responsive metric cards have visual states', () => {
  assert.match(css, /\.btn\.danger\{/);
  assert.match(css, /\.home-metrics\{grid-template-columns:repeat\(5/);
  assert.match(css, /@media\(max-width:680px\)\{\.home-metrics\{grid-template-columns:repeat\(2/);
});

test('the local server allows reads only and serves no documents outside the app', async (t) => {
  const port = 20000 + Math.floor(Math.random() * 1000);
  const child = spawn(process.execPath, [path.join(root, 'server.mjs')], {
    cwd: root,
    env: { ...process.env, SHIYOU_PORT: String(port) },
    stdio: 'ignore',
  });
  t.after(() => child.kill());
  const base = `http://127.0.0.1:${port}`;
  let response;
  for (let attempt = 0; attempt < 40; attempt++) {
    try { response = await fetch(`${base}/styles.css`); break; }
    catch { await new Promise((resolve) => setTimeout(resolve, 50)); }
  }
  assert.ok(response, 'server did not start');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.match(response.headers.get('x-content-type-options'), /nosniff/);
  assert.equal((await fetch(`${base}/PRD.md`)).status, 404);
  assert.equal((await fetch(`${base}/index.html`, { method: 'POST' })).status, 405);
  const head = await fetch(`${base}/backup.js`, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
});
