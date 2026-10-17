const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const VideoPlayer = require('../video-player.js');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('Bilibili watch pages resolve to an embedded player URL for BV and av IDs', () => {
  assert.deepEqual(VideoPlayer.getPlayback('https://www.bilibili.com/video/BV1xx411c7mD/'), {
    kind: 'bilibili',
    src: 'https://player.bilibili.com/player.html?bvid=BV1xx411c7mD&autoplay=0&danmaku=0',
  });
  assert.equal(VideoPlayer.getPlayback('https://m.bilibili.com/video/av12345').src, 'https://player.bilibili.com/player.html?aid=12345&autoplay=0&danmaku=0');
});

test('direct video files use the native player and unrelated or unsafe URLs are not opened', () => {
  assert.deepEqual(VideoPlayer.getPlayback('https://media.example.test/guide.MP4?download=1'), { kind: 'direct', src: 'https://media.example.test/guide.MP4?download=1' });
  for (const url of ['https://example.test/watch?id=1', 'javascript:alert(1)', 'file:///C:/guide.mp4', 'not a URL']) {
    assert.deepEqual(VideoPlayer.getPlayback(url), { kind: 'unsupported' });
  }
});

test('video details render playback in the app and do not navigate to the source URL', () => {
  const detail = app.slice(app.indexOf('function readVideo(id)'), app.indexOf('function readVersion(id)'));
  assert.match(detail, /VideoPlayer\.getPlayback\(x\.url\)/);
  assert.match(detail, /<iframe src=/);
  assert.match(detail, /<video class="video-player-native" controls/);
  assert.match(detail, /暂不支持此视频地址的内嵌播放/);
  assert.doesNotMatch(detail, /视频路径或链接|open-video|window\.open/);
  assert.doesNotMatch(app, /case'open-video'/);
  assert.match(detail, /data-action="edit-item"/);
  assert.match(html, /<script src="video-player\.js"><\/script>[\s\S]*?<script src="app\.js"><\/script>/);
});
