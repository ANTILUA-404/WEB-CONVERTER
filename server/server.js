'use strict';

/**
 * ANTIBYPASS V2 — web backend.
 * Zero-dependency HTTP server: static UI + JSON API + job queue + SSE progress.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const http = require('http');

const { env } = require('./lib/env');
const { Store, DATA_DIR, FILES_DIR, UPLOADS_DIR, TMP_DIR } = require('./lib/store');
const { Auth } = require('./lib/auth');
const { Queue } = require('./lib/queue');
const { processJob } = require('./lib/pipeline');
const converter = require('./lib/converter');
const roblox = require('./lib/roblox');
const binaries = require('./lib/binaries');
const {
  sendJson, sendText, readJson, readMultipart, serveStatic, sseStart, sseSend,
} = require('./lib/http');

const ROOT = path.join(__dirname, '..');
const store = new Store();
const auth = new Auth(store);
const queue = new Queue({ concurrency: env.CONCURRENCY, perUser: 1, limit: 40 });

const running = new Map(); // jobId -> AbortController
const uploads = new Map(); // uploadId -> {path, name, size, userId, at}
const cooldowns = new Map(); // userId -> timestamp

const MIME_EXT = { '.mp3': 'mp3', '.ogg': 'ogg', '.wav': 'wav', '.flac': 'flac', '.m4a': 'm4a', '.opus': 'opus', '.mp4': 'mp4', '.rbxm': 'rbxm', '.rbxmx': 'rbxmx' };

/* ------------------------------------------------------------------ helpers */
function publicSettings() {
  const s = store.settings();
  return {
    maxCredits: s.maxCredits,
    refillHours: s.refillHours,
    creditsEnabled: s.creditsEnabled,
    cooldownSec: s.cooldownSec,
    maxDurationSec: s.maxDurationSec,
    defaultFormat: s.defaultFormat,
    defaultGetFormat: s.defaultGetFormat,
    defaultSpeed: s.defaultSpeed,
    defaultVideoQuality: s.defaultVideoQuality,
    maintenance: s.maintenance,
    maintenanceReason: s.maintenanceReason,
    supportContact: s.supportContact,
  };
}

function mePayload(userId) {
  const user = store.ensureUser(userId);
  const credits = store.credits(userId);
  return {
    user: { id: user.id, name: user.name, tier: user.tier, role: user.role, createdAt: user.createdAt },
    credits,
    settings: publicSettings(),
    maintenance: store.settings().maintenance,
  };
}

function jobPayload(job) {
  if (!job) return job;
  const { uploadPath, ...safe } = job;
  return safe;
}

function sanitizeSource(value) {
  const s = String(value || '').trim();
  if (!s) return '';
  if (s.length > 2048) throw Object.assign(new Error('Link terlalu panjang.'), { status: 400 });
  if (!/^https?:\/\//i.test(s) && !/^\d{1,20}$/.test(s)) {
    throw Object.assign(new Error('Link harus diawali http(s):// atau berupa Asset ID.'), { status: 400 });
  }
  return s;
}

function consumeUpload(uploadId, userId) {
  const entry = uploads.get(uploadId);
  if (!entry) return null;
  if (entry.userId !== userId) return null;
  uploads.delete(uploadId);
  return entry;
}

function cooldownLeft(userId) {
  const seconds = store.settings().cooldownSec || 0;
  if (!seconds) return 0;
  const last = cooldowns.get(userId) || 0;
  const left = Math.ceil((last + seconds * 1000 - Date.now()) / 1000);
  return left > 0 ? left : 0;
}

