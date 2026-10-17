import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import videoMetadata from './video-metadata.cjs';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)));
const port = Number(process.env.SHIYOU_PORT || 8765);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};
const allowedFiles = new Set(['index.html', 'styles.css', 'domain.js', 'backup.js', 'cover-image.js', 'app.js']);

createServer(async (request, response) => {
  let requestUrl;
  try { requestUrl = new URL(request.url, 'http://127.0.0.1'); }
  catch { response.writeHead(400).end('Bad request'); return; }
  if (requestUrl.pathname === '/api/video-metadata') {
    if (request.method !== 'GET') {
      response.writeHead(405, { Allow: 'GET' }).end();
      return;
    }
    try {
      const metadata = await videoMetadata.getBilibiliVideoMetadata(requestUrl.searchParams.get('url'));
      response.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      }).end(JSON.stringify(metadata));
    } catch (error) {
      const status = error.code === 'INVALID_VIDEO_URL' ? 400 : error.code === 'VIDEO_NOT_AVAILABLE' ? 422 : 502;
      response.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      }).end(JSON.stringify({ error: error.message || '无法识别视频信息。' }));
    }
    return;
  }
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  let decoded;
  try { decoded = decodeURIComponent(requestUrl.pathname); }
  catch { response.writeHead(400).end('Bad request'); return; }
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const target = resolve(root, relative);
  if (target !== root && !target.startsWith(`${root}${sep}`)) {
    response.writeHead(403).end('Forbidden');
    return;
  }
  if (!allowedFiles.has(relative.replace(/\\/g, '/'))) {
    response.writeHead(404).end('Not found');
    return;
  }
  try {
    const body = await readFile(target);
    response.writeHead(200, {
      'Content-Type': types[extname(target).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Length': body.length,
    });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch (error) {
    response.writeHead(error.code === 'ENOENT' ? 404 : 500).end(error.code === 'ENOENT' ? 'Not found' : 'Server error');
  }
}).listen(port, '127.0.0.1', () => process.stdout.write(`Shiyou local app: http://127.0.0.1:${port}\n`));
