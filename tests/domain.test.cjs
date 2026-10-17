const test = require('node:test');
const assert = require('node:assert/strict');
const { normalize, upsert, removeItem, deleteGame, toggleFavorite, filterRecords, searchLibrary, stats, recentRecords } = require('../domain.js');

const seed = { games: [], videos: [], articles: [], resources: [], versions: [], favorites: [], settings: { compact: false } };
const record = (id, gameId, extra = {}) => ({ id, gameId, title: id, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', ...extra });

test('normalization migrates legacy records, timestamps, and legacy favorites', () => {
  const migrated = normalize({ games: [{ name: 'A' }], videos: [{ id: 'v1', favorite: true, date: '2026-02-03' }] }, seed, '2026-03-01T00:00:00.000Z');
  assert.equal(migrated.games[0].id, 'legacy-games-1');
  assert.equal(migrated.games[0].createdAt, '2026-03-01T00:00:00.000Z');
  assert.equal(migrated.videos[0].createdAt, '2026-02-03T12:00:00.000Z');
  assert.deepEqual(migrated.favorites.map(({ type, id }) => ({ type, id })), [{ type: 'videos', id: 'v1' }]);
  assert.equal('favorite' in migrated.videos[0], false);
});

test('upsert creates stable IDs and preserves createdAt while refreshing updatedAt', () => {
  const created = upsert(seed, 'articles', { title: 'First' }, null, '2026-01-01T00:00:00.000Z');
  const id = created.articles[0].id;
  const edited = upsert(created, 'articles', { title: 'Edited' }, id, '2026-02-01T00:00:00.000Z');
  assert.equal(edited.articles.length, 1);
  assert.equal(edited.articles[0].id, id);
  assert.equal(edited.articles[0].title, 'Edited');
  assert.equal(edited.articles[0].createdAt, '2026-01-01T00:00:00.000Z');
  assert.equal(edited.articles[0].updatedAt, '2026-02-01T00:00:00.000Z');
});

test('removeItem deletes the record and its favorites but leaves other data intact', () => {
  const input = { ...seed, videos: [record('v1', 'g1')], favorites: [{ type: 'videos', id: 'v1' }] };
  const result = removeItem(input, 'videos', 'v1');
  assert.equal(result.data.videos.length, 0);
  assert.equal(result.data.favorites.length, 0);
  assert.deepEqual(result.data.articles, []);
  assert.equal(removeItem(input, 'videos', 'missing').data, input);
});

test('deleteGame cascades all game records, favorites, and reports stored file IDs', () => {
  const input = {
    ...seed,
    games: [record('g1', null), record('g2', null)],
    videos: [record('v1', 'g1'), record('v2', 'g2')],
    articles: [record('a1', 'g1')],
    resources: [record('r1', 'g1', { localFile: 'map.xlsx' })],
    versions: [record('p1', 'g1')],
    favorites: [{ type: 'videos', id: 'v1' }, { type: 'resources', id: 'r1' }, { type: 'videos', id: 'v2' }],
  };
  const result = deleteGame(input, 'g1');
  assert.deepEqual(result.data.games.map((item) => item.id), ['g2']);
  assert.deepEqual(result.data.videos.map((item) => item.id), ['v2']);
  assert.deepEqual(result.data.favorites, [{ type: 'videos', id: 'v2' }]);
  assert.deepEqual(result.fileIds, ['r1']);
  assert.deepEqual(result.removedCounts, { videos: 1, articles: 1, resources: 1, versions: 1 });
});

test('favorite toggling is a reversible reference and rejects missing targets', () => {
  const input = { ...seed, videos: [record('v1', 'g1')] };
  const added = toggleFavorite(input, 'videos', 'v1', '2026-01-01T00:00:00.000Z');
  assert.equal(added.isFavorite, true);
  assert.equal(added.data.favorites[0].id, 'v1');
  const removed = toggleFavorite(added.data, 'videos', 'v1');
  assert.equal(removed.isFavorite, false);
  assert.equal(removed.data.videos.length, 1);
  assert.throws(() => toggleFavorite(input, 'articles', 'v1'), RangeError);
});

test('search and filters combine and stats/recent data derive from source records', () => {
  const data = {
    ...seed,
    games: [record('g1', null)],
    videos: [record('v1', 'g1', { title: 'Boss route' })],
    articles: [record('a1', 'g1', { title: 'Build', category: 'Guide', updatedAt: '2026-02-01T00:00:00.000Z' })],
    resources: [record('r1', 'g1', { title: 'Map', kind: 'Sheet' })],
    versions: [], favorites: [{ type: 'articles', id: 'a1' }],
  };
  assert.deepEqual(filterRecords([...data.videos, ...data.articles], { gameId: 'g1', query: 'build', category: 'Guide' }).map((x) => x.id), ['a1']);
  assert.deepEqual(stats(data), { games: 1, guides: 2, videos: 1, articles: 1, resources: 1, versions: 0, favorites: 1 });
  assert.equal(recentRecords(data, 1)[0].id, 'a1');
});

test('global library search by game name returns that game and all related record types', () => {
  const data = {
    ...seed,
    games: [record('genshin', null, { name: '原神', version: '6.0', type: '开放世界' }), record('hsr', null, { name: '崩坏：星穹铁道' })],
    videos: [record('v1', 'genshin', { title: '深渊讲解', creator: '攻略作者' }), record('v2', 'hsr', { title: '忘却之庭' })],
    articles: [record('a1', 'genshin', { title: '开荒路线', category: '养成攻略' })],
    resources: [record('r1', 'genshin', { title: '地图清单', kind: '表格' })],
    versions: [record('p1', 'genshin', { title: '新区域预览', version: '6.0', tags: ['地图'] })],
  };
  const results = searchLibrary(data, ' 原神 ');
  assert.deepEqual(results.map((item) => item.type), ['games', 'videos', 'articles', 'resources', 'versions']);
  assert.ok(results.every((item) => item.gameId === 'genshin'));
  assert.deepEqual(searchLibrary(data, ''), []);
  assert.deepEqual(searchLibrary(data, '崩坏：星穹铁道').map((item) => item.id), ['hsr', 'v2']);
  assert.deepEqual(searchLibrary(data, '攻略作者').map((item) => item.id), ['v1']);
});
