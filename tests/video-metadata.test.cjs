const test = require('node:test');
const assert = require('node:assert/strict');
const { parseBilibiliVideoUrl, formatDuration, getBilibiliVideoMetadata } = require('../video-metadata.cjs');

test('Bilibili video URLs accept supported secure hosts and extract BV or av IDs', () => {
  assert.deepEqual(parseBilibiliVideoUrl('https://www.bilibili.com/video/BV1xx411c7mD/?p=2'), { key: 'bvid', id: 'BV1xx411c7mD' });
  assert.deepEqual(parseBilibiliVideoUrl('https://m.bilibili.com/video/av170001?from=search'), { key: 'aid', id: '170001' });
  assert.throws(() => parseBilibiliVideoUrl('https://bilibili.com.evil.example/video/BV1xx411c7mD'), { code: 'INVALID_VIDEO_URL' });
  assert.throws(() => parseBilibiliVideoUrl('http://www.bilibili.com/video/BV1xx411c7mD'), { code: 'INVALID_VIDEO_URL' });
  assert.throws(() => parseBilibiliVideoUrl('https://example.com/video/BV1xx411c7mD'), { code: 'INVALID_VIDEO_URL' });
});

test('video durations are formatted for minute and hour lengths', () => {
  assert.equal(formatDuration(0), '0:00');
  assert.equal(formatDuration(1122), '18:42');
  assert.equal(formatDuration(3661), '1:01:01');
  assert.throws(() => formatDuration(-1), /时长数据无效/);
});

test('metadata request sends only the extracted ID and returns title, author, duration, and source', async () => {
  let requested;
  const fetchStub = async (url, options) => {
    requested = { url: new URL(url), options };
    return new Response(JSON.stringify({ code: 0, data: { bvid: 'BV1xx411c7mD', title: '测试视频', duration: 1122, owner: { name: '测试作者' } } }), { status: 200 });
  };
  const result = await getBilibiliVideoMetadata('https://www.bilibili.com/video/BV1xx411c7mD', fetchStub);
  assert.equal(requested.url.origin, 'https://api.bilibili.com');
  assert.equal(requested.url.pathname, '/x/web-interface/view');
  assert.equal(requested.url.searchParams.get('bvid'), 'BV1xx411c7mD');
  assert.equal(requested.options.headers.Referer, 'https://www.bilibili.com/');
  assert.equal(requested.options.credentials, undefined);
  assert.deepEqual(result, {
    title: '测试视频', creator: '测试作者', duration: '18:42', source: '哔哩哔哩',
    url: 'https://www.bilibili.com/video/BV1xx411c7mD',
  });
});

test('bad links never call the remote service; unavailable videos and network errors are explicit', async () => {
  let calls = 0;
  await assert.rejects(getBilibiliVideoMetadata('https://example.com/video/BV1xx411c7mD', async () => { calls++; }), { code: 'INVALID_VIDEO_URL' });
  assert.equal(calls, 0);
  await assert.rejects(getBilibiliVideoMetadata('https://www.bilibili.com/video/BV1xx411c7mD', async () => new Response(JSON.stringify({ code: -404, data: null }), { status: 200 })), { code: 'VIDEO_NOT_AVAILABLE' });
  await assert.rejects(getBilibiliVideoMetadata('https://www.bilibili.com/video/BV1xx411c7mD', async () => { throw new Error('offline'); }), { code: 'UPSTREAM_UNAVAILABLE' });
});