/* --------------------------------------------------------------------- jobs */
async function createJob(req, res, userId) {
  const body = await readJson(req, 256 * 1024);
  const settings = store.settings();

  if (settings.maintenance) {
    sendJson(res, 503, { error: settings.maintenanceReason || 'Maintenance aktif.', code: 'MAINTENANCE' });
    return;
  }

  const blocked = store.isBlacklisted(userId);
  if (blocked) {
    sendJson(res, 403, { error: 'User diblokir: ' + blocked.reason, code: 'BLACKLISTED' });
    return;
  }

  const type = String(body.type || 'bypass');
  if (!['bypass', 'get', 'video', 'spoof'].includes(type)) {
    sendJson(res, 400, { error: 'Tipe job tidak dikenal.', code: 'BAD_TYPE' });
    return;
  }

  if (settings.creditsEnabled) {
    const credits = store.credits(userId);
    if (credits.remaining <= 0) {
      sendJson(res, 402, { error: 'Kredit habis. Klaim kode redeem atau tunggu recovery.', code: 'NO_CREDITS', credits });
      return;
    }
    if (!store.consume(userId, 1)) {
      sendJson(res, 402, { error: 'Kredit habis. Klaim kode redeem atau tunggu recovery.', code: 'NO_CREDITS', credits });
      return;
    }
  }

  const left = cooldownLeft(userId);
  if (left > 0) {
    sendJson(res, 429, { error: `Tunggu ${left} detik sebelum job berikutnya.`, code: 'COOLDOWN', retryAfter: left });
    return;
  }

  let uploadPath = null;
  let uploadName = null;
  if (body.uploadId) {
    const entry = consumeUpload(String(body.uploadId), userId);
    if (!entry) {
      sendJson(res, 400, { error: 'Upload tidak ditemukan atau sudah dipakai.', code: 'BAD_UPLOAD' });
      return;
    }
    uploadPath = entry.path;
    uploadName = entry.name;
  }

  let source = '';
  if (!uploadPath) {
    try {
      source = sanitizeSource(body.source);
    } catch (err) {
      sendJson(res, err.status || 400, { error: err.message, code: 'BAD_SOURCE' });
      return;
    }
    if (!source) {
      sendJson(res, 400, { error: 'Link atau file wajib diisi.', code: 'NO_SOURCE' });
      return;
    }
  }

  const options = converter.normaliseOptions({
    format: body.format,
    speed: body.speed,
    pitch: body.pitch,
    gain: body.gain,
    preset: body.preset,
    normalize: body.normalize,
    silence: body.silence,
    trimStart: body.trimStart,
    trimEnd: body.trimEnd,
    customName: body.customName,
    fresh: type === 'get',
  });

  const id = 'job_' + crypto.randomBytes(8).toString('hex');
  const speed = type === 'bypass' ? options.speed : 1;
  const job = {
    id,
    userId,
    type,
    title: uploadName || 'Menganalisis sumber…',
    source: source || uploadName || '',
    uploadName: uploadName || null,
    format: type === 'video' ? 'mp4' : type === 'spoof' ? 'rbxm' : options.format,
    speed,
    pitch: options.pitch,
    gain: options.amplify,
    preset: options.preset || body.preset || 'default',
    quality: String(body.quality || settings.defaultVideoQuality || '1080p'),
    normalize: options.normalize,
    silence: options.removeSilence,
    trimStart: options.trimStart,
    trimEnd: options.trimEnd,
    customName: options.customName,
    status: 'queued',
    progress: 0,
    stage: 'queue',
    stageLabel: 'Menunggu slot antrean',
    createdAt: Date.now(),
    startedAt: null,
    finishedAt: null,
    durationSec: 0,
    outputDurationSec: 0,
    sizeBytes: 0,
    playbackSpeed: converter.playbackSpeedLabel(converter.playbackSpeed({}, options)),
    engine: type === 'bypass' ? converter.engineFor(options) : 'native',
    artworkSeed: (uploadName || source || type) + id,
    log: [{ t: Date.now(), line: 'job diterima · ' + type }],
    error: null,
    downloadUrl: null,
    uploadPath: uploadPath || undefined,
  };

  store.addJob(job);
  cooldowns.set(userId, Date.now());

  const controller = new AbortController();
  running.set(id, controller);

  sendJson(res, 201, { job: jobPayload(job), credits: store.credits(userId) });

  queue
    .add(
      async () => {
        try {
          const current = store.job(job.id);
          if (!current || current.status === 'failed') return;
          await processJob(job, {
            store,
            signal: controller.signal,
            onUpdate: () => {},
          });
          store.audit('Job selesai', `${type} · ${job.title} · ${job.sizeBytes} bytes`, 'success', userId);
        } catch (err) {
          if (store.settings().creditsEnabled) store.addCredits(userId, 1);
          store.audit('Job gagal', `${type} · ${err.code || 'FAILED'} · ${err.message}`, 'warn', userId);
        } finally {
          running.delete(id);
        }
      },
      { userId }
    )
    .catch((err) => {
      store.updateJob(id, { status: 'failed', stageLabel: 'Antrean penuh', error: err.message, finishedAt: Date.now() });
      running.delete(id);
    });
}

