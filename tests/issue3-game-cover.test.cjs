const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const CoverImage = require('../cover-image.js');
const Backup = require('../backup.js');
const Domain = require('../domain.js');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('game editor accepts supported image formats and rejects unsafe or oversized uploads', () => {
  assert.equal(CoverImage.validateImageFile({ type: 'image/png', size: 20 }), true);
  assert.equal(CoverImage.validateImageFile({ type: 'image/jpeg', size: CoverImage.MAX_INPUT_BYTES }), true);
  assert.throws(() => CoverImage.validateImageFile({ type: 'image/svg+xml', size: 20 }), /JPG、PNG 或 WebP/);
  assert.throws(() => CoverImage.validateImageFile({ type: 'image/png', size: CoverImage.MAX_INPUT_BYTES + 1 }), /不超过 10 MB/);
  assert.throws(() => CoverImage.validateImageFile({ type: 'image/png', size: 0 }), /大于 0/);
});

test('game cover encoding is constrained to a compact safe data URL', () => {
  const valid = `data:image/jpeg;base64,${'A'.repeat(40)}`;
  assert.equal(CoverImage.isCoverDataUrl(valid), true);
  assert.equal(CoverImage.isCoverDataUrl(`data:text/html;base64,${'A'.repeat(40)}`), false);
  assert.equal(CoverImage.isCoverDataUrl(`data:image/jpeg;base64,${'A'.repeat(CoverImage.MAX_DATA_URL_LENGTH)}`), false);
});

test('game editor uploads, replaces, removes, and renders local background images', () => {
  const gameForm = app.slice(app.indexOf("}else if(type==='game'){"), app.indexOf('\n    }\n    showModal', app.indexOf("}else if(type==='game'){")));
  assert.match(gameForm, /name="coverUpload" accept="image\/jpeg,image\/png,image\/webp"/);
  assert.match(gameForm, /name="removeCover"/);
  assert.match(app, /CoverImage\.createCoverDataUrl\(coverUpload\)/);
  assert.match(app, /Domain\.removeGameCover\(nextData,id\|\|nextData\.games\[0\]\.id\)/);
  assert.match(app, /CoverImage\.isCoverDataUrl\(g\.coverImage\)/);
  assert.match(html, /<script src="cover-image\.js"><\/script>[\s\S]*?<script src="app\.js"><\/script>/);
});

test('removing a game cover clears it from the saved game without mutating prior data', () => {
  const cover = `data:image/jpeg;base64,${Buffer.from('cover').toString('base64')}`;
  const before = { games: [{ id: 'g1', name: '测试游戏', coverImage: cover }, { id: 'g2', name: '保留图片', coverImage: cover }] };
  const after = Domain.removeGameCover(before, 'g1');
  assert.equal(Object.hasOwn(after.games[0], 'coverImage'), false);
  assert.equal(after.games[1].coverImage, cover);
  assert.equal(before.games[0].coverImage, cover);
});

test('full JSON backup restores a game background data URL', async () => {
  const data = { games: [{ id: 'g1', name: '测试游戏', coverImage: `data:image/jpeg;base64,${Buffer.from('cover').toString('base64')}` }], videos: [], articles: [], resources: [], versions: [], favorites: [], settings: {} };
  const restored = Backup.parse(await Backup.stringify(data, []));
  assert.equal(restored.data.games[0].coverImage, data.games[0].coverImage);
});
