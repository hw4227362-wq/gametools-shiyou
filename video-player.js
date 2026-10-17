((global) => {
  const BILIBILI_HOSTS = new Set(['bilibili.com', 'www.bilibili.com', 'm.bilibili.com']);
  const DIRECT_VIDEO_EXTENSIONS = new Set(['.mp4', '.m4v', '.webm', '.ogv', '.ogg']);

  function getPlayback(url) {
    let parsed;
    try { parsed = new URL(String(url || '')); } catch { return { kind: 'unsupported' }; }
    if (!['https:', 'http:'].includes(parsed.protocol)) return { kind: 'unsupported' };
    if (BILIBILI_HOSTS.has(parsed.hostname.toLowerCase())) {
      const match = parsed.pathname.match(/^\/video\/(BV[0-9A-Za-z]+|av[0-9]+)\/?$/i);
      if (!match) return { kind: 'unsupported' };
      const id = match[1];
      const query = /^av/i.test(id) ? `aid=${encodeURIComponent(id.slice(2))}` : `bvid=${encodeURIComponent(id)}`;
      return { kind: 'bilibili', src: `https://player.bilibili.com/player.html?${query}&autoplay=0&danmaku=0` };
    }
    if (DIRECT_VIDEO_EXTENSIONS.has(parsed.pathname.slice(parsed.pathname.lastIndexOf('.')).toLowerCase())) {
      return { kind: 'direct', src: parsed.href };
    }
    return { kind: 'unsupported' };
  }

  const api = { getPlayback };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.ShiyouVideoPlayer = api;
})(globalThis);
