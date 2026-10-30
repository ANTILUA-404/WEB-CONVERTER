'use strict';

/**
 * Tiny .env loader (no dependencies). Looks for server/.env then <repo>/.env.
 * Existing process.env values always win.
 */

const fs = require('fs');
const path = require('path');

function parseEnv(text) {
  const out = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function loadEnv() {
  const candidates = [
    path.join(__dirname, '..', '.env'),
    path.join(__dirname, '..', '..', '.env'),
  ];
  for (const file of candidates) {
    try {
      if (!fs.existsSync(file)) continue;
      const parsed = parseEnv(fs.readFileSync(file, 'utf8'));
      for (const [key, value] of Object.entries(parsed)) {
        if (process.env[key] === undefined) process.env[key] = value;
      }
    } catch (err) {
      console.warn('[env] gagal membaca', file, err.message);
    }
  }
}

loadEnv();

const env = {
  PORT: Number(process.env.PORT || 8787),
  HOST: process.env.HOST || '127.0.0.1',
  SECRET: process.env.APP_SECRET || '',
  OWNER_USER: process.env.OWNER_USER || 'owner',
  OWNER_PASS: process.env.OWNER_PASS || 'antibypass',
  ADMIN_USER: process.env.ADMIN_USER || 'admin',
  ADMIN_PASS: process.env.ADMIN_PASS || 'admin123',
  FFMPEG_PATH: process.env.FFMPEG_PATH || '',
  YTDLP_PATH: process.env.YTDLP_PATH || '',
  YTDLP_COOKIES: process.env.YTDLP_COOKIES || '',
  YTDLP_PROXY: process.env.YTDLP_PROXY || '',
  DATA_DIR: process.env.DATA_DIR || '',
  JOB_TIMEOUT_SEC: Number(process.env.JOB_TIMEOUT_SEC || 420),
  MAX_UPLOAD_MB: Number(process.env.MAX_UPLOAD_MB || 60),
  MAX_OUTPUT_MB: Number(process.env.MAX_OUTPUT_MB || 200),
  CONCURRENCY: Number(process.env.CONCURRENCY || 2),
};

module.exports = { env, parseEnv };
