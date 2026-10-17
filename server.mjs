import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

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
const allowedFiles = new Set(['index.html', 'styles.css', 'domain.js', 'backup.js', 'app.js']);

createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  let decoded;
  try { decoded = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname); }
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