function cancelJob(req, res, jobId, userId, isAdmin) {
  const job = store.job(jobId);
  if (!job) return sendJson(res, 404, { error: 'Job tidak ditemukan.' });
  if (!isAdmin && job.userId !== userId) return sendJson(res, 403, { error: 'Bukan job kamu.' });
  const controller = running.get(jobId);
  if (controller) controller.abort();
  if (job.status === 'queued') {
    store.updateJob(jobId, { status: 'failed', stageLabel: 'Dibatalkan', error: 'Dibatalkan oleh user.', finishedAt: Date.now() });
  }
  sendJson(res, 200, { ok: true });
}

function sendJobFile(req, res, job, isAdmin, userId) {
  if (!isAdmin && job.userId !== userId) return sendJson(res, 403, { error: 'Bukan job kamu.' });
  if (job.status !== 'done' || !job.fileName) return sendJson(res, 409, { error: 'File belum siap.' });
  const dir = path.join(FILES_DIR, job.id);
  const file = path.join(dir, path.basename(job.fileName));
  if (!fs.existsSync(file)) return sendJson(res, 404, { error: 'File sudah dihapus.' });
  const stat = fs.statSync(file);
  const ext = path.extname(file).toLowerCase();
  const mime = {
    '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.flac': 'audio/flac',
    '.m4a': 'audio/mp4', '.opus': 'audio/ogg', '.mp4': 'video/mp4',
    '.rbxm': 'application/octet-stream', '.rbxmx': 'application/xml',
  }[ext] || 'application/octet-stream';
  const encoded = encodeURIComponent(job.fileName);
  res.writeHead(200, {
    'Content-Type': mime,
    'Content-Length': stat.size,
    'Content-Disposition': `attachment; filename="${job.fileName.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encoded}`,
    'Cache-Control': 'no-store',
  });
  fs.createReadStream(file).pipe(res);
}

function streamJob(req, res, jobId, userId, isAdmin) {
  const job = store.job(jobId);
  if (!job) return sendJson(res, 404, { error: 'Job tidak ditemukan.' });
  if (!isAdmin && job.userId !== userId) return sendJson(res, 403, { error: 'Bukan job kamu.' });

  sseStart(res);
  const tick = () => {
    const current = store.job(jobId);
    if (!current) return finish();
    sseSend(res, jobPayload(current));
    if (current.status === 'done' || current.status === 'failed') return finish();
  };
  let timer = setInterval(tick, 500);
  const finish = () => {
    clearInterval(timer);
    res.end();
  };
  req.on('close', () => clearInterval(timer));
  tick();
}

