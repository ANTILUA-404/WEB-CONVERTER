'use strict';

const fs = require('fs');
const path = require('path');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
  '.opus': 'audio/ogg',
  '.mp4': 'video/mp4',
  '.rbxm': 'application/octet-stream',
  '.rbxmx': 'application/xml',
};

function sendJson(res, status, data, headers = {}) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(body);
}

function sendText(res, status, text, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', ...headers });
  res.end(text);
}

function readBody(req, limit = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(Object.assign(new Error('Body terlalu besar.'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function readJson(req, limit = 1024 * 1024) {
  const buf = await readBody(req, limit);
  if (!buf.length) return {};
  try {
    return JSON.parse(buf.toString('utf8'));
  } catch (err) {
    throw Object.assign(new Error('JSON tidak valid.'), { status: 400 });
  }
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const key = part.slice(0, i).trim();
    const value = part.slice(i + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

function setCookie(res, name, value, opts = {}) {
  const bits = [`${name}=${encodeURIComponent(value)}`, 'Path=/'];
  if (opts.maxAge != null) bits.push(`Max-Age=${Math.floor(opts.maxAge)}`);
  if (opts.httpOnly) bits.push('HttpOnly');
  if (opts.sameSite) bits.push(`SameSite=${opts.sameSite}`);
  if (opts.secure) bits.push('Secure');
  const existing = res.getHeader('Set-Cookie');
  const list = existing ? (Array.isArray(existing) ? existing : [existing]) : [];
  list.push(bits.join('; '));
  res.setHeader('Set-Cookie', list);
}

function clearCookie(res, name) {
  setCookie(res, name, '', { maxAge: 0 });
}

/* ------------------------------------------------------------------ static */
function serveStatic(req, res, root, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/' || rel === '') rel = '/index.html';
  const full = path.normalize(path.join(root, rel));
  if (!full.startsWith(path.normalize(root))) {
    sendText(res, 403, 'Forbidden');
    return true;
  }
  let stat;
  try {
    stat = fs.statSync(full);
  } catch (err) {
    return false;
  }
  if (stat.isDirectory()) {
    const index = path.join(full, 'index.html');
    if (fs.existsSync(index)) return sendFile(req, res, index);
    return false;
  }
  return sendFile(req, res, full);
}

function sendFile(req, res, file) {
  const ext = path.extname(file).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  const stat = fs.statSync(file);
  const etag = '"' + stat.size.toString(16) + '-' + stat.mtimeMs.toString(16) + '"';
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, { ETag: etag });
    res.end();
    return true;
  }
  const isHtml = ext === '.html';
  res.writeHead(200, {
    'Content-Type': type,
    'Content-Length': stat.size,
    'Cache-Control': isHtml ? 'no-cache' : 'public, max-age=300',
    ETag: etag,
  });
  fs.createReadStream(file).pipe(res);
  return true;
}

/* --------------------------------------------------------------- multipart */
function parseMultipart(buffer, boundary) {
  const boundaryBuf = Buffer.from('--' + boundary);
  const parts = [];
  let cursor = buffer.indexOf(boundaryBuf);
  while (cursor !== -1) {
    let start = cursor + boundaryBuf.length;
    if (buffer.slice(start, start + 2).toString() === '--') break;
    if (buffer.slice(start, start + 2).toString() === '\r\n') start += 2;
    const next = buffer.indexOf(boundaryBuf, start);
    if (next === -1) break;
    let end = next;
    if (buffer.slice(end - 2, end).toString() === '\r\n') end -= 2;
    const part = buffer.slice(start, end);
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd !== -1) {
      const headerText = part.slice(0, headerEnd).toString('utf8');
      const data = part.slice(headerEnd + 4);
      const headers = {};
      for (const line of headerText.split('\r\n')) {
        const i = line.indexOf(':');
        if (i > 0) headers[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
      }
      const disp = headers['content-disposition'] || '';
      const nameMatch = /name="([^"]*)"/i.exec(disp);
      const fileMatch = /filename="([^"]*)"/i.exec(disp);
      parts.push({
        name: nameMatch ? nameMatch[1] : '',
        filename: fileMatch ? fileMatch[1] : null,
        contentType: headers['content-type'] || '',
        data,
      });
    }
    cursor = next;
  }
  return parts;
}

async function readMultipart(req, maxBytes) {
  const type = req.headers['content-type'] || '';
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(type);
  if (!m) throw Object.assign(new Error('Content-Type bukan multipart.'), { status: 400 });
  const boundary = m[1] || m[2];
  const body = await readBody(req, maxBytes);
  return parseMultipart(body, boundary.trim());
}

/* --------------------------------------------------------------------- SSE */
function sseStart(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 1500\n\n');
}

function sseSend(res, data, event) {
  if (event) res.write(`event: ${event}\n`);
  res.write('data: ' + JSON.stringify(data) + '\n\n');
}

module.exports = {
  MIME,
  sendJson,
  sendText,
  readBody,
  readJson,
  parseCookies,
  setCookie,
  clearCookie,
  serveStatic,
  readMultipart,
  sseStart,
  sseSend,
};
