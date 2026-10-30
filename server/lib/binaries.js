'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { env } = require('./env');

const isWin = process.platform === 'win32';
const exe = (name) => (isWin ? name + '.exe' : name);
const repoRoot = path.join(__dirname, '..', '..');

function firstExisting(candidates) {
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
    } catch (err) {
      /* ignore */
    }
  }
  return null;
}

function probeBinary(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: 15000, windowsHide: true });
  if (result.error) return null;
  const out = (result.stdout || '') + (result.stderr || '');
  const first = out.split(/\r?\n/).find((l) => l.trim());
  return first ? first.trim() : 'ok';
}

function resolve(name, envPath) {
  const local = [
    envPath,
    path.join(__dirname, '..', 'bin', exe(name)),
    path.join(repoRoot, 'bin', exe(name)),
  ];
  const found = firstExisting(local);
  if (found) {
    return { path: found, version: probeBinary(found, name === 'ffmpeg' ? ['-version'] : ['--version']) };
  }
  const version = probeBinary(name, name === 'ffmpeg' ? ['-version'] : ['--version']);
  if (version) return { path: name, version };
  return { path: null, version: null };
}

const ffmpeg = resolve('ffmpeg', env.FFMPEG_PATH);
const ytdlp = resolve('yt-dlp', env.YTDLP_PATH);

function ffmpegDir() {
  if (!ffmpeg.path) return '';
  return ffmpeg.path === 'ffmpeg' ? '' : path.dirname(ffmpeg.path);
}

let rubberbandCache = null;
function hasRubberband() {
  if (rubberbandCache !== null) return rubberbandCache;
  if (!ffmpeg.path) {
    rubberbandCache = false;
    return rubberbandCache;
  }
  const result = spawnSync(ffmpeg.path, ['-hide_banner', '-filters'], { encoding: 'utf8', timeout: 20000, windowsHide: true });
  rubberbandCache = /rubberband/i.test((result.stdout || '') + (result.stderr || ''));
  return rubberbandCache;
}

module.exports = { ffmpeg, ytdlp, ffmpegDir, hasRubberband, isWin };