/* ------------------------------------------------------------------- server */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;
  const method = req.method.toUpperCase();

  // Basic security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');

  try {
    if (pathname === '/api/health' && method === 'GET') {
      return sendJson(res, 200, {
        ok: true,
        mode: 'live',
        uptime: Math.round(process.uptime()),
        queue: { running: queue.running, pending: queue.size },
        binaries: {
          ffmpeg: binaries.ffmpeg.path,
          ffmpegVersion: binaries.ffmpeg.version,
          ytdlp: binaries.ytdlp.path,
          ytdlpVersion: binaries.ytdlp.version,
          rubberband: binaries.hasRubberband(),
        },
      });
    }

    if (pathname.startsWith('/api/')) {
      const { user, blocked } = auth.ensureUser(req, res);
      const session = auth.sessionFromReq(req);
      const isAdmin = Boolean(session);
      const userId = user.id;

      /* ---------------------------------------------------------------- me */
      if (pathname === '/api/me' && method === 'GET') {
        return sendJson(res, 200, { ...mePayload(userId), blocked: blocked ? blocked.reason : null, session: session ? { user: session.userId, role: session.role, name: session.name, expiresAt: session.expiresAt } : null });
      }

      /* -------------------------------------------------------------- jobs */
      if (pathname === '/api/jobs' && method === 'POST') return createJob(req, res, userId);

      if (pathname === '/api/jobs' && method === 'GET') {
        const all = isAdmin && url.searchParams.get('all') === '1';
        const jobs = store.jobsFor(userId, all).slice(0, 60).map(jobPayload);
        return sendJson(res, 200, { jobs, credits: store.credits(userId) });
      }

      const jobMatch = /^\/api\/jobs\/([a-z0-9_]+)(\/[a-z]+)?$/.exec(pathname);
      if (jobMatch) {
        const jobId = jobMatch[1];
        const suffix = jobMatch[2] || '';
        const job = store.job(jobId);
        if (!job) return sendJson(res, 404, { error: 'Job tidak ditemukan.' });
        if (suffix === '/events' && method === 'GET') return streamJob(req, res, jobId, userId, isAdmin);
        if (suffix === '/file' && method === 'GET') return sendJobFile(req, res, job, isAdmin, userId);
        if (suffix === '/cancel' && method === 'POST') return cancelJob(req, res, jobId, userId, isAdmin);
        if (!suffix && method === 'GET') {
          if (!isAdmin && job.userId !== userId) return sendJson(res, 403, { error: 'Bukan job kamu.' });
          return sendJson(res, 200, { job: jobPayload(job) });
        }
      }

      /* ------------------------------------------------------------ upload */
      if (pathname === '/api/upload' && method === 'POST') {
        const parts = await readMultipart(req, env.MAX_UPLOAD_MB * 1024 * 1024);
        const filePart = parts.find((p) => p.filename && p.data && p.data.length);
        if (!filePart) return sendJson(res, 400, { error: 'File tidak ditemukan di form.' });
        const uploadId = crypto.randomBytes(10).toString('hex');
        const ext = path.extname(filePart.filename) || '.bin';
        const dest = path.join(UPLOADS_DIR, uploadId + ext);
        fs.writeFileSync(dest, filePart.data);
        uploads.set(uploadId, { path: dest, name: filePart.filename, size: filePart.data.length, userId, at: Date.now() });
        return sendJson(res, 201, { uploadId, name: filePart.filename, size: filePart.data.length });
      }

      /* ------------------------------------------------------------ redeem */
      if (pathname === '/api/redeem' && method === 'POST') {
        const body = await readJson(req);
        const result = store.redeem(userId, body.code);
        if (!result.ok) return sendJson(res, 400, { error: result.error, code: 'REDEEM_FAILED' });
        return sendJson(res, 200, result);
      }

      /* -------------------------------------------------------------- auth */
      if (pathname === '/api/auth/login' && method === 'POST') {
        const body = await readJson(req);
        const result = auth.login(body.username, body.password);
        if (!result) return sendJson(res, 401, { error: 'Kredensial salah.' });
        auth.attachSessionCookie(res, result.token);
        return sendJson(res, 200, { session: { user: result.user, role: result.role, name: result.name, expiresAt: result.expiresAt } });
      }

      if (pathname === '/api/auth/logout' && method === 'POST') {
        auth.logout(req, res);
        return sendJson(res, 200, { ok: true });
      }

      if (pathname === '/api/auth/session' && method === 'GET') {
        return sendJson(res, 200, { session: session ? { user: session.userId, role: session.role, name: session.name, expiresAt: session.expiresAt } : null });
      }

      /* ------------------------------------------------------------- admin */
      if (pathname.startsWith('/api/admin/')) {
        if (!session) return sendJson(res, 401, { error: 'Butuh login admin.' });
        const ownerOnly = ['/api/admin/settings/reset', '/api/admin/credits/reset', '/api/admin/audit'];
        if (ownerOnly.some((p) => pathname === p) && session.role !== 'owner') {
          return sendJson(res, 403, { error: 'Aksi ini khusus owner.' });
        }

        if (pathname === '/api/admin/overview' && method === 'GET') {
          return sendJson(res, 200, {
            stats: store.stats(),
            jobs: store.jobsFor(null, true).slice(0, 12),
            audit: store.data.audit.slice(0, 8),
            settings: store.settings(),
            engine: {
              queue: { running: queue.running, pending: queue.size },
              ffmpeg: binaries.ffmpeg.version,
              ytdlp: binaries.ytdlp.version,
              rubberband: binaries.hasRubberband(),
            },
          });
        }

        if (pathname === '/api/admin/codes' && method === 'GET') return sendJson(res, 200, { codes: store.codes() });
        if (pathname === '/api/admin/codes' && method === 'POST') {
          const body = await readJson(req);
          try {
            const code = store.createCode(body);
            return sendJson(res, 201, { code });
          } catch (err) {
            return sendJson(res, 400, { error: err.message });
          }
        }

        const codeMatch = /^\/api\/admin\/codes\/([A-Z0-9-]+)$/i.exec(pathname);
        if (codeMatch && method === 'PATCH') {
          const body = await readJson(req);
          const code = store.updateCode(codeMatch[1], body);
          if (!code) return sendJson(res, 404, { error: 'Kode tidak ditemukan.' });
          return sendJson(res, 200, { code });
        }
        if (codeMatch && method === 'DELETE') {
          const ok = store.deleteCode(codeMatch[1]);
          return sendJson(res, ok ? 200 : 404, ok ? { ok: true } : { error: 'Kode tidak ditemukan.' });
        }

        if (pathname === '/api/admin/blacklist' && method === 'GET') return sendJson(res, 200, { blacklist: store.data.blacklist });
        if (pathname === '/api/admin/blacklist' && method === 'POST') {
          const body = await readJson(req);
          const id = String(body.id || '').replace(/\D/g, '');
          if (!/^\d{15,40}$/.test(id) && !/^u_[a-f0-9]+$/.test(id)) {
            return sendJson(res, 400, { error: 'User ID tidak valid.' });
          }
          const entry = store.addBlacklist(id, body.reason, Number(body.days) || 0);
          if (!entry) return sendJson(res, 409, { error: 'ID sudah ada di blacklist.' });
          return sendJson(res, 201, { entry });
        }
        const blMatch = /^\/api\/admin\/blacklist\/([^/]+)$/.exec(pathname);
        if (blMatch && method === 'DELETE') {
          const ok = store.removeBlacklist(decodeURIComponent(blMatch[1]));
          return sendJson(res, ok ? 200 : 404, ok ? { ok: true } : { error: 'Tidak ditemukan.' });
        }

        if (pathname === '/api/admin/users' && method === 'GET') {
          const users = Object.values(store.data.users)
            .sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0))
            .slice(0, 100);
          return sendJson(res, 200, { users });
        }

        const userMatch = /^\/api\/admin\/users\/([^/]+)\/credits$/.exec(pathname);
        if (userMatch && method === 'POST') {
          const body = await readJson(req);
          const target = decodeURIComponent(userMatch[1]);
          const amount = Math.trunc(Number(body.amount) || 0);
          const credits = body.action === 'set' ? store.setCredits(target, amount) : store.addCredits(target, amount);
          store.audit(body.action === 'set' ? 'Saldo kredit di-set' : 'Kredit ditambahkan', target + ' → ' + credits, 'success', session.userId);
          return sendJson(res, 200, { credits });
        }

        if (pathname === '/api/admin/settings' && method === 'GET') return sendJson(res, 200, { settings: store.settings() });
        if (pathname === '/api/admin/settings' && method === 'PUT') {
          if (session.role !== 'owner') return sendJson(res, 403, { error: 'Setting khusus owner.' });
          const body = await readJson(req);
          return sendJson(res, 200, { settings: store.updateSettings(body) });
        }
        if (pathname === '/api/admin/settings/reset' && method === 'POST') {
          store.data.settings = { ...store.data.settings, maintenance: false, maxCredits: 25, refillHours: 6, creditsEnabled: true, cooldownSec: 5, defaultFormat: 'ogg', defaultGetFormat: 'mp3', defaultSpeed: 2.3, defaultVideoQuality: '1080p', maxDurationSec: 0, maxFileMb: 200 };
          store.audit('Setting direset', 'kembali ke default', 'warn', session.userId);
          store.save();
          return sendJson(res, 200, { settings: store.settings() });
        }
        if (pathname === '/api/admin/maintenance' && method === 'POST') {
          const body = await readJson(req);
          const settings = store.updateSettings({ maintenance: Boolean(body.enabled), maintenanceReason: body.reason || store.settings().maintenanceReason });
          store.audit('Maintenance ' + (settings.maintenance ? 'diaktifkan' : 'dimatikan'), 'via panel', settings.maintenance ? 'warn' : 'success', session.userId);
          return sendJson(res, 200, { settings });
        }

        if (pathname === '/api/admin/credits/reset' && method === 'POST') {
          for (const u of Object.values(store.data.users)) {
            u.credits = store.settings().maxCredits;
            u.lastRefill = Date.now();
          }
          store.audit('Reset semua kredit', Object.keys(store.data.users).length + ' akun', 'warn', session.userId);
          store.save();
          return sendJson(res, 200, { ok: true });
        }

        if (pathname === '/api/admin/audit' && method === 'GET') return sendJson(res, 200, { audit: store.data.audit });
        if (pathname === '/api/admin/audit' && method === 'DELETE') {
          store.data.audit = [];
          store.save();
          return sendJson(res, 200, { ok: true });
        }

        if (pathname === '/api/admin/cache/purge' && method === 'POST') {
          let removed = 0;
          for (const dir of [TMP_DIR]) {
            for (const entry of fs.readdirSync(dir)) {
              fs.rmSync(path.join(dir, entry), { recursive: true, force: true });
              removed += 1;
            }
          }
          store.audit('Cache dibersihkan', removed + ' folder temp', 'info', session.userId);
          return sendJson(res, 200, { removed });
        }

        return sendJson(res, 404, { error: 'Endpoint admin tidak ditemukan.' });
      }

      return sendJson(res, 404, { error: 'Endpoint tidak ditemukan.' });
    }

    /* --------------------------------------------------------------- static */
    if (method === 'GET' || method === 'HEAD') {
      const blocked = /^\/(server|data|\.)/i.test(pathname) || pathname.includes('/.');
      if (blocked) return sendText(res, 404, 'Not found');
      if (serveStatic(req, res, ROOT, pathname)) return;
      // SPA-ish fallback for unknown non-asset paths
      if (!path.extname(pathname)) {
        const index = path.join(ROOT, 'index.html');
        if (fs.existsSync(index)) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
          fs.createReadStream(index).pipe(res);
          return;
        }
      }
      return sendText(res, 404, 'Not found');
    }

    sendText(res, 405, 'Method not allowed');
  } catch (err) {
    console.error('[server]', err);
    if (!res.headersSent) sendJson(res, err.status || 500, { error: err.message || 'Internal error.' });
    else res.end();
  }
});

