/* ANTIBYPASS V2 — UI kit: artwork, waveform, toasts, modals, dock, report overlay */
(function () {
  'use strict';

  const ABP = window.ABP;
  const U = ABP.util;
  const icon = ABP.icon;
  const ui = {};

  /* --------------------------------------------------------------- fragments */
  ui.cover = function (seed, opts) {
    const o = opts || {};
    const c = ABP.art.cover(seed);
    const r = U.rng(String(seed) + '::art');
    const cls = 'artwork' + (o.className ? ' ' + o.className : '');
    const style = 'background:' + c.bg + ';' + (o.style || '');
    const variant = Math.floor(r() * 3);
    const ringSize = 46 + Math.floor(r() * 46);
    const ringX = 18 + Math.floor(r() * 64);
    const ringY = 14 + Math.floor(r() * 60);
    const ang = Math.floor(r() * 90) - 20;
    const layers =
      '<span class="art-lines" style="--ang:' + ang + 'deg"></span>' +
      '<span class="art-ring" style="--rx:' + ringX + '%;--ry:' + ringY + '%;--rs:' + ringSize + '%"></span>' +
      (variant === 1 ? '<span class="art-orb" style="--rx:' + (100 - ringX) + '%;--ry:' + (100 - ringY) + '%"></span>' : '') +
      (variant === 2 ? '<span class="art-ring art-ring-2" style="--rx:' + ringX + '%;--ry:' + ringY + '%;--rs:' + ringSize + '%"></span>' : '');
    const inner =
      layers +
      (o.badge ? '<span class="artwork-badge">' + o.badge + '</span>' : '') +
      (o.glyph ? '<span class="artwork-glyph">' + o.glyph + '</span>' : '') +
      (o.meta ? '<span class="artwork-meta">' + U.esc(o.meta) + '</span>' : '') +
      (o.play
        ? '<button class="artwork-play" data-action="' + (o.playAction || 'noop') + '" data-id="' + U.esc(o.id || '') + '" aria-label="Putar">' +
          icon('play', 18) +
          '</button>'
        : '');
    return '<div class="' + cls + '" style="' + style + '">' + inner + '<span class="artwork-noise"></span></div>';
  };

  ui.wave = function (seed, count, progress, opts) {
    const o = opts || {};
    const bars = ABP.art.wave(seed, count || 56);
    const pct = progress == null ? 0 : progress;
    const html = bars
      .map((v, i) => {
        const h = Math.max(6, Math.round(v * 100));
        const on = (i / bars.length) * 100 <= pct;
        return '<span class="wave-bar' + (on ? ' is-on' : '') + '" style="height:' + h + '%"></span>';
      })
      .join('');
    return '<div class="wave' + (o.className ? ' ' + o.className : '') + (o.playing ? ' is-playing' : '') + '">' + html + '</div>';
  };

  ui.ring = function (value, max, size, stroke) {
    const s = size || 132;
    const sw = stroke || 9;
    const r = (s - sw) / 2;
    const c = 2 * Math.PI * r;
    const pct = max > 0 ? Math.min(1, value / max) : 0;
    const dash = c * pct;
    return (
      '<div class="ring" style="width:' + s + 'px;height:' + s + 'px">' +
      '<svg viewBox="0 0 ' + s + ' ' + s + '" width="' + s + '" height="' + s + '">' +
      '<defs><linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#ff2f63"/><stop offset="0.6" stop-color="#ff8a3d"/><stop offset="1" stop-color="#ffc247"/>' +
      '</linearGradient></defs>' +
      '<circle cx="' + s / 2 + '" cy="' + s / 2 + '" r="' + r + '" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="' + sw + '"/>' +
      '<circle cx="' + s / 2 + '" cy="' + s / 2 + '" r="' + r + '" fill="none" stroke="url(#ringGrad)" stroke-width="' + sw + '" ' +
      'stroke-linecap="round" stroke-dasharray="' + dash + ' ' + c + '" transform="rotate(-90 ' + s / 2 + ' ' + s / 2 + ')"/>' +
      '</svg>' +
      '<div class="ring-label"><strong>' + value + '</strong><span>/ ' + max + '</span></div>' +
      '</div>'
    );
  };

  ui.sparkline = function (seed, w, h, color) {
    const pts = ABP.art.spark(seed, 22, 0, 1);
    const step = w / (pts.length - 1);
    const d = pts.map((v, i) => (i === 0 ? 'M' : 'L') + (i * step).toFixed(1) + ' ' + (h - v * h).toFixed(1)).join(' ');
    const area = d + ' L' + w + ' ' + h + ' L0 ' + h + ' Z';
    const id = 'sg' + U.hash(seed).toString(36);
    return (
      '<svg class="sparkline" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" width="' + w + '" height="' + h + '">' +
      '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="' + (color || '#ff2f63') + '" stop-opacity=".35"/>' +
      '<stop offset="1" stop-color="' + (color || '#ff2f63') + '" stop-opacity="0"/>' +
      '</linearGradient></defs>' +
      '<path d="' + area + '" fill="url(#' + id + ')"/>' +
      '<path d="' + d + '" fill="none" stroke="' + (color || '#ff2f63') + '" stroke-width="1.6" stroke-linecap="round"/>' +
      '</svg>'
    );
  };

  ui.badge = function (text, tone, dot) {
    return '<span class="badge badge-' + (tone || 'muted') + '">' + (dot ? '<i class="dot"></i>' : '') + U.esc(text) + '</span>';
  };

  ui.statusPill = function (status) {
    const map = {
      done: ['Selesai', 'success'],
      running: ['Proses', 'accent'],
      queued: ['Antre', 'warn'],
      failed: ['Gagal', 'danger'],
    };
    const m = map[status] || ['—', 'muted'];
    return '<span class="pill pill-' + m[1] + '"><i class="dot"></i>' + m[0] + '</span>';
  };

  ui.typeMeta = function (type) {
    const map = {
      bypass: { label: 'Bypass', icon: 'bolt', tone: 'red' },
      get: { label: 'Fresh', icon: 'disc', tone: 'cyan' },
      video: { label: 'Video', icon: 'film', tone: 'cobalt' },
      spoof: { label: 'Spoof', icon: 'cube', tone: 'violet' },
    };
    return map[type] || map.bypass;
  };

  /* ------------------------------------------------------------------ toasts */
  ui.toast = function (opts) {
    const o = typeof opts === 'string' ? { title: opts } : opts || {};
    let root = document.getElementById('toasts');
    if (!root) {
      root = document.createElement('div');
      root.id = 'toasts';
      root.className = 'toasts';
      document.getElementById('overlay-root').appendChild(root);
    }
    const el = document.createElement('div');
    el.className = 'toast toast-' + (o.tone || 'default');
    el.innerHTML =
      '<span class="toast-icon">' + icon(o.icon || (o.tone === 'danger' ? 'alert' : o.tone === 'success' ? 'check' : 'info'), 18) + '</span>' +
      '<div class="toast-body"><strong>' + U.esc(o.title || '') + '</strong>' + (o.msg ? '<p>' + U.esc(o.msg) + '</p>' : '') + '</div>' +
      '<button class="toast-x" aria-label="Tutup">' + icon('x', 14) + '</button>';
    root.appendChild(el);
    const kill = () => {
      el.classList.add('is-out');
      setTimeout(() => el.remove(), 260);
    };
    el.querySelector('.toast-x').addEventListener('click', kill);
    setTimeout(kill, o.duration || 4200);
  };

  /* ------------------------------------------------------------------ modals */
  ui.modal = function (opts) {
    const o = opts || {};
    const root = document.getElementById('overlay-root');
    const wrap = document.createElement('div');
    wrap.className = 'modal-backdrop';
    wrap.innerHTML =
      '<div class="modal' + (o.wide ? ' modal-wide' : '') + '" role="dialog" aria-modal="true">' +
      '<header class="modal-head">' +
      '<div><p class="kicker">' + U.esc(o.kicker || 'ANTIBYPASS') + '</p><h3>' + U.esc(o.title || '') + '</h3></div>' +
      '<button class="btn btn-icon btn-ghost" data-close aria-label="Tutup">' + icon('x', 18) + '</button>' +
      '</header>' +
      (o.body ? '<div class="modal-body">' + o.body + '</div>' : '') +
      (o.footer ? '<footer class="modal-foot">' + o.footer + '</footer>' : '') +
      '</div>';
    root.appendChild(wrap);
    document.body.classList.add('is-locked');

    const close = () => {
      wrap.classList.add('is-out');
      setTimeout(() => {
        wrap.remove();
        if (!document.querySelector('.modal-backdrop')) document.body.classList.remove('is-locked');
      }, 200);
      if (o.onClose) o.onClose();
    };
    wrap.addEventListener('click', (e) => {
      if (e.target === wrap || e.target.closest('[data-close]')) close();
    });
    const onKey = (e) => {
      if (e.key === 'Escape') {
        close();
        document.removeEventListener('keydown', onKey);
      }
    };
    document.addEventListener('keydown', onKey);
    requestAnimationFrame(() => wrap.classList.add('is-in'));
    const first = wrap.querySelector('input,select,textarea,button');
    if (first && o.autofocus !== false) setTimeout(() => first.focus(), 120);
    return { close, el: wrap };
  };

  ui.confirm = function (opts) {
    return new Promise((resolve) => {
      const m = ui.modal({
        kicker: opts.kicker || 'Konfirmasi',
        title: opts.title || 'Lanjutkan?',
        body: '<p class="modal-text">' + U.esc(opts.msg || '') + '</p>',
        footer:
          '<button class="btn btn-ghost" data-close>Batal</button>' +
          '<button class="btn ' + (opts.danger ? 'btn-danger' : 'btn-primary') + '" data-confirm>' + U.esc(opts.confirmLabel || 'Ya, lanjutkan') + '</button>',
        onClose: () => resolve(false),
      });
      m.el.querySelector('[data-confirm]').addEventListener('click', () => {
        resolve(true);
        m.close();
      });
    });
  };

  /* -------------------------------------------------------------------- dock */
  let dockEl = null;

  function dockMarkup() {
    return (
      '<div class="dock" id="dock">' +
      '<div class="dock-progress"><i id="dock-progress-fill" style="width:0%"></i></div>' +
      '<div class="dock-inner" id="dock-inner"></div>' +
      '</div>'
    );
  }

  function idleDock() {
    const info = ABP.creditInfo();
    return (
      '<div class="dock-idle">' +
      '<div class="dock-mark">' + icon('bolt', 18) + '</div>' +
      '<div class="dock-idle-text"><strong>Engine idle</strong><span>Tempel link atau upload file untuk mulai.</span></div>' +
      '</div>' +
      '<div class="dock-idle-actions">' +
      '<span class="dock-credit">' + icon('wallet', 16) + ' <b>' + info.remaining + '</b><span>/' + info.max + '</span></span>' +
      '<a class="btn btn-soft btn-sm" href="#/bypass">' + icon('bolt', 15) + ' Buka Studio</a>' +
      '</div>'
    );
  }

  function jobDock(job) {
    const done = job.status === 'done';
    const failed = job.status === 'failed';
    const meta = ui.typeMeta(job.type);
    const fmt = ABP.FORMATS[job.format] || ABP.FORMATS.ogg;
    return (
      '<div class="dock-job">' +
      ui.cover(job.artworkSeed, { className: 'dock-cover' }) +
      '<div class="dock-info">' +
      '<div class="dock-title">' + U.esc(job.title) + '</div>' +
      '<div class="dock-sub">' +
      '<span class="dock-type tone-' + meta.tone + '">' + icon(meta.icon, 13) + meta.label + '</span>' +
      '<span class="dock-dot"></span>' +
      '<span>' + (done ? fmt.label + ' · ' + U.bytes(job.sizeBytes) : failed ? 'Dibatalkan' : U.esc(job.stageLabel)) + '</span>' +
      (job.type === 'bypass' && done ? '<span class="dock-dot dock-ps-dot"></span><span class="mono dock-ps">PlaybackSpeed ' + job.playbackSpeed + '</span>' : '') +
      '</div>' +
      '</div>' +
      '<div class="dock-mid">' +
      (done ? ui.wave(job.artworkSeed, 64, 100, { className: 'wave-dock' }) : ui.wave(job.artworkSeed, 64, job.progress, { className: 'wave-dock', playing: !failed })) +
      '</div>' +
      '<div class="dock-actions">' +
      (done
        ? '<button class="btn btn-primary btn-sm" data-action="open-report" data-id="' + job.id + '">' + icon('expand', 15) + ' Laporan</button>'
        : failed
        ? '<button class="btn btn-soft btn-sm" data-action="close-dock">' + icon('x', 15) + ' Tutup</button>'
        : '<button class="btn btn-icon btn-ghost" data-action="cancel-job" data-id="' + job.id + '" aria-label="Batalkan">' + icon('x', 16) + '</button>' +
          '<button class="btn btn-icon btn-ghost" data-action="open-report" data-id="' + job.id + '" aria-label="Perbesar">' + icon('expand', 16) + '</button>') +
      '</div>' +
      '</div>'
    );
  }

  ui.renderDock = function () {
    const root = document.getElementById('dock-root');
    if (!dockEl) {
      root.innerHTML = dockMarkup();
      dockEl = document.getElementById('dock');
    }
    const job = ABP.engine.activeJob();
    const inner = document.getElementById('dock-inner');
    if (!job) {
      inner.innerHTML = idleDock();
      dockEl.classList.remove('is-active');
      const fill = document.getElementById('dock-progress-fill');
      if (fill) fill.style.width = '0%';
      return;
    }
    inner.innerHTML = jobDock(job);
    dockEl.classList.add('is-active');
    const fill = document.getElementById('dock-progress-fill');
    if (fill) fill.style.width = job.progress + '%';
  };

  ui.updateDockProgress = function () {
    const job = ABP.engine.activeJob();
    if (!job) return;
    const fill = document.getElementById('dock-progress-fill');
    if (fill) fill.style.width = job.progress + '%';
    const titleEl = document.querySelector('.dock-title');
    if (titleEl) titleEl.textContent = job.title;
    const subEl = document.querySelector('.dock-sub');
    if (subEl && job.status === 'running') {
      const spans = subEl.querySelectorAll('span');
      if (spans[2]) spans[2].textContent = job.stageLabel;
    }
  };

  /* ----------------------------------------------------------- report overlay */
  let reportJobId = null;

  ui.openReport = function (jobId) {
    const job = ABP.state.jobs.find((j) => j.id === jobId);
    if (!job) return;
    reportJobId = jobId;
    const root = document.getElementById('overlay-root');
    const existing = document.getElementById('report-overlay');
    if (existing) existing.remove();
    const el = document.createElement('div');
    el.id = 'report-overlay';
    el.className = 'report-overlay';
    el.innerHTML = reportMarkup(job);
    root.appendChild(el);
    document.body.classList.add('is-locked');
    requestAnimationFrame(() => el.classList.add('is-in'));
    el.addEventListener('click', (e) => {
      if (e.target === el || e.target.closest('[data-close-report]')) ui.closeReport();
    });
  };

  ui.closeReport = function () {
    const el = document.getElementById('report-overlay');
    if (!el) return;
    el.classList.remove('is-in');
    setTimeout(() => {
      el.remove();
      if (!document.querySelector('.modal-backdrop')) document.body.classList.remove('is-locked');
    }, 240);
    reportJobId = null;
  };

  function reportMarkup(job) {
    const done = job.status === 'done';
    const failed = job.status === 'failed';
    const fmt = ABP.FORMATS[job.format] || ABP.FORMATS.ogg;
    const meta = ui.typeMeta(job.type);
    const stages = ABP.engine.stages(job.type);
    const stageIdx = stages.findIndex((s) => s.key === job.stage);
    const pct = job.progress;
    const logLines = (job.log || []).slice(-9);
    const bitrate = fmt.bitrate ? fmt.bitrate + ' kbps' : 'Lossless';
    const sampleRate = job.format === 'opus' ? '48 kHz' : '44.1 kHz';

    return (
      '<div class="report-panel">' +
      '<header class="report-head">' +
      '<div class="report-head-left"><span class="report-kicker">' + icon('wave', 14) + ' ENGINE REPORT · ' + meta.label.toUpperCase() + '</span>' +
      '<h2>' + (done ? 'Siap dipakai di Studio.' : failed ? 'Job dibatalkan.' : 'Sedang diproses.') + '</h2></div>' +
      '<button class="btn btn-icon btn-ghost" data-close-report aria-label="Tutup">' + icon('minimize', 20) + '</button>' +
      '</header>' +
      '<div class="report-body">' +
      '<div class="report-art">' +
      ui.cover(job.artworkSeed, { className: 'report-cover' }) +
      '<div class="report-art-meta">' +
      '<p class="kicker">OUTPUT</p>' +
      '<h3>' + U.esc(job.title) + '</h3>' +
      '<p class="muted">' + U.esc(job.source || 'upload lokal') + '</p>' +
      '<div class="report-chips">' +
      ui.badge(fmt.label, 'gold') +
      ui.badge(job.speed + '×', 'accent') +
      ui.badge(job.engine.toUpperCase(), 'muted') +
      '</div>' +
      '</div>' +
      (done
        ? '<div class="report-speed">' +
          '<p class="kicker">SET DI ROBLOX STUDIO</p>' +
          '<div class="speed-value"><div class="speed-meta"><span>Sound.PlaybackSpeed</span><strong id="report-speed">' + job.playbackSpeed + '</strong></div>' +
          '<button class="btn btn-icon btn-soft" data-action="copy-speed" data-value="' + job.playbackSpeed + '" aria-label="Copy">' + icon('copy', 15) + '</button></div>' +
          '<p class="report-hint">Tempel ke properti Sound → nilai ini mengembalikan pitch & tempo asli.</p>' +
          '</div>'
        : '<div class="report-live">' +
          '<div class="report-live-num"><strong>' + pct + '</strong><span>%</span></div>' +
          '<div class="report-live-label">' + U.esc(job.stageLabel) + '</div>' +
          ui.wave(job.artworkSeed, 72, pct, { className: 'wave-report', playing: true }) +
          '</div>') +
      '</div>' +
      '<div class="report-side">' +
      '<div class="report-stages">' +
      stages
        .map((s, i) => {
          const state = done ? 'is-done' : i < stageIdx ? 'is-done' : i === stageIdx ? 'is-live' : '';
          return '<div class="stage ' + state + '"><span class="stage-dot">' + (done || i < stageIdx ? icon('check', 11) : i === stageIdx ? '<i></i>' : '') + '</span><span>' + s.label + '</span></div>';
        })
        .join('') +
      '</div>' +
      '<div class="report-console"><div class="console-head">' + icon('terminal', 13) + ' engine.log</div><div class="console-body">' +
      (logLines.length
        ? logLines.map((l) => '<div class="console-line"><span>' + new Date(l.t).toLocaleTimeString('id-ID', { hour12: false }) + '</span>' + U.esc(l.line) + '</div>').join('')
        : '<div class="console-line"><span>--:--:--</span>menunggu log…</div>') +
      '</div></div>' +
      (done
        ? '<div class="report-facts">' +
          '<div><span>Format</span><b>' + fmt.label + ' · ' + bitrate + '</b></div>' +
          '<div><span>Sample rate</span><b>' + sampleRate + '</b></div>' +
          '<div><span>Durasi output</span><b>' + U.dur(job.outputDurationSec || job.durationSec) + '</b></div>' +
          '<div><span>Ukuran</span><b>' + U.bytes(job.sizeBytes) + '</b></div>' +
          '<div><span>Checksum</span><b class="mono">' + (job.checksum || '—').slice(0, 16) + '</b></div>' +
          '<div><span>Waktu proses</span><b>' + ((job.finishedAt - job.createdAt) / 1000).toFixed(1) + 's</b></div>' +
          '</div>' +
          '<div class="report-cta">' +
          '<button class="btn btn-primary" data-action="demo-download" data-id="' + job.id + '">' + icon('download', 16) + ' Unduh ' + fmt.label + '</button>' +
          '<button class="btn btn-ghost" data-action="download-report" data-id="' + job.id + '">' + icon('folder', 16) + ' Laporan .txt</button>' +
          '</div>'
        : '<div class="report-cta"><button class="btn btn-ghost" data-action="cancel-job" data-id="' + job.id + '">' + icon('x', 16) + ' Batalkan job</button></div>') +
      '</div>' +
      '</div>' +
      '</div>'
    );
  }

  ui.refreshReport = function () {
    if (!reportJobId) return;
    const job = ABP.state.jobs.find((j) => j.id === reportJobId);
    const el = document.getElementById('report-overlay');
    if (!job || !el) return;
    el.innerHTML = reportMarkup(job);
  };

  /* ------------------------------------------------------------- command menu */
  ui.commandPalette = function () {
    const routes = [
      { label: 'Beranda', desc: 'Overview & aktivitas', href: '#/home', icon: 'home' },
      { label: 'Studio Bypass', desc: 'Convert audio Roblox', href: '#/bypass', icon: 'bolt' },
      { label: 'Spoof Assets', desc: 'Roblox asset spoofer', href: '#/spoof', icon: 'cube' },
      { label: 'Fresh Master', desc: 'Download audio original', href: '#/get', icon: 'disc' },
      { label: 'Clean Video', desc: 'Video tanpa watermark', href: '#/video', icon: 'film' },
      { label: 'Kredit & Redeem', desc: 'Kuota, bonus, voucher', href: '#/credits', icon: 'wallet' },
      { label: 'Riwayat', desc: 'Semua job', href: '#/history', icon: 'clock' },
      { label: 'Panel Admin', desc: 'Owner & admin only', href: '#/admin', icon: 'shield' },
    ];
    const m = ui.modal({
      kicker: 'Quick jump',
      title: 'Ke mana kita?',
      body:
        '<div class="palette"><input class="input palette-input" id="palette-input" placeholder="Cari halaman atau tool…" autocomplete="off" />' +
        '<div class="palette-list" id="palette-list">' +
        routes.map((r) => '<a class="palette-item" href="' + r.href + '" data-label="' + U.esc(r.label.toLowerCase() + ' ' + r.desc.toLowerCase()) + '">' +
          '<span class="palette-ico">' + icon(r.icon, 18) + '</span><span><b>' + r.label + '</b><small>' + r.desc + '</small></span>' +
          icon('arrowRight', 16) + '</a>').join('') +
        '</div></div>',
      footer: '<span class="muted tiny">Tekan <kbd class="kbd">Esc</kbd> untuk menutup</span>',
      autofocus: false,
    });
    const input = m.el.querySelector('#palette-input');
    setTimeout(() => input.focus(), 60);
    input.addEventListener('input', () => {
      const q = input.value.toLowerCase().trim();
      m.el.querySelectorAll('.palette-item').forEach((a) => {
        a.style.display = !q || a.dataset.label.includes(q) ? '' : 'none';
      });
    });
    m.el.addEventListener('click', (e) => {
      if (e.target.closest('.palette-item')) m.close();
    });
  };

  ABP.ui = ui;
})();
