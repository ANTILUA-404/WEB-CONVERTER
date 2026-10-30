'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { env } = require('./env');
const { ytdlp, ffmpegDir } = require('./binaries');

const BASE_ARGS = ['--no-warnings', '--no-playlist', '--no-colors', '--newline'];

function extraArgs() {
  const args = [];
  if (env.YTDLP_COOKIES) args.push('--cookies', env.YTDLP_COOKIES);
  if (env.YTDLP_PROXY) args.push('--proxy', env.YTDLP_PROXY);
  if (ffmpegDir()) args.push('--ffmpeg-location', ffmpegDir());
  return args;
}

function run(args, { onLine, onProgress, timeoutMs = 300000, signal, maxBuffer = 30 * 1024 * 1024 } = {}) {
  return new Promise((resolve, reject) => {
    if (!ytdlp.path) {
      reject(Object.assign(new Error('yt-dlp tidak ditemukan. Set YTDLP_PATH atau taruh di server/bin.'), { code: 'YTDLP_MISSING' }));
      return;
    }
    const child = spawn(ytdlp.path, [...BASE_ARGS, ...extraArgs(), ...args], {
      windowsHide: true,
      signal,
    });
    let stdout = '';
    let stderr = '';
    let killed = false;

    const timer = setTimeout(() => {
      killed = true;
      try {
        child.kill('SIGKILL');
      } catch (err) {
        /* ignore */
      }
    }, timeoutMs);

    const handle = (chunk, isErr) => {
      const text = chunk.toString();
      if (isErr) {
        stderr += text;
        if (stderr.length > 80000) stderr = stderr.slice(-40000);
      } else {
        stdout += text;
        if (stdout.length > maxBuffer) stdout = stdout.slice(-maxBuffer);
      }
      for (const line of text.split(/\r?\n/)) {
        if (!line.trim()) continue;
        if (onLine) onLine(line);
        if (onProgress) {
          const m = /\[download\]\s+(\d+(?:\.\d+)?)%/.exec(line);
          if (m) onProgress(Math.min(99, Math.round(Number(m[1]))), line.trim());
        }
      }
    };

    child.stdout.on('data', (c) => handle(c, false));
    child.stderr.on('data', (c) => handle(c, true));
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (killed) {
        reject(Object.assign(new Error('Download melewati batas waktu.'), { code: 'TIMEOUT' }));
        return;
      }
      if (code !== 0) {
        const tail = stderr.split(/\r?\n/).filter(Boolean).slice(-4).join(' ');
        reject(Object.assign(new Error(tail || 'yt-dlp gagal (exit ' + code + ').'), { code: 'YTDLP_FAILED' }));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

async function resolveInfo(url, opts = {}) {
  const { stdout } = await run(['-J', '--skip-download', url], { timeoutMs: 90000, ...opts });
  const start = stdout.indexOf('{');
  if (start < 0) throw Object.assign(new Error('Metadata tidak ditemukan.'), { code: 'NO_METADATA' });
  const data = JSON.parse(stdout.slice(start));
  if (Array.isArray(data.entries) && data.entries.length) return data.entries[0];
  return data;
}

function findProducedFile(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isFile());
  if (!entries.length) return null;
  let best = null;
  for (const entry of entries) {
    if (/\.(part|ytdl|temp)$/i.test(entry.name)) continue;
    const full = path.join(dir, entry.name);
    const stat = fs.statSync(full);
    if (!best || stat.size > best.size) best = { path: full, size: stat.size, name: entry.name };
  }
  return best;
}

async function downloadAudio(url, dir, opts = {}) {
  fs.mkdirSync(dir, { recursive: true });
  await run(
    ['-f', 'bestaudio/best', '-o', path.join(dir, 'source.%(ext)s'), url],
    { timeoutMs: 300000, ...opts }
  );
  return findProducedFile(dir);
}

async function downloadVideo(url, dir, quality, opts = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const { videoFormatSelector } = require('./converter');
  await run(
    [
      '-f', videoFormatSelector(quality),
      '--merge-output-format', 'mp4',
      '-o', path.join(dir, 'source.%(ext)s'),
      url,
    ],
    { timeoutMs: 420000, ...opts }
  );
  return findProducedFile(dir);
}

module.exports = { run, resolveInfo, downloadAudio, downloadVideo, findProducedFile };
