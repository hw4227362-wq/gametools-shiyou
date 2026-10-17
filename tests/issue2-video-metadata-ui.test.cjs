const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const settings = app.slice(app.indexOf('function renderSettings'), app.indexOf('function render(){'));

test('video editor lets a user explicitly request Bilibili metadata and keeps fields editable', () => {
  const videoForm = app.slice(app.indexOf("if(type==='video')"), app.indexOf("}else if(type==='article')"));
  assert.match(videoForm, /name="url"/);
  assert.match(videoForm, /data-action="detect-video-metadata"/);
  assert.match(videoForm, /name="source"/);
  assert.match(videoForm, /field\('title',[\s\S]*?required:true/);
  assert.match(videoForm, /field\('creator','作者'/);
  assert.match(videoForm, /field\('duration','时长'/);
  assert.match(app, /case'detect-video-metadata':detectVideoMetadata\(el\);break/);
});

test('metadata network request only occurs after button action and fills four fields', () => {
  const handler = app.slice(app.indexOf('async function detectVideoMetadata'), app.indexOf('async function openResource'));
  assert.match(handler, /fetch\(`\/api\/video-metadata\?url=/);
  assert.match(handler, /Object\.entries\(result\)/);
  assert.match(handler, /form\.elements\.namedItem\(key\)/);
  assert.match(handler, /location\.hostname/);
  assert.match(handler, /通过“启动拾游\.bat”打开应用/);
  assert.match(settings, /只有主动点击视频自动识别时/);
});
