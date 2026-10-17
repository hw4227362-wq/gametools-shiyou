const test = require('node:test');
const assert = require('node:assert/strict');
const Backup = require('../backup.js');

const emptyData = () => ({ games: [], videos: [], articles: [], resources: [], versions: [], favorites: [], settings: {} });
const bytes = async (blob) => Array.from(new Uint8Array(await blob.arrayBuffer()));

test('complete JSON backup round-trips records and exact resource bytes', async () => {
  const data = { ...emptyData(), resources: [{ id: 'r1', title: 'Fixture', localFile: 'fixture.bin', hasLocalFile: true }] };
  const source = new Blob([Uint8Array.from([0, 1, 2, 127, 128, 255])], { type: 'application/octet-stream' });
  const json = await Backup.stringify(data, [{ id: 'r1', name: 'fixture.bin', type: source.type, blob: source }]);
  const restored = Backup.parse(json);
  assert.equal(restored.legacy, false);
  assert.equal(restored.data.resources[0].title, 'Fixture');
  assert.equal(restored.files[0].name, 'fixture.bin');
  assert.deepEqual(await bytes(restored.files[0].blob), [0, 1, 2, 127, 128, 255]);
});

test('legacy metadata backups are accepted with an explicit missing-file warning', () => {
  const legacy = { ...emptyData(), resources: [{ id: 'r1', localFile: 'old.xlsx', hasLocalFile: true }] };
  const parsed = Backup.parse(JSON.stringify(legacy));
  assert.equal(parsed.legacy, true);
  assert.equal(parsed.files.length, 0);
  assert.match(parsed.warnings.join(' '), /没有包含资源文件本体/);
});

test('invalid structure, unsupported versions, bad base64, duplicate IDs, and missing files are rejected', async () => {
  assert.throws(() => Backup.parse('{broken'), SyntaxError);
  assert.throws(() => Backup.parse({ format: Backup.FORMAT, version: 99, data: emptyData(), files: [] }), /Unsupported backup version/);
  const data = { ...emptyData(), resources: [{ id: 'r1', hasLocalFile: true }] };
  assert.throws(() => Backup.parse({ format: Backup.FORMAT, version: Backup.VERSION, data, files: [] }), /Missing resource file/);
  assert.throws(() => Backup.parse({ format: Backup.FORMAT, version: Backup.VERSION, data: { ...emptyData(), resources: [{ id: 'r1', hasLocalFile: true }] }, files: [{ id: 'r1', name: 'a', base64: '!!!' }] }), /Invalid file encoding/);
  const pair = { id: 'r1', name: 'file', base64: '' };
  assert.throws(() => Backup.parse({ format: Backup.FORMAT, version: Backup.VERSION, data, files: [pair, pair] }), /Duplicate file ID/);
});

test('canceled import does not call restore adapters', async () => {
  const parsed = { data: emptyData(), files: [] };
  let writes = 0;
  const result = await Backup.restoreIfConfirmed(parsed, async () => false, {
    readData: async () => { writes++; return emptyData(); },
    readFiles: async () => { writes++; return []; },
    writeFiles: async () => { writes++; },
    writeData: async () => { writes++; },
  });
  assert.equal(result.cancelled, true);
  assert.equal(writes, 0);
});

test('failed restore rolls both stores back to their exact previous values', async () => {
  const oldData = { ...emptyData(), games: [{ id: 'old' }] };
  const oldFiles = [{ id: 'old-file', name: 'old.txt', blob: new Blob(['old']) }];
  const newData = { ...emptyData(), games: [{ id: 'new' }] };
  let storedData = oldData;
  let storedFiles = oldFiles;
  let failDataWrite = true;
  await assert.rejects(Backup.restore({ data: newData, files: [] }, {
    readData: async () => storedData,
    readFiles: async () => storedFiles,
    writeFiles: async (files) => { storedFiles = files; },
    writeData: async (data) => { if (failDataWrite) { failDataWrite = false; throw new Error('simulated quota failure'); } storedData = data; },
  }), /simulated quota failure/);
  assert.equal(storedData, oldData);
  assert.equal(storedFiles, oldFiles);
});

test('successful restore writes both stores and reports restored counts', async () => {
  const restoredData = { ...emptyData(), games: [{ id: 'g1' }] };
  const file = { id: 'r1', name: 'map', blob: new Blob(['map']) };
  let storedData = emptyData(), storedFiles = [];
  const result = await Backup.restore({ data: restoredData, files: [file] }, {
    readData: async () => storedData, readFiles: async () => storedFiles,
    writeFiles: async (files) => { storedFiles = files; }, writeData: async (data) => { storedData = data; },
  });
  assert.equal(storedData, restoredData);
  assert.equal(storedFiles[0], file);
  assert.deepEqual(result, { records: 1, files: 1 });
});
