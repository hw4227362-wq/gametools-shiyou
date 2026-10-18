const assert = require('node:assert/strict');
const { test } = require('node:test');

test('desktop server starts on loopback and serves the existing app page', async t => {
  const { listenShiyouServer } = await import('../server.mjs');
  const server = await listenShiyouServer({ listenPort: 0, log: false });
  t.after(() => new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  }));

  const address = server.address();
  assert.equal(address.address, '127.0.0.1');

  const response = await fetch(`http://127.0.0.1:${address.port}/`);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /<title>拾游/);
});
