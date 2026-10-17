const VIDEO_HOSTS = new Set(['bilibili.com', 'www.bilibili.com', 'm.bilibili.com']);

function invalid(message) {
  const error = new TypeError(message);
  error.code = 'INVALID_VIDEO_URL';
  return error;
}

function parseBilibiliVideoUrl(input) {
  let url;
  try { url = new URL(String(input || '').trim()); }
  catch { throw invalid('请填写有效的哔哩哔哩视频链接。'); }
  if (url.protocol !== 'https:' || !VIDEO_HOSTS.has(url.hostname.toLowerCase())) {
    throw invalid('目前只支持 https://www.bilibili.com/video/... 公开视频链接。');
  }
  const match = url.pathname.match(/^\/video\/(BV[0-9A-Za-z]{10}|av\d+)(?:\/|$)/);
  if (!match) throw invalid('无法从链接中识别 BV 号或 av 号，请使用哔哩哔哩视频详情页链接。');
  const id = match[1];
  return id.startsWith('BV') ? { key: 'bvid', id } : { key: 'aid', id: id.slice(2) };
}

function formatDuration(seconds) {
  if (!Number.isSafeInteger(seconds) || seconds < 0) throw new TypeError('视频时长数据无效。');
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${minutes}:${String(remainder).padStart(2, '0')}`;
}

async function getBilibiliVideoMetadata(input, fetchImpl = globalThis.fetch) {
  const reference = parseBilibiliVideoUrl(input);
  const endpoint = new URL('https://api.bilibili.com/x/web-interface/view');
  endpoint.searchParams.set(reference.key, reference.id);
  let response;
  try {
    response = await fetchImpl(endpoint, {
      headers: { Accept: 'application/json', Referer: 'https://www.bilibili.com/', 'User-Agent': 'ShiyouLocalApp/1.0' },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    const error = new Error('暂时无法连接哔哩哔哩。请检查网络后重试，也可以手动填写作者和时长。');
    error.code = 'UPSTREAM_UNAVAILABLE';
    throw error;
  }
  if (!response.ok) {
    const error = new Error('哔哩哔哩暂时无法提供视频信息，请稍后重试。');
    error.code = 'UPSTREAM_UNAVAILABLE';
    throw error;
  }
  let payload;
  try { payload = await response.json(); }
  catch {
    const error = new Error('哔哩哔哩返回了无法读取的信息，请稍后重试。');
    error.code = 'UPSTREAM_INVALID_RESPONSE';
    throw error;
  }
  const data = payload?.data;
  if (payload?.code !== 0 || !data || typeof data.title !== 'string' || typeof data.owner?.name !== 'string' || !Number.isSafeInteger(data.duration)) {
    const error = new Error('未能读取视频信息。视频可能不存在、不可公开访问或暂时受到平台限制。');
    error.code = 'VIDEO_NOT_AVAILABLE';
    throw error;
  }
  const bvid = typeof data.bvid === 'string' && data.bvid ? data.bvid : reference.id;
  return {
    title: data.title,
    creator: data.owner.name,
    duration: formatDuration(data.duration),
    source: '哔哩哔哩',
    url: `https://www.bilibili.com/video/${bvid}`,
  };
}

module.exports = { parseBilibiliVideoUrl, formatDuration, getBilibiliVideoMetadata };
