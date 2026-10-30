'use strict';

/**
 * Persistent JSON store for the web backend.
 * Single-process, atomic writes, debounced saves.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { env } = require('./env');

const HOUR = 3600_000;
const DAY = 24 * HOUR;

const DATA_DIR = env.DATA_DIR
  ? path.resolve(env.DATA_DIR)
  : path.join(__dirname, '..', 'data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const FILES_DIR = path.join(DATA_DIR, 'files');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const TMP_DIR = path.join(DATA_DIR, 'tmp');

for (const dir of [DATA_DIR, FILES_DIR, UPLOADS_DIR, TMP_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

const DEFAULTS = () => ({
  version: 2,
  secret: crypto.randomBytes(32).toString('hex'),
  users: {},
  sessions: {},
  jobs: [],
  codes: [
    { code: 'VIP2026', reward: 15, maxClaims: 50, claimCount: 0, active: true, expiresAt: null, note: 'Launch event V2', createdAt: Date.now(), claimedBy: [] },
    { code: 'ABV2-FREE-10', reward: 10, maxClaims: 0, claimCount: 0, active: true, expiresAt: null, note: 'Public drop', createdAt: Date.now(), claimedBy: [] },
    { code: 'ANTILUA-GOLD', reward: 50, maxClaims: 10, claimCount: 0, active: true, expiresAt: null, note: 'Owner private', createdAt: Date.now(), claimedBy: [] },
  ],
  blacklist: [],
  settings: {
    maxCredits: 25,
    refillHours: 6,
    creditsEnabled: true,
    maxDurationSec: 0,
    cooldownSec: 5,
    maxFileMb: 200,
    maxSourceMb: 500,
    defaultFormat: 'ogg',
    defaultGetFormat: 'mp3',
    defaultSpeed: 2.3,
    defaultVideoQuality: '1080p',
    bulkMaxLinks: 10,
    allowDm: true,
    maintenance: false,
    maintenanceReason: 'Engine sedang di-upgrade ke DSP v2.4 — kembali dalam 15 menit.',
    supportContact: '@xelzlovecean_33932',
    robloxPlaceId: '',
  },
  audit: [],
});

function nowIso() {
  return new Date().toISOString();
}

class Store {
  constructor() {
    this.data = this.load();
    this.saveTimer = null;
  }

  load() {
    try {
      if (fs.existsSync(STATE_FILE)) {
        const parsed = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
        const base = DEFAULTS();
        const data = Object.assign(base, parsed);
        data.settings = Object.assign(base.settings, parsed.settings || {});
        if (!data.secret) data.secret = crypto.randomBytes(32).toString('hex');
        if (!Array.isArray(data.jobs)) data.jobs = [];
        if (!Array.isArray(data.codes)) data.codes = base.codes;
        if (!Array.isArray(data.audit)) data.audit = [];
        if (!data.users || typeof data.users !== 'object') data.users = {};
        if (!data.sessions || typeof data.sessions !== 'object') data.sessions = {};
        // Anything left "running" from a previous process is dead.
        for (const job of data.jobs) {
          if (job.status === 'running' || job.status === 'queued') {
            job.status = 'failed';
            job.error = 'Server restart — job dihentikan.';
            job.stageLabel = 'Gagal';
            job.finishedAt = job.finishedAt || Date.now();
          }
        }
        return data;
      }
    } catch (err) {
      console.error('[store] state rusak, mulai baru:', err.message);
    }
    return DEFAULTS();
  }

  save() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.flush(), 120);
  }

  flush() {
    clearTimeout(this.saveTimer);
    this.saveTimer = null;
    const tmp = STATE_FILE + '.tmp';
    try {
      fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
      fs.renameSync(tmp, STATE_FILE);
    } catch (err) {
      console.error('[store] gagal menyimpan state:', err.message);
    }
  }

  /* ------------------------------------------------------------------ users */
  ensureUser(id, meta = {}) {
    let user = this.data.users[id];
    if (!user) {
      user = {
        id,
        name: meta.name || 'Guest',
        tag: meta.tag || '',
        tier: 'free',
        role: 'member',
        credits: this.data.settings.maxCredits,
        lastRefill: Date.now(),
        createdAt: Date.now(),
        lastSeen: Date.now(),
      };
      this.data.users[id] = user;
      this.save();
    }
    user.lastSeen = Date.now();
    return user;
  }

  user(id) {
    return this.data.users[id] || null;
  }

  refill(user) {
    const max = this.data.settings.maxCredits;
    const interval = (this.data.settings.refillHours || 6) * HOUR;
    const now = Date.now();
    if (user.credits >= max) {
      user.lastRefill = now;
      return 0;
    }
    const elapsed = now - (user.lastRefill || now);
    if (elapsed < interval) return 0;
    const gain = Math.floor(elapsed / interval);
    const before = user.credits;
    user.credits = Math.min(max, user.credits + gain);
    user.lastRefill = now - (elapsed % interval);
    return user.credits - before;
  }

  credits(userId) {
    const user = this.ensureUser(userId);
    this.refill(user);
    const max = this.data.settings.maxCredits;
    const interval = (this.data.settings.refillHours || 6) * HOUR;
    return {
      remaining: user.credits,
      max,
      bonus: Math.max(0, user.credits - max),
      nextRefillMs: user.credits >= max ? null : Math.max(0, (user.lastRefill || 0) + interval - Date.now()),
    };
  }

  consume(userId, amount = 1) {
    if (!this.data.settings.creditsEnabled) return true;
    const user = this.ensureUser(userId);
    this.refill(user);
    if (user.credits < amount) return false;
    const wasAtOrAbove = user.credits >= this.data.settings.maxCredits;
    user.credits -= amount;
    if (wasAtOrAbove && user.credits < this.data.settings.maxCredits) user.lastRefill = Date.now();
    this.save();
    return true;
  }

  addCredits(userId, amount) {
    const user = this.ensureUser(userId);
    this.refill(user);
    const before = user.credits;
    user.credits = Math.max(0, before + Math.trunc(amount));
    if (user.credits >= this.data.settings.maxCredits || before >= this.data.settings.maxCredits) {
      user.lastRefill = Date.now();
    }
    this.save();
    return user.credits;
  }

  setCredits(userId, value) {
    const user = this.ensureUser(userId);
    user.credits = Math.max(0, Math.trunc(value));
    user.lastRefill = Date.now();
    this.save();
    return user.credits;
  }

  /* ----------------------------------------------------------------- redeem */
  redeem(userId, rawCode) {
    const code = String(rawCode || '').trim().toUpperCase();
    if (!code) return { ok: false, error: 'Kode kosong.' };
    const entry = this.data.codes.find((c) => c.code.toUpperCase() === code);
    if (!entry) return { ok: false, error: 'Kode tidak ditemukan.' };
    if (!entry.active) return { ok: false, error: 'Kode sedang nonaktif.' };
    if (entry.expiresAt && entry.expiresAt < Date.now()) return { ok: false, error: 'Kode sudah kedaluwarsa.' };
    if (entry.maxClaims > 0 && entry.claimCount >= entry.maxClaims) return { ok: false, error: 'Kuota klaim kode ini habis.' };
    if (Array.isArray(entry.claimedBy) && entry.claimedBy.includes(userId)) {
      return { ok: false, error: 'Kamu sudah pernah mengklaim kode ini.' };
    }
    entry.claimCount += 1;
    if (!Array.isArray(entry.claimedBy)) entry.claimedBy = [];
    entry.claimedBy.push(userId);
    this.addCredits(userId, entry.reward);
    this.audit('Kode redeem diklaim', entry.code + ' · +' + entry.reward + ' credit', 'success', userId);
    this.save();
    return { ok: true, code: entry.code, reward: entry.reward, credits: this.credits(userId) };
  }

  /* ------------------------------------------------------------------- jobs */
  addJob(job) {
    this.data.jobs.unshift(job);
    this.data.jobs = this.data.jobs.slice(0, 200);
    this.save();
    return job;
  }

  updateJob(id, patch) {
    const job = this.data.jobs.find((j) => j.id === id);
    if (!job) return null;
    Object.assign(job, patch);
    if (Array.isArray(job.log) && job.log.length > 40) job.log = job.log.slice(-40);
    this.save();
    return job;
  }

  job(id) {
    return this.data.jobs.find((j) => j.id === id) || null;
  }

  jobsFor(userId, all = false) {
    return all ? this.data.jobs : this.data.jobs.filter((j) => j.userId === userId);
  }

  /* ------------------------------------------------------------------ codes */
  codes() {
    return this.data.codes;
  }

  createCode(input) {
    const code = String(input.code || '').trim().toUpperCase();
    if (!/^[A-Z0-9-]{4,24}$/.test(code)) throw new Error('Kode harus 4–24 karakter (A-Z, 0-9, -).');
    if (this.data.codes.some((c) => c.code === code)) throw new Error('Kode sudah ada.');
    const entry = {
      code,
      reward: Math.max(1, Math.floor(Number(input.reward) || 1)),
      maxClaims: Math.max(0, Math.floor(Number(input.maxClaims) || 0)),
      claimCount: 0,
      active: true,
      expiresAt: input.days > 0 ? Date.now() + Number(input.days) * DAY : null,
      note: String(input.note || '').slice(0, 80),
      createdAt: Date.now(),
      claimedBy: [],
    };
    this.data.codes.unshift(entry);
    this.audit('Kode redeem dibuat', code + ' · +' + entry.reward + ' credit', 'success');
    this.save();
    return entry;
  }

  updateCode(code, patch) {
    const entry = this.data.codes.find((c) => c.code.toUpperCase() === String(code).toUpperCase());
    if (!entry) return null;
    if (patch.reward != null) entry.reward = Math.max(1, Math.floor(Number(patch.reward) || 1));
    if (patch.maxClaims != null) entry.maxClaims = Math.max(0, Math.floor(Number(patch.maxClaims) || 0));
    if (patch.note != null) entry.note = String(patch.note).slice(0, 80);
    if (patch.active != null) entry.active = Boolean(patch.active);
    if (patch.days != null) {
      const days = Number(patch.days);
      entry.expiresAt = days > 0 ? Date.now() + days * DAY : null;
    }
    this.audit('Kode redeem diperbarui', entry.code, 'success');
    this.save();
    return entry;
  }

  deleteCode(code) {
    const before = this.data.codes.length;
    this.data.codes = this.data.codes.filter((c) => c.code.toUpperCase() !== String(code).toUpperCase());
    if (this.data.codes.length !== before) {
      this.audit('Kode redeem dihapus', String(code).toUpperCase(), 'warn');
      this.save();
      return true;
    }
    return false;
  }

  /* -------------------------------------------------------------- blacklist */
  isBlacklisted(userId) {
    const entry = this.data.blacklist.find((b) => b.id === userId);
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt < Date.now()) return null;
    return entry;
  }

  addBlacklist(id, reason, days) {
    if (this.data.blacklist.some((b) => b.id === id)) return null;
    const entry = {
      id,
      reason: reason || 'Melanggar ketentuan penggunaan.',
      addedAt: Date.now(),
      expiresAt: days > 0 ? Date.now() + days * DAY : null,
    };
    this.data.blacklist.unshift(entry);
    this.audit('Blacklist ditambahkan', id, 'warn');
    this.save();
    return entry;
  }

  removeBlacklist(id) {
    const before = this.data.blacklist.length;
    this.data.blacklist = this.data.blacklist.filter((b) => b.id !== id);
    if (this.data.blacklist.length !== before) {
      this.audit('Blacklist dicabut', id, 'success');
      this.save();
      return true;
    }
    return false;
  }

  /* --------------------------------------------------------------- settings */
  settings() {
    return this.data.settings;
  }

  updateSettings(patch) {
    const allowed = [
      'maxCredits', 'refillHours', 'creditsEnabled', 'maxDurationSec', 'cooldownSec',
      'maxFileMb', 'maxSourceMb', 'defaultFormat', 'defaultGetFormat', 'defaultSpeed',
      'defaultVideoQuality', 'bulkMaxLinks', 'allowDm', 'maintenance', 'maintenanceReason',
      'supportContact', 'robloxPlaceId',
    ];
    for (const key of allowed) {
      if (patch[key] === undefined) continue;
      const current = this.data.settings[key];
      if (typeof current === 'number') this.data.settings[key] = Number(patch[key]);
      else if (typeof current === 'boolean') this.data.settings[key] = Boolean(patch[key]);
      else this.data.settings[key] = String(patch[key]);
    }
    if (this.data.settings.maxCredits < 1) this.data.settings.maxCredits = 1;
    if (this.data.settings.refillHours < 0.5) this.data.settings.refillHours = 0.5;
    this.audit('Setting diperbarui', 'engine defaults & quota', 'success');
    this.save();
    return this.data.settings;
  }

  /* ------------------------------------------------------------------ audit */
  audit(action, detail, level, actor) {
    this.data.audit.unshift({
      id: crypto.randomBytes(6).toString('hex'),
      at: Date.now(),
      actor: actor || 'system',
      action,
      detail: detail || '',
      level: level || 'info',
    });
    this.data.audit = this.data.audit.slice(0, 200);
    this.save();
  }

  /* --------------------------------------------------------------- sessions */
  createSession(userId, role, name) {
    const token = crypto.randomBytes(32).toString('hex');
    this.data.sessions[token] = {
      userId,
      role,
      name,
      createdAt: Date.now(),
      expiresAt: Date.now() + 2 * HOUR,
    };
    this.purgeSessions();
    this.save();
    return token;
  }

  session(token) {
    if (!token) return null;
    const s = this.data.sessions[token];
    if (!s) return null;
    if (s.expiresAt < Date.now()) {
      delete this.data.sessions[token];
      this.save();
      return null;
    }
    return s;
  }

  destroySession(token) {
    if (token && this.data.sessions[token]) {
      delete this.data.sessions[token];
      this.save();
    }
  }

  purgeSessions() {
    const now = Date.now();
    for (const [token, s] of Object.entries(this.data.sessions)) {
      if (s.expiresAt < now) delete this.data.sessions[token];
    }
  }

  /* ------------------------------------------------------------------ stats */
  stats() {
    const jobs = this.data.jobs;
    const done = jobs.filter((j) => j.status === 'done').length;
    let cacheItems = 0;
    let cacheBytes = 0;
    try {
      for (const dir of fs.readdirSync(FILES_DIR)) {
        const full = path.join(FILES_DIR, dir);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
          for (const file of fs.readdirSync(full)) {
            cacheItems += 1;
            cacheBytes += fs.statSync(path.join(full, file)).size;
          }
        }
      }
    } catch (err) {
      /* ignore */
    }
    return {
      total: jobs.length,
      done,
      failed: jobs.filter((j) => j.status === 'failed').length,
      running: jobs.filter((j) => j.status === 'running' || j.status === 'queued').length,
      successRate: jobs.length ? Math.round((done / jobs.length) * 1000) / 10 : 0,
      users: Object.keys(this.data.users).length,
      creditsCirculating: Object.values(this.data.users).reduce((a, u) => a + (u.credits || 0), 0),
      activeCodes: this.data.codes.filter((c) => c.active).length,
      cacheItems,
      cacheMb: Math.round(cacheBytes / 1048576),
    };
  }

  /* ------------------------------------------------------------------ paths */
  static get paths() {
    return { DATA_DIR, FILES_DIR, UPLOADS_DIR, TMP_DIR, STATE_FILE };
  }
}

module.exports = { Store, DATA_DIR, FILES_DIR, UPLOADS_DIR, TMP_DIR, STATE_FILE };