/* -------------------------------------------------------------------- boot */
function logBinaries() {
  const ok = (v) => (v ? '✓' : '✗');
  console.log(`${ok(binaries.ffmpeg.path)} ffmpeg   ${binaries.ffmpeg.version || 'tidak ditemukan'}`);
  console.log(`${ok(binaries.ytdlp.path)} yt-dlp   ${binaries.ytdlp.version || 'tidak ditemukan'}`);
  if (binaries.ffmpeg.path) console.log(`${ok(binaries.hasRubberband())} rubberband filter`);
  if (!binaries.ffmpeg.path || !binaries.ytdlp.path) {
    console.log('  → set FFMPEG_PATH / YTDLP_PATH di server/.env, atau taruh binary di server/bin/');
  }
}

if (require.main === module) {
  server.listen(env.PORT, env.HOST, () => {
    console.log('');
    console.log('  ANTIBYPASS V2 — web engine');
    console.log('  http://' + env.HOST + ':' + env.PORT);
    console.log('  data:', path.relative(ROOT, DATA_DIR));
    logBinaries();
    console.log('');
  });
}

process.on('SIGINT', () => {
  store.flush();
  process.exit(0);
});
process.on('SIGTERM', () => {
  store.flush();
  process.exit(0);
});

module.exports = { server, store, queue };
