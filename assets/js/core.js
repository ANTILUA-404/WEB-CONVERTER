/* ANTIBYPASS V2 — core: utilities, state, artwork, simulated engine, auth */
(function () {
  'use strict';

  const ABP = (window.ABP = window.ABP || {});

  /* ------------------------------------------------------------------ utils */
  const U = {};

  U.hash = function (str) {
    let h = 2166136261;
    const s = String(str || '');
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };

  U.rng = function (seed) {
    let a = typeof seed === 'number' ? seed : U.hash(seed);
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  U.pick = function (arr, seed) {
    const r = U.rng(seed)();
    return arr[Math.floor(r * arr.length) % arr.length];
  };

  U.clamp = function (n, min, max) {
    return Math.min(max, Math.max(min, Number(n) || 0));
  };

  U.uid = function (prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  };

  U.esc = function (str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  U.bytes = function (n) {
    if (!Number.isFinite(n) || n <= 0) return '—';
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1048576).toFixed(1) + ' MB';
  };

  U.dur = function (sec) {
    if (!Number.isFinite(sec) || sec <= 0) return '—';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m + ':' + String(s).padStart(2, '0');
  };

  U.num = function (n, d) {
    return Number(n).toFixed(d == null ? 0 : d);
  };

  U.ago = function (ts) {
    if (!ts) return '—';
    const diff = Date.now() - ts;
    if (diff < 60000) return 'baru saja';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' menit lalu';
    if (diff < 86400000) return Math.floor(diff / 3600000) + ' jam lalu';
    if (diff < 604800000) return Math.floor(diff / 86400000) + ' hari lalu';
    return new Date(ts).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
  };

  U.date = function (ts) {
    if (!ts) return '—';
    return new Date(ts).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  U.dateTime = function (ts) {
    if (!ts) return '—';
    return new Date(ts).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  U.countdown = function (ms) {
    if (ms == null) return 'penuh';
    if (ms <= 0) return 'sebentar lagi';
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    if (h > 0) return h + 'j ' + String(m).padStart(2, '0') + 'm';
    if (m > 0) return m + 'm ' + String(s).padStart(2, '0') + 's';
    return s + 's';
  };

  U.playbackSpeed = function (speed) {
    if (Math.abs(speed - 1) < 1e-9) return '1';
    return String(Math.trunc((1 / speed) * 10000) / 10000);
  };

  U.speedLabel = function (speed) {
    return String(Number(Number(speed).toFixed(4)));
  };

  U.parseTimecode = function (v) {
    if (typeof v !== 'string' || !v.trim()) return null;
    const parts = v.trim().split(':');
    if (parts.length < 2 || parts.length > 3) return null;
    if (parts.some((p) => !/^\d+(\.\d+)?$/.test(p))) return null;
    const n = parts.map(Number);
    return n.length === 2 ? n[0] * 60 + n[1] : n[0] * 3600 + n[1] * 60 + n[2];
  };

  U.debounce = function (fn, wait) {
    let t;
    return function () {
      const args = arguments;
      clearTimeout(t);
      t = setTimeout(() => fn.apply(null, args), wait);
    };
  };

  U.copy = async function (text) {
    try {
      await navigator.clipboard.writeText(String(text));
      return true;
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = String(text);
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try {
        ok = document.execCommand('copy');
      } catch (err) {
        ok = false;
      }
      document.body.removeChild(ta);
      return ok;
    }
  };

  U.download = function (filename, text) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  ABP.util = U;

  /* ------------------------------------------------------------------- bus */
  const listeners = {};
  ABP.bus = {
    on(evt, fn) {
      (listeners[evt] = listeners[evt] || []).push(fn);
      return () => {
        listeners[evt] = (listeners[evt] || []).filter((f) => f !== fn);
      };
    },
    emit(evt, data) {
      (listeners[evt] || []).forEach((fn) => {
        try {
          fn(data);
        } catch (e) {
          console.error(e);
        }
      });
    },
  };

  /* ----------------------------------------------------------------- artwork */
  const PALETTE = [
    { h: 344, s: 82, name: 'crimson' },
    { h: 18, s: 88, name: 'ember' },
    { h: 42, s: 84, name: 'gold' },
    { h: 168, s: 62, name: 'jade' },
    { h: 196, s: 78, name: 'cyan' },
    { h: 222, s: 74, name: 'cobalt' },
    { h: 268, s: 70, name: 'violet' },
    { h: 306, s: 66, name: 'magenta' },
  ];

  function cover(seed, opts) {
    const r = U.rng(seed);
    const base = PALETTE[Math.floor(r() * PALETTE.length)];
    const alt = PALETTE[Math.floor(r() * PALETTE.length)];
    const h1 = base.h;
    const h2 = (base.h + 40 + Math.floor(r() * 120)) % 360;
    const h3 = alt.h;
    const angle = Math.floor(r() * 360);
    const ox = 20 + Math.floor(r() * 55);
    const oy = 10 + Math.floor(r() * 50);
    const bg = [
      'radial-gradient(90% 90% at ' + ox + '% ' + oy + '%, hsl(' + h1 + ' 88% 58% / .95) 0%, transparent 62%)',
      'radial-gradient(80% 80% at ' + (100 - ox) + '% ' + (100 - oy) + '%, hsl(' + h2 + ' 92% 52% / .82) 0%, transparent 66%)',
      'conic-gradient(from ' + angle + 'deg at 50% 50%, hsl(' + h3 + ' 62% 18%) 0deg, hsl(' + h1 + ' 55% 12%) 140deg, hsl(' + h2 + ' 60% 14%) 260deg, hsl(' + h3 + ' 62% 18%) 360deg)',
    ].join(', ');
    return { bg, hue: h1, hue2: h2, seed: String(seed) };
  }

  function wave(seed, n) {
    const r = U.rng(seed);
    const out = [];
    const phase = r() * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const env = 0.45 + 0.55 * Math.sin(Math.PI * Math.min(1, Math.max(0, t * 1.12 - 0.02)));
      const v = 0.28 + 0.72 * Math.abs(Math.sin(t * 14 + phase) * Math.cos(t * 7.5 + phase * 1.7)) * (0.55 + r() * 0.45);
      out.push(Math.max(0.1, Math.min(1, v * env + 0.08)));
    }
    return out;
  }

  function spark(seed, n, min, max) {
    const r = U.rng(seed);
    const pts = [];
    let v = 0.5;
    for (let i = 0; i < n; i++) {
      v = Math.max(0.05, Math.min(0.95, v + (r() - 0.45) * 0.34));
      pts.push(min + v * (max - min));
    }
    return pts;
  }

  ABP.art = { cover, wave, spark, PALETTE };

  /* ------------------------------------------------------------------ state */
  const KEY = 'antibypass.v2.state';
  const HOUR = 3600000;

  const TRACKS = [
    'Rick Astley — Never Gonna Give You Up',
    'The Weeknd — Blinding Lights',
    'Tame Impala — The Less I Know The Better',
    'Daft Punk — Instant Crush',
    'NIKI — Every Summertime',
    'Joji — Glimpse of Us',
    'Frank Ocean — Pink + White',
    'Men I Trust — Show Me How',
    'Pamungkas — To the Bone',
    'Hindia — Evaluasi',
    'Coldplay — Sparks',
    'Mac DeMarco — Chamber of Reflection',
    'Daniel Caesar — Best Part',
    'Arctic Monkeys — 505',
  ];

  const VIDEOS = [
    'Neon Night Drive — 4K Clean Master',
    'Sunset Rooftop Session — Reels',
    'Studio Session — Behind The Mix',
    'City Lights Timelapse — 2160p',
    'Analog Film Test — No Watermark',
    'Late Night Set — Full Take',
  ];

  const SPOOFS = [
    'Walk Cycle — Animation',
    'Idle Breathing — Animation',
    'Emote Dance — Catalog',
    'Gun Reload — Animation',
    'Sound Effect Pack — Audio',
    'MeshPart Armor — Model',
  ];

  function defaults() {
    const now = Date.now();
    return {
      version: 2,
      createdAt: now,
      credits: { remaining: 19, max: 25, refillHours: 6, lastRefill: now - 47 * 60000 },
      jobs: seedJobs(now),
      activeJobId: null,
      codes: seedCodes(now),
      blacklist: seedBlacklist(now),
      users: seedUsers(now),
      settings: {
        maxCredits: 25,
        refillHours: 6,
        creditsEnabled: true,
        maxDurationSec: 0,
        cooldownSec: 30,
        maxFileMb: 25,
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
        robloxCookie: '',
        robloxApiKey: '',
        robloxGroupId: '',
        robloxPlaceId: '',
      },
      audit: seedAudit(now),
      session: null,
      prefs: { railCollapsed: false, lastRoute: '#/home' },
    };
  }

  function seedJobs(now) {
    const rows = [
      { type: 'bypass', title: 'The Weeknd — Blinding Lights', format: 'ogg', speed: 2.3, ago: 12, status: 'done', dur: 200 },
      { type: 'get', title: 'NIKI — Every Summertime', format: 'flac', speed: 1, ago: 38, status: 'done', dur: 208 },
      { type: 'video', title: 'Neon Night Drive — 4K Clean Master', format: 'mp4', speed: 1, ago: 74, status: 'done', dur: 42 },
      { type: 'spoof', title: 'Walk Cycle — Animation #507766388', format: 'rbxm', speed: 1, ago: 96, status: 'done', dur: 0 },
      { type: 'bypass', title: 'Tame Impala — The Less I Know The Better', format: 'mp3', speed: 2.3, ago: 150, status: 'done', dur: 216 },
      { type: 'get', title: 'Joji — Glimpse of Us', format: 'wav', speed: 1, ago: 220, status: 'done', dur: 192 },
      { type: 'bypass', title: 'Mac DeMarco — Chamber of Reflection', format: 'ogg', speed: 2.5, ago: 300, status: 'failed', dur: 0 },
      { type: 'video', title: 'Sunset Rooftop Session — Reels', format: 'mp4', speed: 1, ago: 420, status: 'done', dur: 28 },
    ];
    return rows.map((r, i) => {
      const size = r.status === 'failed' ? 0 : Math.round((r.format === 'wav' ? 1411 : r.format === 'flac' ? 900 : 256) * 1000 * r.dur / 8);
      return {
        id: 'job_seed_' + i,
        type: r.type,
        title: r.title,
        source: 'https://example.com/' + r.type + '/' + i,
        format: r.format,
        speed: r.speed,
        pitch: 1,
        gain: -2,
        preset: 'default',
        status: r.status,
        progress: 100,
        stage: r.status === 'done' ? 'done' : 'convert',
        stageLabel: r.status === 'done' ? 'Selesai' : 'Dibatalkan',
        createdAt: now - r.ago * 60000,
        finishedAt: now - r.ago * 60000 + 9000,
        durationSec: r.dur,
        sizeBytes: size,
        playbackSpeed: U.playbackSpeed(r.speed),
        engine: r.type === 'bypass' ? 'rubberband' : 'native',
        artworkSeed: r.title + r.type,
        log: [],
      };
    });
  }

  function seedCodes(now) {
    return [
      { code: 'VIP2026', reward: 15, maxClaims: 50, claimCount: 23, active: true, expiresAt: now + 6 * 86400000, createdAt: now - 86400000, note: 'Launch event V2', claimedBy: [] },
      { code: 'ABV2-FREE-10', reward: 10, maxClaims: 0, claimCount: 118, active: true, expiresAt: null, createdAt: now - 3 * 86400000, note: 'Public drop', claimedBy: [] },
      { code: 'ANTILUA-GOLD', reward: 50, maxClaims: 10, claimCount: 10, active: true, expiresAt: null, createdAt: now - 9 * 86400000, note: 'Owner private', claimedBy: [] },
      { code: 'WEEKEND-5', reward: 5, maxClaims: 100, claimCount: 41, active: false, expiresAt: now - 86400000, createdAt: now - 12 * 86400000, note: 'Weekend promo', claimedBy: [] },
    ];
  }

  function seedBlacklist(now) {
    return [
      { id: '418223910447261706', reason: 'Spam request & abuse endpoint', addedAt: now - 5 * 86400000, expiresAt: null },
      { id: '729104883301559296', reason: 'Bulk scraping antrean', addedAt: now - 2 * 86400000, expiresAt: now + 5 * 86400000 },
    ];
  }

  function seedUsers(now) {
    return [
      { id: 'owner', name: 'xelzlovecean', tag: '@xelzlovecean_33932', role: 'owner', credits: 25, tier: 'owner', lastSeen: now - 60000 },
      { id: '901223311022334455', name: 'rizkyaditya', tag: '@rizky.dev', role: 'member', credits: 18, tier: 'premium', lastSeen: now - 400000 },
      { id: '774019283746556612', name: 'nadya.prm', tag: '@nadya', role: 'member', credits: 7, tier: 'free', lastSeen: now - 900000 },
      { id: '612038475612039485', name: 'bagas_ss', tag: '@bagas', role: 'admin', credits: 25, tier: 'free', lastSeen: now - 3600000 },
      { id: '509182736455091827', name: 'kevinnn', tag: '@kevin', role: 'member', credits: 0, tier: 'free', lastSeen: now - 7200000 },
    ];
  }

  function seedAudit(now) {
    return [
      { id: 'a1', at: now - 12 * 60000, actor: 'owner', action: 'Setting diperbarui', detail: 'default_speed → 2.3', level: 'info' },
      { id: 'a2', at: now - 46 * 60000, actor: 'owner', action: 'Kode redeem dibuat', detail: 'VIP2026 · +15 credit · 50 klaim', level: 'success' },
      { id: 'a3', at: now - 2 * 3600000, actor: 'bagas_ss', action: 'Blacklist ditambahkan', detail: '418223910447261706', level: 'warn' },
      { id: 'a4', at: now - 5 * 3600000, actor: 'system', action: 'Cache dibersihkan', detail: '412 item · 286 MB dibebaskan', level: 'info' },
      { id: 'a5', at: now - 9 * 3600000, actor: 'owner', action: 'Maintenance dimatikan', detail: 'Kembali normal untuk publik', level: 'success' },
    ];
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaults();
      const parsed = JSON.parse(raw);
      const base = defaults();
      const merged = Object.assign({}, base, parsed);
      merged.settings = Object.assign({}, base.settings, parsed.settings || {});
      merged.credits = Object.assign({}, base.credits, parsed.credits || {});
      merged.prefs = Object.assign({}, base.prefs, parsed.prefs || {});
      if (!Array.isArray(merged.jobs) || !merged.jobs.length) merged.jobs = base.jobs;
      if (!Array.isArray(merged.codes)) merged.codes = base.codes;
      if (!Array.isArray(merged.blacklist)) merged.blacklist = base.blacklist;
      if (!Array.isArray(merged.users)) merged.users = base.users;
      if (!Array.isArray(merged.audit)) merged.audit = base.audit;
      return merged;
    } catch (e) {
      return defaults();
    }
  }

  const state = load();
  ABP.state = state;

  ABP.save = function () {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      /* storage full or blocked */
    }
  };

  ABP.resetState = function () {
    const fresh = defaults();
    Object.keys(state).forEach((k) => delete state[k]);
    Object.assign(state, fresh);
    ABP.save();
  };

  ABP.refill = function () {
    const c = state.credits;
    const interval = (state.settings.refillHours || 6) * HOUR;
    const now = Date.now();
    if (c.remaining >= state.settings.maxCredits) {
      c.lastRefill = now;
      return 0;
    }
    const elapsed = now - c.lastRefill;
    if (elapsed < interval) return 0;
    const gain = Math.floor(elapsed / interval);
    const before = c.remaining;
    c.remaining = Math.min(state.settings.maxCredits, c.remaining + gain);
    c.lastRefill = now - (elapsed % interval);
    ABP.save();
    return c.remaining - before;
  };

  ABP.creditInfo = function () {
    ABP.refill();
    const c = state.credits;
    const max = state.settings.maxCredits;
    const interval = (state.settings.refillHours || 6) * HOUR;
    const bonus = Math.max(0, c.remaining - max);
    const nextRefillMs = c.remaining >= max ? null : Math.max(0, c.lastRefill + interval - Date.now());
    return { remaining: c.remaining, max, bonus, nextRefillMs };
  };

  ABP.consumeCredit = function (n) {
    const amount = n == null ? 1 : n;
    const c = state.credits;
    if (!state.settings.creditsEnabled) return true;
    if (c.remaining < amount) return false;
    const wasAtOrAbove = c.remaining >= state.settings.maxCredits;
    c.remaining -= amount;
    if (wasAtOrAbove && c.remaining < state.settings.maxCredits) c.lastRefill = Date.now();
    ABP.save();
    return true;
  };

  ABP.addCredit = function (n) {
    const c = state.credits;
    c.remaining = Math.max(0, c.remaining + Math.trunc(n));
    ABP.save();
    return c.remaining;
  };

  ABP.audit = function (action, detail, level, actor) {
    state.audit.unshift({
      id: U.uid('a'),
      at: Date.now(),
      actor: actor || (ABP.auth && ABP.auth.session() ? ABP.auth.session().user : 'guest'),
      action,
      detail: detail || '',
      level: level || 'info',
    });
    state.audit = state.audit.slice(0, 60);
    ABP.save();
  };

  /* ------------------------------------------------------------------- auth */
  const ACCOUNTS = [
    { user: 'owner', pass: 'antibypass', role: 'owner', name: 'xelzlovecean', tag: '@xelzlovecean_33932' },
    { user: 'admin', pass: 'admin123', role: 'admin', name: 'Studio Admin', tag: '@studio.admin' },
  ];

  const SESSION_TTL = 2 * HOUR;

  ABP.auth = {
    accounts: ACCOUNTS,
    login(user, pass) {
      const found = ACCOUNTS.find(
        (a) => a.user.toLowerCase() === String(user || '').trim().toLowerCase() && a.pass === String(pass || '')
      );
      if (!found) return null;
      const session = {
        user: found.user,
        role: found.role,
        name: found.name,
        tag: found.tag,
        issuedAt: Date.now(),
        expiresAt: Date.now() + SESSION_TTL,
      };
      state.session = session;
      ABP.save();
      ABP.audit('Login panel admin', found.user + ' · role ' + found.role, 'success', found.user);
      return session;
    },
    session() {
      const s = state.session;
      if (!s) return null;
      if (!s.expiresAt || s.expiresAt < Date.now()) {
        state.session = null;
        ABP.save();
        return null;
      }
      return s;
    },
    logout() {
      if (state.session) ABP.audit('Logout panel admin', state.session.user, 'info', state.session.user);
      state.session = null;
      ABP.save();
    },
    isOwner() {
      const s = ABP.auth.session();
      return Boolean(s && s.role === 'owner');
    },
    can(cap) {
      const s = ABP.auth.session();
      if (!s) return false;
      if (s.role === 'owner') return true;
      return !['owner-only'].includes(cap);
    },
  };

  /* -------------------------------------------------------------- format map */
  ABP.FORMATS = {
    mp3: { label: 'MP3', ext: 'mp3', bitrate: 320, kind: 'lossy' },
    ogg: { label: 'OGG', ext: 'ogg', bitrate: 256, kind: 'lossy' },
    wav: { label: 'WAV', ext: 'wav', bitrate: null, kind: 'lossless' },
    flac: { label: 'FLAC', ext: 'flac', bitrate: null, kind: 'lossless' },
    m4a: { label: 'M4A', ext: 'm4a', bitrate: 256, kind: 'lossy' },
    aac: { label: 'AAC', ext: 'aac', bitrate: 256, kind: 'lossy' },
    opus: { label: 'OPUS', ext: 'opus', bitrate: 192, kind: 'lossy' },
    wma: { label: 'WMA', ext: 'wma', bitrate: 192, kind: 'lossy' },
    mp4: { label: 'MP4', ext: 'mp4', bitrate: null, kind: 'video' },
    rbxm: { label: 'RBXM', ext: 'rbxm', bitrate: null, kind: 'asset' },
  };

  ABP.PRESETS = [
    { key: 'default', label: 'Default', desc: 'Tanpa perubahan ekstra', speed: 2.3, gain: -2 },
    { key: 'crisp', label: 'Crisp', desc: 'Normalize + buang silence', speed: 2.3, gain: 0 },
    { key: 'bass', label: 'Bass', desc: 'Low-end lebih tebal', speed: 2.3, gain: 2 },
    { key: 'loud', label: 'Loud', desc: 'Loudnorm agresif', speed: 2.3, gain: 3 },
    { key: 'nightcore', label: 'Nightcore', desc: 'Speed & pitch 1.25×', speed: 1.25, gain: 0 },
    { key: 'slowed', label: 'Slowed', desc: 'Speed & pitch 0.85×', speed: 0.85, gain: 0 },
    { key: 'fresh', label: 'Fresh', desc: 'Original 1.0× master', speed: 1, gain: 0 },
  ];

  ABP.PLATFORMS = [
    { key: 'youtube', label: 'YouTube', match: /youtu\.?be/i, tone: 'red' },
    { key: 'tiktok', label: 'TikTok', match: /tiktok|douyin/i, tone: 'cyan' },
    { key: 'instagram', label: 'Instagram', match: /instagram|instagr\.am/i, tone: 'violet' },
    { key: 'spotify', label: 'Spotify', match: /spotify/i, tone: 'jade' },
    { key: 'soundcloud', label: 'SoundCloud', match: /soundcloud/i, tone: 'ember' },
    { key: 'twitter', label: 'X / Twitter', match: /twitter|x\.com/i, tone: 'cobalt' },
    { key: 'roblox', label: 'Roblox', match: /roblox|rbxassetid/i, tone: 'red' },
    { key: 'bilibili', label: 'Bilibili', match: /bilibili|b23\.tv/i, tone: 'cyan' },
    { key: 'reddit', label: 'Reddit', match: /reddit/i, tone: 'ember' },
    { key: 'facebook', label: 'Facebook', match: /facebook|fb\.watch/i, tone: 'cobalt' },
  ];

  ABP.detectPlatform = function (url) {
    const s = String(url || '');
    return ABP.PLATFORMS.find((p) => p.match.test(s)) || null;
  };

  /* ------------------------------------------------------------------ engine */
  const STAGE_SETS = {
    bypass: [
      { key: 'queue', label: 'Menunggu slot antrean', weight: 0.05 },
      { key: 'resolve', label: 'Membuka & memverifikasi sumber', weight: 0.15 },
      { key: 'download', label: 'Mengunduh stream terbaik', weight: 0.28 },
      { key: 'probe', label: 'Analisis integritas media', weight: 0.12 },
      { key: 'convert', label: 'DSP conversion · rubberband', weight: 0.28 },
      { key: 'upload', label: 'Menyiapkan hasil & laporan', weight: 0.12 },
    ],
    get: [
      { key: 'queue', label: 'Menunggu slot antrean', weight: 0.05 },
      { key: 'resolve', label: 'Membuka & memverifikasi sumber', weight: 0.16 },
      { key: 'download', label: 'Mengunduh master stream', weight: 0.32 },
      { key: 'probe', label: 'Membaca metadata & bitrate', weight: 0.14 },
      { key: 'convert', label: 'Menulis master tanpa re-encode', weight: 0.21 },
      { key: 'upload', label: 'Menyiapkan hasil & laporan', weight: 0.12 },
    ],
    video: [
      { key: 'queue', label: 'Menunggu slot antrean', weight: 0.05 },
      { key: 'resolve', label: 'Memilih clean stream', weight: 0.16 },
      { key: 'download', label: 'Mengunduh video tanpa watermark', weight: 0.38 },
      { key: 'probe', label: 'Verifikasi resolusi & fps', weight: 0.12 },
      { key: 'convert', label: 'Remux lossless + faststart', weight: 0.17 },
      { key: 'upload', label: 'Menyiapkan hasil', weight: 0.12 },
    ],
    spoof: [
      { key: 'queue', label: 'Menunggu slot antrean', weight: 0.06 },
      { key: 'resolve', label: 'Place-context discovery', weight: 0.2 },
      { key: 'download', label: 'Mengunduh asset asli', weight: 0.26 },
      { key: 'probe', label: 'Membaca chunk RBXM', weight: 0.14 },
      { key: 'convert', label: 'Deep chunk spoof & repack', weight: 0.24 },
      { key: 'upload', label: 'Menyiapkan file .rbxm', weight: 0.1 },
    ],
  };

  const LOG_LINES = {
    queue: ['job accepted · menunggu worker', 'worker slot tersedia'],
    resolve: ['resolving source url', 'mengikuti redirect', 'metadata ditemukan'],
    download: ['membuka stream', 'chunk diterima', 'buffering ke temp'],
    probe: ['ffprobe · membaca header', 'durasi & bitrate terverifikasi'],
    convert: ['ffmpeg · filter graph dibangun', 'rubberband pitch/tempo', 'menulis output'],
    upload: ['menghitung checksum', 'laporan disiapkan'],
  };

  const engine = {
    running: new Map(),
    listeners: [],

    stages(type) {
      return STAGE_SETS[type] || STAGE_SETS.bypass;
    },

    activeJob() {
      return state.jobs.find((j) => j.id === state.activeJobId) || null;
    },

    /**
     * Demo engine: mensimulasikan pipeline (queue → resolve → download → probe →
     * convert → upload) di browser. Untuk produksi, ganti isi method ini dengan
     * pemanggilan API, mis:
     *   POST /api/jobs            -> { id }
     *   GET  /api/jobs/:id        -> { status, progress, stage, result }
     *   GET  /api/jobs/:id/file   -> file audio/video
     * dan biarkan UI memakai objek job dengan bentuk yang sama.
     */
    run(payload) {
      const type = payload.type || 'bypass';
      const stages = this.stages(type);
      const job = {
        id: U.uid('job'),
        type,
        title: payload.title || 'Menganalisis sumber…',
        source: payload.source || '',
        format: payload.format || (type === 'bypass' ? 'ogg' : type === 'video' ? 'mp4' : type === 'spoof' ? 'rbxm' : 'mp3'),
        speed: payload.speed == null ? (type === 'bypass' ? 2.3 : 1) : payload.speed,
        pitch: payload.pitch == null ? 1 : payload.pitch,
        gain: payload.gain == null ? -2 : payload.gain,
        preset: payload.preset || 'default',
        status: 'running',
        progress: 0,
        stage: stages[0].key,
        stageLabel: stages[0].label,
        createdAt: Date.now(),
        finishedAt: null,
        durationSec: payload.durationSec || 0,
        sizeBytes: 0,
        playbackSpeed: U.playbackSpeed(payload.speed == null ? (type === 'bypass' ? 2.3 : 1) : payload.speed),
        engine: type === 'bypass' ? 'rubberband' : 'native',
        artworkSeed: payload.artworkSeed || payload.title || payload.source || type,
        log: [],
        placeId: payload.placeId || '',
        assetType: payload.assetType || '',
        quality: payload.quality || '',
      };
      state.jobs.unshift(job);
      state.jobs = state.jobs.slice(0, 60);
      state.activeJobId = job.id;
      ABP.save();
      ABP.bus.emit('job:start', job);

      const total = 5200 + U.rng(job.id)() * 4200 + (type === 'video' ? 2200 : 0);
      let elapsed = 0;
      let lastStage = stages[0].key;

      const timer = setInterval(() => {
        elapsed += 140;
        const t = Math.min(1, elapsed / total);
        const eased = t < 0.94 ? t : 0.94 + (t - 0.94) * 0.9;
        job.progress = Math.round(eased * 100);

        let acc = 0;
        let idx = 0;
        for (let i = 0; i < stages.length; i++) {
          acc += stages[i].weight;
          if (eased <= acc) {
            idx = i;
            break;
          }
          idx = i;
        }
        job.stage = stages[idx].key;
        job.stageLabel = stages[idx].label;

        if (job.stage !== lastStage) {
          lastStage = job.stage;
          (LOG_LINES[job.stage] || []).forEach((line, i) => {
            job.log.push({ t: Date.now(), line: line, delay: i * 260 });
          });
        }

        if (job.title === 'Menganalisis sumber…' && job.progress > 18) {
          job.title = this.resolveTitle(job);
          job.artworkSeed = job.title + job.id;
        }

        if (t >= 1) {
          clearInterval(timer);
          this.finish(job);
          return;
        }
        ABP.bus.emit('job:tick', job);
      }, 140);

      this.running.set(job.id, timer);
      return job;
    },

    resolveTitle(job) {
      const seed = job.source || job.id;
      if (job.type === 'video') return U.pick(VIDEOS, seed);
      if (job.type === 'spoof') {
        const base = U.pick(SPOOFS, seed);
        const id = String(100000000 + (U.hash(seed) % 899999999));
        return base + ' #' + id;
      }
      return U.pick(TRACKS, seed);
    },

    finish(job) {
      const r = U.rng(job.id);
      job.status = 'done';
      job.progress = 100;
      job.stage = 'done';
      job.stageLabel = 'Selesai';
      job.finishedAt = Date.now();
      job.durationSec = job.durationSec || Math.round(150 + r() * 160);
      const fmt = ABP.FORMATS[job.format] || ABP.FORMATS.ogg;
      const bitrate = fmt.bitrate || (job.format === 'wav' ? 1411 : 900);
      const outDur = job.type === 'video' ? Math.round(18 + r() * 40) : job.durationSec / (job.speed || 1);
      job.outputDurationSec = outDur;
      job.sizeBytes = Math.round((bitrate * 1000 * outDur) / 8);
      job.playbackSpeed = U.playbackSpeed(job.speed);
      job.engine = job.type === 'bypass' ? (Math.abs(job.speed - 1) > 0.001 ? 'rubberband' : 'resample') : 'native';
      job.checksum = U.hash(job.id + job.title).toString(16).padStart(8, '0') + U.hash(job.title).toString(16).padStart(8, '0');
      job.log.push({ t: Date.now(), line: '✔ selesai · ' + job.sizeBytes + ' bytes' });

      if (state.settings.creditsEnabled && job.type !== 'spoof') ABP.consumeCredit(1);
      ABP.save();
      ABP.bus.emit('job:done', job);
    },

    cancel(jobId) {
      const timer = this.running.get(jobId);
      if (timer) clearInterval(timer);
      this.running.delete(jobId);
      const job = state.jobs.find((j) => j.id === jobId);
      if (job && job.status === 'running') {
        job.status = 'failed';
        job.stageLabel = 'Dibatalkan';
        job.finishedAt = Date.now();
        ABP.save();
        ABP.bus.emit('job:cancel', job);
      }
    },

    rerun(jobId) {
      const job = state.jobs.find((j) => j.id === jobId);
      if (!job) return null;
      return this.run({
        type: job.type,
        title: 'Menganalisis sumber…',
        source: job.source,
        format: job.format,
        speed: job.speed,
        preset: job.preset,
        quality: job.quality,
      });
    },
  };

  ABP.engine = engine;

  ABP.stats = function () {
    const done = state.jobs.filter((j) => j.status === 'done');
    const success = state.jobs.length ? Math.round((done.length / state.jobs.length) * 1000) / 10 : 0;
    return {
      total: state.jobs.length,
      done: done.length,
      successRate: success,
      avgMs: 8400,
      queueActive: engine.running.size,
      concurrency: 4,
      cacheItems: 412,
      cacheMb: 286,
    };
  };

  ABP.isMaintenance = function () {
    return Boolean(state.settings.maintenance);
  };

  ABP.refill();
})();
