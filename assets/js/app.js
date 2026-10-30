/* ANTIBYPASS V2 — app shell, router, public views */
(function () {
  'use strict';

  const ABP = window.ABP;
  const U = ABP.util;
  const icon = ABP.icon;
  const ui = ABP.ui;
  const esc = U.esc;

  const NAV = [
    { group: 'Workspace', items: [
      { href: '#/home', label: 'Beranda', icon: 'home' },
      { href: '#/bypass', label: 'Studio Bypass', icon: 'bolt', tag: 'HOT' },
      { href: '#/spoof', label: 'Spoof Assets', icon: 'cube' },
      { href: '#/get', label: 'Fresh Master', icon: 'disc' },
      { href: '#/video', label: 'Clean Video', icon: 'film' },
      { href: '#/history', label: 'Riwayat', icon: 'clock' },
    ]},
    { group: 'Akun', items: [
      { href: '#/credits', label: 'Kredit & Redeem', icon: 'wallet' },
      { href: '#/admin', label: 'Panel Admin', icon: 'shield', admin: true },
    ]},
  ];

  const TITLES = {
    '#/home': 'Beranda',
    '#/bypass': 'Studio Bypass',
    '#/spoof': 'Spoof Assets',
    '#/get': 'Fresh Master',
    '#/video': 'Clean Video',
    '#/credits': 'Kredit & Redeem',
    '#/history': 'Riwayat',
    '#/admin': 'Panel Admin',
  };

  const app = {};
  let currentRoute = '#/home';
  let lastCompleted = null;

  /* ------------------------------------------------------------------ shell */
  function brandMark(size) {
    const s = size || 36;
    return (
      '<span class="brand-mark" style="width:' + s + 'px;height:' + s + 'px">' +
      '<svg viewBox="0 0 40 40" width="' + s + '" height="' + s + '" aria-hidden="true">' +
      '<defs><linearGradient id="bm" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#ff2f63"/><stop offset=".55" stop-color="#ff6a3d"/><stop offset="1" stop-color="#ffc247"/>' +
      '</linearGradient></defs>' +
      '<rect width="40" height="40" rx="11" fill="url(#bm)"/>' +
      '<path d="M22.6 7.6 12.4 22.4h7.1l-1.7 10 10.2-15.2h-7z" fill="#0a0a0d"/>' +
      '</svg></span>'
    );
  }

  function renderRail() {
    const session = ABP.auth.session();
    const info = ABP.creditInfo();
    const nav = NAV.map((g) => {
      const items = g.items
        .map((it) => {
          const locked = it.admin && !session;
          return (
            '<a class="nav-item' + (it.admin ? ' nav-admin' : '') + '" href="' + it.href + '" data-nav="' + it.href + '" title="' + it.label + '">' +
            '<span class="nav-ico">' + icon(it.icon, 19) + '</span>' +
            '<span class="nav-label">' + it.label + '</span>' +
            (it.tag ? '<span class="nav-tag">' + it.tag + '</span>' : '') +
            (locked ? '<span class="nav-lock">' + icon('lock', 13) + '</span>' : '') +
            '</a>'
          );
        })
        .join('');
      return '<div class="nav-group"><p class="nav-group-title">' + g.group + '</p>' + items + '</div>';
    }).join('');

    document.getElementById('rail').innerHTML =
      '<a class="rail-brand" href="#/home">' +
      brandMark(38) +
      '<span class="rail-brand-text"><strong>ANTIBYPASS<sup>V2</sup></strong><small>powered by ANTILUA</small></span>' +
      '</a>' +
      '<nav class="rail-nav">' + nav + '</nav>' +
      '<div class="rail-foot">' +
      '<div class="engine-card">' +
      '<div class="engine-row"><span class="engine-dot' + (ABP.isMaintenance() ? ' is-warn' : '') + '"></span>' +
      '<b>' + (ABP.isMaintenance() ? 'Maintenance' : 'Engine online') + '</b></div>' +
      '<div class="engine-meta"><span>' + ABP.engine.running.size + ' job aktif</span><span>' + info.remaining + '/' + info.max + ' kredit</span></div>' +
      '<div class="engine-bar"><i style="width:' + Math.min(100, (info.remaining / info.max) * 100) + '%"></i></div>' +
      '</div>' +
      '<div class="rail-user">' +
      '<span class="avatar">' + (session ? esc(session.name.slice(0, 1).toUpperCase()) : 'G') + '</span>' +
      '<span class="rail-user-text"><b>' + (session ? esc(session.name) : 'Guest user') + '</b>' +
      '<small>' + (session ? (session.role === 'owner' ? 'Owner' : 'Admin') + ' session' : 'Free tier') + '</small></span>' +
      (session
        ? '<a class="btn btn-icon btn-ghost btn-xs" href="#/admin" aria-label="Panel">' + icon('settings', 15) + '</a>'
        : '<a class="btn btn-soft btn-xs" href="#/admin">Masuk</a>') +
      '</div>' +
      '</div>';
  }

  function renderTopbar() {
    const info = ABP.creditInfo();
    const session = ABP.auth.session();
    document.getElementById('topbar').innerHTML =
      '<div class="top-left">' +
      '<button class="btn btn-icon btn-ghost only-mobile" data-action="toggle-rail" aria-label="Menu">' + icon('menu', 20) + '</button>' +
      '<div class="hist-nav">' +
      '<button class="btn btn-icon btn-ghost" data-action="hist-back" aria-label="Kembali">' + icon('arrowLeft', 18) + '</button>' +
      '<button class="btn btn-icon btn-ghost" data-action="hist-forward" aria-label="Maju">' + icon('arrowRight', 18) + '</button>' +
      '</div>' +
      '<span class="top-title" id="top-title">Beranda</span>' +
      '</div>' +
      '<form class="search" id="global-search" role="search">' +
      '<span class="search-ico">' + icon('search', 17) + '</span>' +
      '<input id="search-input" type="search" placeholder="Cari job, atau tempel link…" autocomplete="off" />' +
      '<kbd class="kbd search-kbd">/</kbd>' +
      '</form>' +
      '<div class="top-right">' +
      (ABP.isMaintenance() ? ui.badge('MAINTENANCE', 'warn', true) : '<span class="top-live">' + icon('activity', 14) + ' LIVE</span>') +
      '<a class="credit-chip" href="#/credits" title="Kredit">' +
      '<span class="credit-ring" style="--p:' + Math.min(100, (info.remaining / info.max) * 100) + '%"></span>' +
      '<b>' + info.remaining + '</b>' +
      (info.bonus > 0 ? '<span class="credit-bonus">+' + info.bonus + '</span>' : '<span>/' + info.max + '</span>') +
      '</a>' +
      '<button class="btn btn-icon btn-ghost" data-action="notifications" aria-label="Notifikasi">' + icon('gift', 18) + '</button>' +
      '<button class="avatar-btn" data-action="profile" aria-label="Profil">' + (session ? esc(session.name.slice(0, 1).toUpperCase()) : 'G') + '</button>' +
      '</div>';
    const form = document.getElementById('global-search');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = document.getElementById('search-input').value.trim();
      ABP.searchQuery = q;
      location.hash = '#/history';
      if (location.hash === '#/history') app.render();
    });
  }

  function renderBanner() {
    const root = document.getElementById('banner-root');
    if (!ABP.isMaintenance()) {
      root.innerHTML = '';
      return;
    }
    root.innerHTML =
      '<div class="maint-banner"><span class="maint-ico">' + icon('alert', 16) + '</span>' +
      '<div><b>Mode maintenance aktif.</b> ' + esc(ABP.state.settings.maintenanceReason) + '</div>' +
      '<a href="#/admin" class="btn btn-xs btn-soft">Panel</a></div>';
  }

  function renderMobileNav() {
    const items = [
      { href: '#/home', label: 'Home', icon: 'home' },
      { href: '#/bypass', label: 'Bypass', icon: 'bolt' },
      { href: '#/video', label: 'Video', icon: 'film' },
      { href: '#/credits', label: 'Kredit', icon: 'wallet' },
      { href: '#/admin', label: 'Admin', icon: 'shield' },
    ];
    document.getElementById('mobile-nav').innerHTML = items
      .map((i) => '<a href="' + i.href + '" data-nav="' + i.href + '" title="' + i.label + '">' + icon(i.icon, 20) + '<span>' + i.label + '</span></a>')
      .join('');
  }

  function syncNav() {
    document.querySelectorAll('[data-nav]').forEach((a) => {
      a.classList.toggle('is-active', a.dataset.nav === currentRoute);
    });
    const t = document.getElementById('top-title');
    if (t) t.textContent = TITLES[currentRoute] || 'ANTIBYPASS';
  }

  /* ------------------------------------------------------------------ router */
  function route() {
    const overlay = document.getElementById('report-overlay');
    if (overlay) overlay.remove();
    document.querySelectorAll('.modal-backdrop').forEach((m) => m.remove());
    document.body.classList.remove('is-locked');
    const hash = location.hash || '#/home';
    const clean = hash.split('?')[0];
    currentRoute = TITLES[clean] ? clean : '#/home';
    ABP.state.prefs.lastRoute = currentRoute;
    ABP.save();
    renderBanner();
    syncNav();
    const view = document.getElementById('view');
    view.classList.remove('view-enter');
    if (clean === '#/admin') {
      ABP.renderAdmin(view);
    } else {
      const fn = VIEWS[clean] || VIEWS['#/home'];
      view.innerHTML = fn();
      bind(clean);
    }
    void view.offsetWidth;
    view.classList.add('view-enter');
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
    document.title = (TITLES[currentRoute] || 'Beranda') + ' · ANTIBYPASS V2';
  }

  /* ------------------------------------------------------------------ pieces */
  function pageHead(o) {
    return (
      '<header class="page-head">' +
      '<div class="page-head-text">' +
      '<p class="kicker">' + esc(o.kicker || 'ANTIBYPASS V2') + '</p>' +
      '<h1 class="page-title">' + o.title + '</h1>' +
      '<p class="page-desc">' + o.desc + '</p>' +
      '</div>' +
      (o.aside ? '<div class="page-head-aside">' + o.aside + '</div>' : '') +
      '</header>'
    );
  }

  function toolCard(t) {
    return (
      '<a class="tool-card tone-' + t.tone + '" href="' + t.href + '">' +
      '<span class="tool-ghost">' + icon(t.icon, 96) + '</span>' +
      '<div class="tool-top"><span class="tool-icon">' + icon(t.icon, 22) + '</span>' +
      '<span class="tool-arrow">' + icon('arrowRight', 16) + '</span></div>' +
      '<h3>' + t.title + '</h3>' +
      '<p>' + t.desc + '</p>' +
      '<div class="tool-tags">' + t.tags.map((x) => '<span>' + x + '</span>').join('') + '</div>' +
      '</a>'
    );
  }

  function infoStrip(items) {
    return '<div class="info-strip">' + items.map((i) =>
      '<div class="info-cell">' + icon(i.icon, 18) + '<div><b>' + i.t + '</b><p>' + i.d + '</p></div></div>'
    ).join('') + '</div>';
  }

  function jobCard(job) {
    const meta = ui.typeMeta(job.type);
    return (
      '<article class="media-card" data-action="open-report" data-id="' + job.id + '">' +
      '<div class="media-cover">' + ui.cover(job.artworkSeed, { play: true, playAction: 'open-report', id: job.id }) +
      '<span class="media-type tone-' + meta.tone + '">' + icon(meta.icon, 12) + meta.label + '</span></div>' +
      '<h4>' + esc(job.title) + '</h4>' +
      '<p>' + (ABP.FORMATS[job.format] || { label: job.format }).label +
      (job.type === 'bypass' ? ' · ' + job.speed + '× · PS ' + job.playbackSpeed : '') + '</p>' +
      '</article>'
    );
  }

  /* -------------------------------------------------------------------- home */
  const VIEWS = {};

  VIEWS['#/home'] = function () {
    const info = ABP.creditInfo();
    const stats = ABP.stats();
    const recent = ABP.state.jobs.slice(0, 8);
    const session = ABP.auth.session();

    const hero =
      '<section class="hero">' +
      '<div class="hero-grid"></div>' +
      '<div class="hero-glow"></div>' +
      '<div class="hero-content">' +
      '<span class="hero-kicker"><i class="dot-live"></i> ROBLOX AUDIO ENGINE · V2 ' + (ABP.isMaintenance() ? '· MAINTENANCE' : '· ONLINE') + '</span>' +
      '<h1>Bypass the<br/><span class="grad">limit.</span></h1>' +
      '<p class="hero-sub">Convert audio untuk Roblox Studio, spoof asset, tarik master audio, dan unduh video clean — semua dalam satu engine. Presisi <b>PlaybackSpeed</b> sampai 4 desimal.</p>' +
      '<div class="hero-actions">' +
      '<a class="btn btn-primary btn-lg" href="#/bypass">' + icon('bolt', 18) + ' Mulai Bypass</a>' +
      '<a class="btn btn-glass btn-lg" href="#/history">' + icon('clock', 18) + ' Riwayat job</a>' +
      '</div>' +
      '<div class="hero-meta">' +
      '<span>' + icon('check', 14) + ' 30+ platform</span>' +
      '<span>' + icon('check', 14) + ' rubberband DSP</span>' +
      '<span>' + icon('check', 14) + ' tanpa watermark</span>' +
      '</div>' +
      '</div>' +
      '<div class="hero-art" aria-hidden="true">' +
      '<div class="vinyl"></div>' +
      '<div class="cover-stack">' +
      '<div class="stack-card s3">' + ui.cover('hero-3', { meta: 'ABV2 · 003' }) + '</div>' +
      '<div class="stack-card s2">' + ui.cover('hero-2', { meta: 'ABV2 · 002' }) + '</div>' +
      '<div class="stack-card s1">' + ui.cover('hero-1', { meta: 'ABV2 · 001' }) + '</div>' +
      '</div>' +
      '<div class="float-chip chip-speed"><span>Sound.PlaybackSpeed</span><b>0.4347</b></div>' +
      '<div class="float-chip chip-fmt"><span class="dot-live"></span> OGG · 256 kbps</div>' +
      '<div class="float-chip chip-eq">' + ui.wave('hero-eq', 26, 100, { className: 'wave-mini' }) + '</div>' +
      '</div>' +
      '</section>';

    const statCards =
      '<div class="stat-grid">' +
      [
        { k: 'Job diproses', v: stats.done + stats.queueActive, d: 'total sesi ini', spark: 's1', color: '#ff2f63' },
        { k: 'Success rate', v: stats.total ? stats.successRate + '%' : '—', d: stats.total ? '30 hari terakhir' : 'belum ada job', spark: 's2', color: '#3ddc97' },
        { k: 'Rata-rata proses', v: '8.4s', d: 'queue → upload', spark: 's3', color: '#4fd1ff' },
        { k: 'Kredit tersisa', v: info.remaining + '/' + info.max, d: info.bonus ? '+' + info.bonus + ' bonus overflow' : 'recovery +1 / ' + ABP.state.settings.refillHours + ' jam', spark: 's4', color: '#e8c77d' },
      ]
        .map(
          (s) =>
            '<div class="stat"><div class="stat-top"><span>' + s.k + '</span>' + ui.sparkline(s.spark, 72, 26, s.color) + '</div>' +
            '<strong>' + s.v + '</strong><small>' + s.d + '</small></div>'
        )
        .join('') +
      '</div>';

    const tools =
      '<section class="section">' +
      '<div class="section-head"><h2>Toolkit</h2><a class="link-more" href="#/history">Semua aktivitas ' + icon('arrowRight', 14) + '</a></div>' +
      '<div class="tool-grid">' +
      toolCard({ href: '#/bypass', icon: 'bolt', tone: 'red', title: 'Studio Bypass', desc: 'Convert audio + laporan PlaybackSpeed siap tempel di Roblox Studio.', tags: ['OGG / MP3 / FLAC', 'rubberband'] }) +
      toolCard({ href: '#/spoof', icon: 'cube', tone: 'violet', title: 'Asset Spoofer', desc: 'Animasi, model, audio → file .rbxm dengan deep chunk spoof.', tags: ['Deep binary', 'Auto place'] }) +
      toolCard({ href: '#/get', icon: 'disc', tone: 'cyan', title: 'Fresh Master', desc: 'Tarik lagu utuh 1.0× kualitas studio, 320 kbps sampai lossless.', tags: ['320 kbps', 'FLAC / WAV'] }) +
      toolCard({ href: '#/video', icon: 'film', tone: 'cobalt', title: 'Clean Video', desc: 'Video resolusi tertinggi tanpa watermark, remux lossless.', tags: ['2160p', 'No watermark'] }) +
      '</div>' +
      '</section>';

    const recentShelf =
      '<section class="section">' +
      '<div class="section-head"><h2>Terakhir diproses</h2>' +
      '<div class="section-tools"><a class="link-more" href="#/history">Lihat semua ' + icon('arrowRight', 14) + '</a></div></div>' +
      '<div class="shelf">' + recent.map(jobCard).join('') + '</div>' +
      '</section>';

    const presets =
      '<section class="section">' +
      '<div class="section-head"><h2>Preset suara</h2><span class="muted tiny">Sekali klik, langsung kepakai di Studio</span></div>' +
      '<div class="preset-grid">' +
      ABP.PRESETS.filter((p) => p.key !== 'fresh')
        .map(
          (p) =>
            '<button class="preset-card" data-action="use-preset" data-preset="' + p.key + '">' +
            '<div class="preset-wave">' + ui.wave('preset-' + p.key, 30, 100, { className: 'wave-mini' }) + '</div>' +
            '<div><b>' + p.label + '</b><small>' + p.desc + '</small></div>' +
            '<span class="preset-speed">' + p.speed + '×</span>' +
            '</button>'
        )
        .join('') +
      '</div>' +
      '</section>';

    const access =
      '<section class="section">' +
      '<div class="access-band">' +
      '<div class="access-copy"><p class="kicker">AKSES</p><h2>' + (session ? 'Kamu masuk sebagai ' + esc(session.name) + '.' : 'Unlimited itu enak.') + '</h2>' +
      '<p>' + (session ? 'Panel owner & admin sudah terbuka. Kelola kode redeem, blacklist, dan engine dari satu tempat.' : 'Free tier dapat 25 kredit dengan recovery otomatis. Premium membuka bypass tanpa cooldown dan antrean prioritas.') + '</p>' +
      '<div class="access-actions">' +
      (session
        ? '<a class="btn btn-primary" href="#/admin">' + icon('shield', 16) + ' Buka Control Center</a>'
        : '<a class="btn btn-primary" href="#/credits">' + icon('gift', 16) + ' Klaim kode redeem</a><a class="btn btn-ghost" href="#/admin">' + icon('lock', 16) + ' Login admin</a>') +
      '</div></div>' +
      '<div class="access-cards">' +
      '<div class="mini-tier"><span>FREE</span><b>25</b><small>kredit / 6 jam recovery</small></div>' +
      '<div class="mini-tier is-hot"><span>PREMIUM</span><b>∞</b><small>tanpa cooldown · prioritas</small></div>' +
      '</div>' +
      '</div>' +
      '</section>';

    return hero + statCards + tools + recentShelf + presets + access;
  };

  /* ------------------------------------------------------------------ bypass */
  const bypassState = { tab: 'link', url: '', file: null, format: 'ogg', speed: 2.3, pitch: 1, gain: -2, preset: 'default', normalize: false, silence: false, trimStart: '', trimEnd: '', name: '', jobId: null };

  function bypassPreview() {
    const fmt = ABP.FORMATS[bypassState.format] || ABP.FORMATS.ogg;
    const ps = U.playbackSpeed(bypassState.speed);
    const estDur = 204 / (bypassState.speed || 1);
    const estSize = Math.round(((fmt.bitrate || 900) * 1000 * estDur) / 8);
    const title = bypassState.file ? bypassState.file.name : bypassState.url ? (ABP.detectPlatform(bypassState.url) || { label: 'Sumber' }).label + ' stream' : 'Output preview';
    return (
      '<div class="preview-card" id="bypass-preview">' +
      '<div class="preview-head"><span class="kicker">OUTPUT PREVIEW</span>' + ui.badge('LIVE', 'accent', true) + '</div>' +
      '<div class="preview-art">' + ui.cover(bypassState.url || (bypassState.file && bypassState.file.name) || 'preview', { className: 'preview-cover' }) +
      '<div class="preview-art-info"><h3>' + esc(title) + '</h3><p>' + fmt.label + ' · ' + (fmt.bitrate ? fmt.bitrate + ' kbps' : 'lossless') + ' · 44.1 kHz</p></div>' +
      '</div>' +
      '<div class="ps-block">' +
      '<div class="ps-label"><span>Sound.PlaybackSpeed</span><button class="copy-btn" data-action="copy-speed" data-value="' + ps + '">' + icon('copy', 14) + '</button></div>' +
      '<div class="ps-value">' + ps + '</div>' +
      '<p class="ps-hint">' + (Math.abs(bypassState.speed - 1) < 0.001 ? 'Audio original 1.0× — tidak perlu kompensasi.' : 'Set properti Sound di Roblox ke nilai ini untuk mengembalikan pitch & tempo.') + '</p>' +
      '</div>' +
      '<div class="preview-facts">' +
      '<div><span>Engine</span><b>' + (Math.abs(bypassState.speed - 1) < 0.001 ? 'RESAMPLE' : 'RUBBERBAND') + '</b></div>' +
      '<div><span>Speed</span><b>' + bypassState.speed + '×</b></div>' +
      '<div><span>Pitch</span><b>' + (bypassState.pitch * bypassState.speed).toFixed(2) + '×</b></div>' +
      '<div><span>Gain</span><b>' + bypassState.gain + ' dB</b></div>' +
      '<div><span>Durasi est.</span><b>' + U.dur(estDur) + '</b></div>' +
      '<div><span>Ukuran est.</span><b>' + U.bytes(estSize) + '</b></div>' +
      '</div>' +
      '<button class="btn btn-primary btn-block btn-lg" data-action="run-bypass">' + icon('bolt', 18) + ' Proses sekarang <span class="btn-cost">1 kredit</span></button>' +
      '<p class="preview-note">' + icon('info', 13) + (ABP.live ? ' Engine aktif — file asli diproses yt-dlp + ffmpeg.' : ' Demo engine — hasil & file disimulasikan di browser.') + '</p>' +
      '</div>'
    );
  }

  function bypassResult(job) {
    const fmt = ABP.FORMATS[job.format] || ABP.FORMATS.ogg;
    return (
      '<div class="preview-card is-result" id="bypass-preview">' +
      '<div class="preview-head"><span class="kicker">HASIL</span>' + ui.badge('SUKSES', 'success', true) + '</div>' +
      '<div class="result-check">' + icon('check', 22) + '</div>' +
      '<h3 class="result-title">' + esc(job.title) + '</h3>' +
      '<p class="result-sub">' + fmt.label + ' · ' + U.bytes(job.sizeBytes) + ' · ' + U.dur(job.outputDurationSec) + '</p>' +
      '<div class="ps-block is-compact">' +
      '<div class="ps-label"><span>Sound.PlaybackSpeed</span><button class="copy-btn" data-action="copy-speed" data-value="' + job.playbackSpeed + '">' + icon('copy', 14) + '</button></div>' +
      '<div class="ps-value">' + job.playbackSpeed + '</div>' +
      '</div>' +
      '<div class="result-actions">' +
      '<button class="btn btn-primary btn-block" data-action="demo-download" data-id="' + job.id + '">' + icon('download', 16) + ' Unduh ' + fmt.label + '</button>' +
      '<button class="btn btn-ghost btn-block" data-action="open-report" data-id="' + job.id + '">' + icon('expand', 16) + ' Lihat laporan lengkap</button>' +
      '<button class="btn btn-ghost btn-block" data-action="reset-bypass">' + icon('refresh', 16) + ' Proses file lain</button>' +
      '</div>' +
      '</div>'
    );
  }

  VIEWS['#/bypass'] = function () {
    const fmtKeys = ['ogg', 'mp3', 'wav', 'flac', 'm4a', 'aac', 'opus', 'wma'];
    const job = lastCompleted ? ABP.state.jobs.find((j) => j.id === lastCompleted) : null;

    const left =
      '<div class="stack">' +
      '<section class="panel">' +
      '<div class="panel-head"><div><p class="kicker">STEP 01</p><h3>Sumber audio</h3></div>' +
      '<div class="segmented" id="source-tabs">' +
      '<button class="seg is-active" data-tab="link">' + icon('link', 15) + ' Link</button>' +
      '<button class="seg" data-tab="file">' + icon('upload', 15) + ' Upload</button>' +
      '</div></div>' +
      '<div class="panel-body">' +
      '<div id="pane-link">' +
      '<label class="field-label" for="bypass-url">Tempel link media</label>' +
      '<div class="input-row">' +
      '<div class="input-wrap"><span class="input-ico">' + icon('link', 16) + '</span>' +
      '<input class="input" id="bypass-url" placeholder="https://youtu.be/…  ·  tiktok  ·  spotify  ·  soundcloud" value="' + esc(bypassState.url) + '" />' +
      '<span class="platform-detect" id="platform-detect"></span></div>' +
      '<button class="btn btn-soft" data-action="paste-url">' + icon('copy', 16) + ' Paste</button>' +
      '</div>' +
      '<div class="hint-row">' + ['YouTube', 'TikTok', 'Instagram', 'Spotify', 'SoundCloud', 'X', 'Reddit'].map((p) => '<span class="mini-chip">' + p + '</span>').join('') + '</div>' +
      '</div>' +
      '<div id="pane-file" hidden>' +
      '<div class="dropzone" id="dropzone" tabindex="0">' +
      '<span class="dz-ico">' + icon('upload', 22) + '</span>' +
      '<b>Drop file audio di sini</b><small>atau klik untuk pilih · mp3, wav, ogg, flac, m4a (maks 500 MB)</small>' +
      '<input type="file" id="file-input" accept="audio/*,.mp3,.wav,.ogg,.flac,.m4a" hidden />' +
      '</div>' +
      '<div class="file-chip" id="file-chip" hidden></div>' +
      '</div>' +
      '</div>' +
      '</section>' +

      '<section class="panel">' +
      '<div class="panel-head"><div><p class="kicker">STEP 02</p><h3>Format & karakter</h3></div><span class="muted tiny">8 format</span></div>' +
      '<div class="panel-body">' +
      '<label class="field-label">Format output</label>' +
      '<div class="chips" id="format-chips">' +
      fmtKeys.map((k) => {
        const f = ABP.FORMATS[k];
        return '<button class="chip' + (k === bypassState.format ? ' is-active' : '') + '" data-format="' + k + '">' + f.label +
          '<small>' + (f.bitrate ? f.bitrate + 'k' : 'lossless') + '</small></button>';
      }).join('') +
      '</div>' +

      '<div class="slider-row">' +
      '<div class="slider-head"><label class="field-label" for="speed">Kecepatan konversi</label>' +
      '<output class="slider-out" id="speed-out">' + bypassState.speed + '×</output></div>' +
      '<input type="range" class="range" id="speed" min="0.5" max="3" step="0.05" value="' + bypassState.speed + '" />' +
      '<div class="range-ticks"><span>0.5×</span><span>1×</span><span>2.3×</span><span>3×</span></div>' +
      '<p class="field-hint">Default 2.3× — PlaybackSpeed kompensasi = <b class="mono" id="ps-inline">' + U.playbackSpeed(bypassState.speed) + '</b></p>' +
      '</div>' +

      '<div class="slider-pair">' +
      '<div class="slider-row"><div class="slider-head"><label class="field-label" for="pitch">Pitch</label><output class="slider-out" id="pitch-out">' + bypassState.pitch + '×</output></div>' +
      '<input type="range" class="range" id="pitch" min="0.5" max="2" step="0.05" value="' + bypassState.pitch + '" /></div>' +
      '<div class="slider-row"><div class="slider-head"><label class="field-label" for="gain">Gain</label><output class="slider-out" id="gain-out">' + bypassState.gain + ' dB</output></div>' +
      '<input type="range" class="range" id="gain" min="-20" max="10" step="1" value="' + bypassState.gain + '" /></div>' +
      '</div>' +

      '<label class="field-label">Preset karakter</label>' +
      '<div class="chips chips-wrap" id="preset-chips">' +
      ABP.PRESETS.map((p) => '<button class="chip' + (p.key === bypassState.preset ? ' is-active' : '') + '" data-preset="' + p.key + '">' + p.label + '</button>').join('') +
      '</div>' +

      '<details class="advanced">' +
      '<summary>' + icon('sliders', 15) + ' Opsi lanjutan <span class="muted tiny">trim · normalisasi · nama file</span></summary>' +
      '<div class="advanced-body">' +
      '<div class="field-grid">' +
      '<div><label class="field-label" for="trim-start">Trim mulai</label><input class="input" id="trim-start" placeholder="0:10" value="' + esc(bypassState.trimStart) + '" /></div>' +
      '<div><label class="field-label" for="trim-end">Trim akhir</label><input class="input" id="trim-end" placeholder="1:30" value="' + esc(bypassState.trimEnd) + '" /></div>' +
      '</div>' +
      '<label class="field-label" for="custom-name">Nama file output</label>' +
      '<input class="input" id="custom-name" placeholder="otomatis dari judul" value="' + esc(bypassState.name) + '" />' +
      '<div class="toggle-row"><div><b>Normalisasi loudness</b><small>loudnorm I=-14 · TP=-1</small></div>' +
      '<button class="switch' + (bypassState.normalize ? ' is-on' : '') + '" data-toggle="normalize" aria-pressed="' + bypassState.normalize + '"><i></i></button></div>' +
      '<div class="toggle-row"><div><b>Buang silence awal</b><small>silenceremove 0.15s</small></div>' +
      '<button class="switch' + (bypassState.silence ? ' is-on' : '') + '" data-toggle="silence" aria-pressed="' + bypassState.silence + '"><i></i></button></div>' +
      '</div>' +
      '</details>' +
      '</div>' +
      '</section>' +
      '</div>';

    return (
      pageHead({
        kicker: 'STUDIO · AUDIO BYPASS',
        title: 'Studio Bypass',
        desc: 'Convert audio apa pun ke format Roblox-ready, lalu salin nilai <b>Sound.PlaybackSpeed</b> yang presisi sampai 4 desimal.',
        aside: '<div class="head-badges">' + ui.badge('RUBBERBAND', 'gold') + ui.badge('44.1 kHz', 'muted') + (ABP.live ? ui.badge('LIVE ENGINE', 'success', true) : ui.badge('DEMO ENGINE', 'accent')) + '</div>',
      }) +
      '<div class="layout-2">' + left + '<aside class="sticky-col">' + (job && job.status === 'done' ? bypassResult(job) : bypassPreview()) + '</aside></div>' +
      infoStrip([
        { icon: 'sparkles', t: 'Presisi 4 desimal', d: 'PlaybackSpeed dihitung dari 1/speed lalu dipotong, bukan dibulatkan — sama seperti referensi.' },
        { icon: 'cpu', t: 'Engine adaptif', d: 'Rubberband untuk pitch/tempo kompleks, resample untuk kasus yang lebih sederhana.' },
        { icon: 'download', t: 'Auto-fit ukuran', d: 'Bitrate turun otomatis kalau hasil melebihi batas upload yang dipilih.' },
      ])
    );
  };

  /* ------------------------------------------------------------------- spoof */
  const spoofState = { batch: [], format: 'auto', place: '' };

  VIEWS['#/spoof'] = function () {
    const jobs = ABP.state.jobs.filter((j) => j.type === 'spoof').slice(0, 6);
    return (
      pageHead({
        kicker: 'ROBLOX ASSET · ISPOOFERMOTION',
        title: 'Asset Spoofer',
        desc: 'Animasi, model, mesh, decal, audio — tarik lewat place-context discovery lalu keluarkan sebagai <b>.rbxm</b> siap drag & drop ke Studio.',
        aside: '<div class="head-badges">' + ui.badge('DEEP CHUNK', 'violet') + ui.badge('AUTO PLACE', 'muted') + '</div>',
      }) +
      '<div class="layout-2">' +
      '<div class="stack">' +
      '<section class="panel"><div class="panel-head"><div><p class="kicker">ASSET INPUT</p><h3>Asset ID atau link Roblox</h3></div></div>' +
      '<div class="panel-body">' +
      '<div class="input-row"><div class="input-wrap"><span class="input-ico">' + icon('cube', 16) + '</span>' +
      '<input class="input" id="spoof-input" placeholder="507766388  ·  rbxassetid://507766388  ·  roblox.com/bundles/39" /></div>' +
      '<button class="btn btn-soft" data-action="spoof-add">' + icon('plus', 16) + ' Tambah</button></div>' +
      '<div class="batch-list" id="batch-list">' +
      (spoofState.batch.length
        ? spoofState.batch.map((b, i) => '<span class="batch-item">' + icon('cube', 13) + esc(b) + '<button data-action="spoof-remove" data-idx="' + i + '" aria-label="Hapus">' + icon('x', 12) + '</button></span>').join('')
        : '<p class="empty-inline">Belum ada asset. Tambah minimal satu ID untuk mulai.</p>') +
      '</div>' +
      '<div class="field-grid">' +
      '<div><label class="field-label">Output</label><div class="chips" id="spoof-format">' +
      ['auto', 'audio', 'rbxm'].map((k) => '<button class="chip' + (k === spoofState.format ? ' is-active' : '') + '" data-spoof-format="' + k + '">' + (k === 'auto' ? 'Auto detect' : k === 'audio' ? 'Audio' : 'RBXM') + '</button>').join('') +
      '</div></div>' +
      '<div><label class="field-label" for="spoof-place">Place ID (opsional)</label><input class="input" id="spoof-place" placeholder="auto-discover" value="' + esc(spoofState.place) + '" /></div>' +
      '</div>' +
      '<div class="action-row">' +
      '<button class="btn btn-primary btn-lg" data-action="run-spoof">' + icon('cube', 18) + ' Spoof sekarang <span class="btn-cost">1 kredit</span></button>' +
      '<button class="btn btn-ghost" data-action="spoof-clear">Bersihkan</button>' +
      '</div>' +
      '</div></section>' +

      '<section class="panel"><div class="panel-head"><div><p class="kicker">PIPELINE</p><h3>Apa yang terjadi di dalam</h3></div></div>' +
      '<div class="panel-body pipeline">' +
      [
        ['1', 'Place-context discovery', 'Cari Place ID kreator supaya asset privat tetap bisa diunduh.'],
        ['2', 'Fetch binary chunk', 'Ambil RBXM asli, baca PROP & META chunk.'],
        ['3', 'Deep spoof', 'SourceAssetId = -1, UniqueId dibersihkan, CFrame mikro-rotasi ortonormal.'],
        ['4', 'Repack & deliver', 'Tulis ulang file .rbxm siap drag & drop ke Studio.'],
      ].map((s) => '<div class="pipe-step"><span class="pipe-num">' + s[0] + '</span><div><b>' + s[1] + '</b><p>' + s[2] + '</p></div></div>').join('') +
      '</div></section>' +
      '</div>' +

      '<aside class="sticky-col">' +
      '<div class="preview-card"><div class="preview-head"><span class="kicker">INTELLIGENCE</span>' + ui.badge('READY', 'success', true) + '</div>' +
      '<div class="intel-list">' +
      '<div class="intel-row"><span>Asset terdeteksi</span><b id="intel-count">' + spoofState.batch.length + '</b></div>' +
      '<div class="intel-row"><span>Output mode</span><b>' + (spoofState.format === 'auto' ? 'AUTO' : spoofState.format.toUpperCase()) + '</b></div>' +
      '<div class="intel-row"><span>Place context</span><b>' + (spoofState.place || 'AUTO') + '</b></div>' +
      '<div class="intel-row"><span>Teknik</span><b>DEEP CHUNK</b></div>' +
      '</div>' +
      '<div class="ps-block is-compact"><div class="ps-label"><span>Output file</span></div><div class="ps-value sm">.rbxm</div>' +
      '<p class="ps-hint">Audio asset otomatis jadi .ogg / .mp3 playable.</p></div>' +
      '<button class="btn btn-primary btn-block" data-action="run-spoof">' + icon('bolt', 16) + ' Jalankan batch</button>' +
      '</div>' +
      '<div class="panel mini-panel"><div class="panel-head"><h3>Hasil terakhir</h3></div><div class="mini-list">' +
      (jobs.length
        ? jobs.map((j) => '<button class="mini-item" data-action="open-report" data-id="' + j.id + '">' + ui.cover(j.artworkSeed, { className: 'mini-cover' }) +
          '<span><b>' + esc(j.title) + '</b><small>' + U.ago(j.createdAt) + ' · ' + U.bytes(j.sizeBytes) + '</small></span>' + icon('chevronRight', 14) + '</button>').join('')
        : '<p class="empty-inline">Belum ada hasil.</p>') +
      '</div></div>' +
      '</aside>' +
      '</div>'
    );
  };

  /* --------------------------------------------------------------------- get */
  const getState = { format: 'mp3', url: '' };

  VIEWS['#/get'] = function () {
    const fmts = [
      { k: 'mp3', label: 'MP3', rate: '320 kbps', note: 'Paling kompatibel' },
      { k: 'flac', label: 'FLAC', rate: 'Lossless', note: 'Master utuh' },
      { k: 'wav', label: 'WAV', rate: 'PCM 16-bit', note: 'Editing audio' },
      { k: 'm4a', label: 'M4A', rate: '256 kbps', note: 'Apple ecosystem' },
    ];
    return (
      pageHead({
        kicker: 'FRESH MASTER · 1.0×',
        title: 'Fresh Master',
        desc: 'Tarik lagu <b>belum di-bypass</b> dengan kualitas studio tertinggi. Tanpa speed shift, tanpa pitch shift — original apa adanya.',
        aside: '<div class="head-badges">' + ui.badge('320 KBPS', 'cyan') + ui.badge('LOSSLESS', 'muted') + '</div>',
      }) +
      '<div class="layout-2">' +
      '<div class="stack">' +
      '<section class="panel"><div class="panel-head"><div><p class="kicker">STEP 01</p><h3>Format master</h3></div><span class="muted tiny">bitrate maksimum</span></div>' +
      '<div class="panel-body"><div class="format-grid">' +
      fmts.map((f) => '<button class="format-card' + (f.k === getState.format ? ' is-active' : '') + '" data-get-format="' + f.k + '">' +
        '<span class="format-label">' + f.label + '</span><b>' + f.rate + '</b><small>' + f.note + '</small>' +
        (f.k === getState.format ? '<span class="format-check">' + icon('check', 12) + '</span>' : '') +
        '</button>').join('') +
      '</div></div></section>' +

      '<section class="panel"><div class="panel-head"><div><p class="kicker">STEP 02</p><h3>Sumber</h3></div></div>' +
      '<div class="panel-body">' +
      '<label class="field-label" for="get-url">Link lagu</label>' +
      '<div class="input-row"><div class="input-wrap"><span class="input-ico">' + icon('disc', 16) + '</span>' +
      '<input class="input" id="get-url" placeholder="https://open.spotify.com/track/…  ·  youtu.be/…  ·  soundcloud" value="' + esc(getState.url) + '" /></div>' +
      '<button class="btn btn-primary" data-action="run-get">' + icon('download', 16) + ' Tarik</button></div>' +
      '<p class="field-hint">Stream diambil apa adanya, lalu metadata ID3/Vorbis dibersihkan dan ditulis ulang.</p>' +
      '</div></section>' +
      '</div>' +

      '<aside class="sticky-col">' +
      '<div class="preview-card">' +
      '<div class="preview-head"><span class="kicker">MASTER PREVIEW</span>' + ui.badge('1.0×', 'cyan') + '</div>' +
      '<div class="preview-art">' + ui.cover(getState.url || 'fresh-master', { className: 'preview-cover' }) +
      '<div class="preview-art-info"><h3>' + (getState.url ? 'Master stream' : 'Belum ada sumber') + '</h3><p>' + (ABP.FORMATS[getState.format] || ABP.FORMATS.mp3).label + ' · ' + ((ABP.FORMATS[getState.format] || ABP.FORMATS.mp3).bitrate || 'lossless') + '</p></div></div>' +
      '<div class="quality-bars">' +
      [['128 kbps', 34, 'Low'], ['320 kbps', 78, 'Studio'], ['Lossless', 100, 'Master']].map((b) => '<div class="qbar"><span>' + b[0] + '</span><i><b style="width:' + b[1] + '%"></b></i><small>' + b[2] + '</small></div>').join('') +
      '</div>' +
      '<div class="preview-facts"><div><span>Speed</span><b>1.0×</b></div><div><span>Pitch</span><b>1.0×</b></div><div><span>Gain</span><b>0 dB</b></div><div><span>Kodek</span><b>' + (ABP.FORMATS[getState.format] || ABP.FORMATS.mp3).label + '</b></div></div>' +
      '<button class="btn btn-primary btn-block btn-lg" data-action="run-get">' + icon('download', 18) + ' Download master <span class="btn-cost">1 kredit</span></button>' +
      '<p class="preview-note">' + icon('info', 13) + (ABP.live ? ' Engine aktif — file asli akan diproses.' : ' Demo engine — file disimulasikan.') + '</p>' +
      '</div></aside>' +
      '</div>' +
      infoStrip([
        { icon: 'disc', t: '1.0× original', d: 'Tanpa speed atau pitch shift — file keluar apa adanya dari sumber.' },
        { icon: 'zap', t: 'Bitrate maksimum', d: '320 kbps untuk format lossy, dan lossless penuh untuk FLAC/WAV.' },
        { icon: 'shield', t: 'Metadata bersih', d: 'Tag ID3/Vorbis ditulis ulang dari metadata sumber, bukan sisa platform.' },
      ])
    );
  };

  /* ------------------------------------------------------------------- video */
  const videoState = { quality: '1080p', url: '', trim: '' };
  const QUALITIES = [
    { k: '2160p', label: '2160p', note: '4K · ~18 MB/10s' },
    { k: '1440p', label: '1440p', note: '2K · ~11 MB/10s' },
    { k: '1080p', label: '1080p', note: 'FHD · ~6 MB/10s' },
    { k: '720p', label: '720p', note: 'HD · ~3 MB/10s' },
    { k: '480p', label: '480p', note: 'SD · ~1.6 MB/10s' },
    { k: '360p', label: '360p', note: 'Hemat · ~1 MB/10s' },
  ];

  VIEWS['#/video'] = function () {
    return (
      pageHead({
        kicker: 'CLEAN VIDEO · NO WATERMARK',
        title: 'Clean Video',
        desc: 'Ambil stream resolusi tertinggi langsung dari sumber bersih — TikTok HD, Reels, YouTube, X, Reddit, Bilibili. Tanpa watermark, tanpa re-encode.',
        aside: '<div class="head-badges">' + ui.badge('4K READY', 'cobalt') + ui.badge('LOSSLESS REMUX', 'muted') + '</div>',
      }) +
      '<div class="layout-2">' +
      '<div class="stack">' +
      '<section class="panel"><div class="panel-head"><div><p class="kicker">STEP 01</p><h3>Resolusi target</h3></div><span class="muted tiny">auto-fit ke batas upload</span></div>' +
      '<div class="panel-body"><div class="quality-grid">' +
      QUALITIES.map((q) => '<button class="quality-card' + (q.k === videoState.quality ? ' is-active' : '') + '" data-quality="' + q.k + '">' +
        '<b>' + q.label + '</b><small>' + q.note + '</small>' + (q.k === videoState.quality ? '<span class="format-check">' + icon('check', 12) + '</span>' : '') + '</button>').join('') +
      '</div>' +
      '<div class="field-grid">' +
      '<div><label class="field-label" for="video-trim">Trim (opsional)</label><input class="input" id="video-trim" placeholder="0:05-0:35" value="' + esc(videoState.trim) + '" /></div>' +
      '<div><label class="field-label" for="video-url">Link video</label><input class="input" id="video-url" placeholder="https://vt.tiktok.com/…" value="' + esc(videoState.url) + '" /></div>' +
      '</div>' +
      '<div class="action-row"><button class="btn btn-primary btn-lg" data-action="run-video">' + icon('download', 18) + ' Unduh video <span class="btn-cost">1 kredit</span></button>' +
      '<span class="muted tiny">' + icon('shield', 13) + ' stream bersih, tanpa overlay</span></div>' +
      '</div></section>' +
      '<section class="panel"><div class="panel-head"><div><p class="kicker">SUPPORTED</p><h3>Platform</h3></div></div><div class="panel-body">' +
      '<div class="platform-grid">' +
      ABP.PLATFORMS.slice(0, 10).map((p) => '<span class="platform-pill tone-' + p.tone + '"><i></i>' + p.label + '</span>').join('') +
      '</div></div></section>' +
      '</div>' +
      '<aside class="sticky-col"><div class="preview-card">' +
      '<div class="preview-head"><span class="kicker">FRAME PREVIEW</span>' + ui.badge(videoState.quality.toUpperCase(), 'cobalt') + '</div>' +
      '<div class="video-frame">' + ui.cover(videoState.url || 'video-frame', { className: 'video-cover' }) +
      '<span class="video-play">' + icon('play', 22) + '</span>' +
      '<span class="video-badge">NO WATERMARK</span>' +
      '</div>' +
      '<div class="preview-facts"><div><span>Resolusi</span><b>' + videoState.quality + '</b></div><div><span>Container</span><b>MP4</b></div>' +
      '<div><span>Audio</span><b>AAC 128k</b></div><div><span>Faststart</span><b>ON</b></div></div>' +
      '<button class="btn btn-primary btn-block btn-lg" data-action="run-video">' + icon('download', 18) + ' Download MP4 <span class="btn-cost">1 kredit</span></button>' +
      '<p class="preview-note">' + icon('info', 13) + (ABP.live ? ' Engine aktif — file asli akan diproses.' : ' Demo engine — file disimulasikan.') + '</p>' +
      '</div></aside>' +
      '</div>' +
      infoStrip([
        { icon: 'shield', t: 'Tanpa watermark', d: 'Stream diambil langsung dari sumber bersih, bukan hasil rekam layar.' },
        { icon: 'film', t: 'Remux lossless', d: 'Tidak ada re-encode video — kualitas asli tetap utuh.' },
        { icon: 'bolt', t: 'Faststart', d: 'moov atom dipindah ke depan supaya video langsung play di browser.' },
      ])
    );
  };

  /* ----------------------------------------------------------------- credits */
  VIEWS['#/credits'] = function () {
    const info = ABP.creditInfo();
    const interval = (ABP.state.settings.refillHours || 6) * 3600000;
    const usage = ABP.state.jobs.filter((j) => j.type !== 'spoof').slice(0, 6);
    return (
      pageHead({
        kicker: 'ACCOUNT · QUOTA',
        title: 'Kredit & Redeem',
        desc: 'Setiap job memakai 1 kredit. Kredit pulih otomatis +1 setiap ' + ABP.state.settings.refillHours + ' jam — dan bonus redeem bisa menembus batas maksimal.',
        aside: '<div class="head-badges">' + ui.badge('FREE TIER', 'muted') + ui.badge('OVERFLOW OK', 'gold') + '</div>',
      }) +
      '<div class="credit-layout">' +
      '<section class="panel credit-hero">' +
      '<div class="credit-hero-glow"></div>' +
      '<div class="credit-hero-inner">' +
      '<div>' + ui.ring(info.remaining, info.max, 148, 10) + '</div>' +
      '<div class="credit-hero-copy">' +
      '<p class="kicker">SALDO AKTIF</p>' +
      '<h2>' + info.remaining + ' <span>kredit</span></h2>' +
      '<p>' + (info.bonus ? 'Termasuk <b>+' + info.bonus + ' bonus overflow</b> di atas batas ' + info.max + '.' : 'Recovery otomatis aktif selama saldo di bawah ' + info.max + '.') + '</p>' +
      '<div class="credit-next"><span>Kredit berikutnya</span><b data-live="refill">' + U.countdown(info.nextRefillMs) + '</b></div>' +
      '</div>' +
      '</div>' +
      '<div class="usage-mini">' +
      '<div class="usage-head"><span>Pemakaian 7 hari</span><b>12 job</b></div>' +
      '<div class="usage-chart">' + ui.sparkline('usage-7d', 420, 58, '#ff8a3d') + '</div>' +
      '<div class="usage-labels">' + ['S', 'S', 'R', 'K', 'J', 'S', 'M'].map((d) => '<span>' + d + '</span>').join('') + '</div>' +
      '</div>' +
      '<div class="credit-hero-foot">' +
      '<span>' + icon('refresh', 14) + ' +1 / ' + ABP.state.settings.refillHours + ' jam</span>' +
      '<span>' + icon('bolt', 14) + ' 1 kredit / job</span>' +
      '<span>' + icon('gift', 14) + ' bonus tidak hangus</span>' +
      '</div>' +
      '</section>' +

      '<section class="panel redeem-panel">' +
      '<div class="panel-head"><div><p class="kicker">VOUCHER</p><h3>Klaim kode redeem</h3></div>' + icon('gift', 20) + '</div>' +
      '<div class="panel-body">' +
      '<div class="input-row"><input class="input mono" id="redeem-input" placeholder="VIP2026" maxlength="24" />' +
      '<button class="btn btn-primary" data-action="redeem">Klaim</button></div>' +
      '<p class="field-hint">Coba <code class="code">VIP2026</code>, <code class="code">ABV2-FREE-10</code>, atau <code class="code">ANTILUA-GOLD</code>.</p>' +
      '<div class="divider"></div>' +
      '<p class="kicker">KODE AKTIF</p>' +
      (ABP.live
        ? '<p class="field-hint">Kode dibagikan owner lewat Discord. Masukkan kode terbaru di kolom atas — kuota dan masa berlaku dicek langsung oleh server.</p>'
        : '<div class="code-list">' +
          ABP.state.codes.filter((c) => c.active).slice(0, 4).map((c) => {
            const left = c.maxClaims === 0 ? '∞' : Math.max(0, c.maxClaims - c.claimCount) + ' sisa';
            return '<div class="code-row"><div><b class="mono">' + esc(c.code) + '</b><small>+' + c.reward + ' kredit · ' + left + '</small></div>' +
              '<button class="copy-btn" data-action="fill-redeem" data-code="' + esc(c.code) + '">' + icon('copy', 14) + '</button></div>';
          }).join('') +
          '</div>') +
      '</div></section>' +
      '</div>' +

      '<div class="tier-grid">' +
      '<div class="tier-card"><span class="tier-tag">FREE</span><h3>Rp 0</h3><p>Untuk coba engine.</p><ul>' +
      [ABP.state.settings.maxCredits + ' kredit · +1 / ' + ABP.state.settings.refillHours + ' jam', 'Semua format audio', 'Cooldown ' + (ABP.state.settings.cooldownSec || 0) + ' detik', 'Antrean standar'].map((x) => '<li>' + icon('check', 14) + x + '</li>').join('') + '</ul></div>' +
      '<div class="tier-card is-hot"><span class="tier-tag">PREMIUM</span><h3>Unlimited</h3><p>Untuk creator serius.</p><ul>' +
      ['Tanpa cooldown & tanpa kredit', 'Antrean prioritas', 'Bulk spoof 50 item', 'Akses semua preset'].map((x) => '<li>' + icon('check', 14) + x + '</li>').join('') + '</ul>' +
      '<a class="btn btn-primary btn-block" href="#/admin">Hubungi owner</a></div>' +
      '<div class="tier-card"><span class="tier-tag">OWNER</span><h3>Control</h3><p>Semua akses.</p><ul>' +
      ['Panel penuh + audit log', 'Kelola redeem & blacklist', 'Set engine secara live', 'Roblox cookie & API key'].map((x) => '<li>' + icon('check', 14) + x + '</li>').join('') + '</ul></div>' +
      '</div>' +

      '<section class="section"><div class="section-head"><h2>Riwayat kredit</h2><span class="muted tiny">6 aktivitas terakhir</span></div>' +
      '<div class="panel"><div class="ledger">' +
      usage.map((j) => '<div class="ledger-row"><span class="ledger-ico">' + icon(ui.typeMeta(j.type).icon, 15) + '</span>' +
        '<div><b>' + esc(j.title) + '</b><small>' + U.dateTime(j.createdAt) + ' · ' + ui.typeMeta(j.type).label + '</small></div>' +
        '<span class="ledger-delta">−1</span></div>').join('') +
      (ABP.state.audit.filter((a) => a.action.toLowerCase().includes('redeem') || a.action.toLowerCase().includes('kredit')).slice(0, 3)
        .map((a) => '<div class="ledger-row"><span class="ledger-ico is-gold">' + icon('gift', 15) + '</span><div><b>' + esc(a.action) + '</b><small>' + U.dateTime(a.at) + ' · ' + esc(a.actor) + '</small></div><span class="ledger-delta is-plus">+' + (a.detail.match(/\+\s*(\d+)/) ? a.detail.match(/\+\s*(\d+)/)[1] : '1') + '</span></div>').join('')) +
      '</div></div></section>'
    );
  };

  /* ----------------------------------------------------------------- history */
  VIEWS['#/history'] = function () {
    const q = (ABP.searchQuery || '').toLowerCase();
    const filter = ABP.historyFilter || 'all';
    let jobs = ABP.state.jobs.slice();
    if (filter !== 'all') jobs = jobs.filter((j) => j.type === filter);
    if (q) jobs = jobs.filter((j) => (j.title + ' ' + j.source + ' ' + j.format).toLowerCase().includes(q));

    const filters = [
      ['all', 'Semua'],
      ['bypass', 'Bypass'],
      ['get', 'Fresh'],
      ['video', 'Video'],
      ['spoof', 'Spoof'],
    ];

    return (
      pageHead({
        kicker: 'LIBRARY · ACTIVITY',
        title: 'Riwayat',
        desc: 'Semua job yang pernah lewat engine. Buka laporan, salin PlaybackSpeed, atau jalankan ulang.',
        aside: '<div class="head-badges">' + ui.badge(ABP.state.jobs.length + ' JOB', 'muted') + ui.badge('SYNCED', 'success', true) + '</div>',
      }) +
      '<div class="list-toolbar">' +
      '<div class="chips" id="history-filters">' +
      filters.map((f) => '<button class="chip' + (f[0] === filter ? ' is-active' : '') + '" data-filter="' + f[0] + '">' + f[1] + '</button>').join('') +
      '</div>' +
      '<div class="search search-inline"><span class="search-ico">' + icon('search', 15) + '</span>' +
      '<input id="history-search" placeholder="Cari judul atau format…" value="' + esc(ABP.searchQuery || '') + '" />' +
      (q ? '<button class="btn btn-icon btn-ghost btn-xs" data-action="clear-search" aria-label="Reset">' + icon('x', 13) + '</button>' : '') +
      '</div>' +
      '</div>' +
      (jobs.length
        ? '<div class="panel"><div class="table-wrap"><table class="table"><thead><tr>' +
          '<th>Judul</th><th>Tipe</th><th>Format</th><th>PlaybackSpeed</th><th>Ukuran</th><th>Waktu</th><th>Status</th><th></th>' +
          '</tr></thead><tbody>' +
          jobs.map((j) => {
            const meta = ui.typeMeta(j.type);
            const fmt = ABP.FORMATS[j.format] || { label: j.format };
            return '<tr data-row="' + j.id + '">' +
              '<td><div class="cell-title">' + ui.cover(j.artworkSeed, { className: 'row-cover' }) +
              '<div><b>' + esc(j.title) + '</b><small>' + esc((j.source || 'upload lokal').slice(0, 46)) + '</small></div></div></td>' +
              '<td><span class="type-chip tone-' + meta.tone + '">' + icon(meta.icon, 12) + meta.label + '</span></td>' +
              '<td><b class="mono">' + fmt.label + '</b></td>' +
              '<td><button class="ps-copy" data-action="copy-speed" data-value="' + j.playbackSpeed + '">' + j.playbackSpeed + icon('copy', 12) + '</button></td>' +
              '<td class="mono">' + U.bytes(j.sizeBytes) + '</td>' +
              '<td class="muted">' + U.ago(j.createdAt) + '</td>' +
              '<td>' + ui.statusPill(j.status) + '</td>' +
              '<td class="row-actions"><button class="btn btn-icon btn-ghost btn-xs" data-action="open-report" data-id="' + j.id + '" aria-label="Laporan">' + icon('external', 15) + '</button>' +
              '<button class="btn btn-icon btn-ghost btn-xs" data-action="rerun" data-id="' + j.id + '" aria-label="Ulangi">' + icon('refresh', 15) + '</button></td>' +
              '</tr>';
          }).join('') +
          '</tbody></table></div></div>'
        : '<div class="empty-state">' + icon('clock', 34) + '<h3>Tidak ada job yang cocok</h3><p>Coba kata kunci lain atau mulai job baru dari Studio Bypass.</p>' +
          '<a class="btn btn-primary" href="#/bypass">' + icon('bolt', 16) + ' Mulai bypass</a></div>') +

      '<section class="section"><div class="section-head"><h2>Ringkasan</h2></div><div class="stat-grid">' +
      [
        ['Total job', ABP.state.jobs.length],
        ['Sukses', ABP.state.jobs.filter((j) => j.status === 'done').length],
        ['Gagal', ABP.state.jobs.filter((j) => j.status === 'failed').length],
        ['Total output', U.bytes(ABP.state.jobs.reduce((a, j) => a + (j.sizeBytes || 0), 0))],
      ].map((s) => '<div class="stat"><div class="stat-top"><span>' + s[0] + '</span></div><strong>' + s[1] + '</strong><small>akumulasi sesi ini</small></div>').join('') +
      '</div></section>'
    );
  };

  /* -------------------------------------------------------------------- bind */
  function bind(routeName) {
    if (routeName === '#/bypass') bindBypass();
    if (routeName === '#/spoof') bindSpoof();
    if (routeName === '#/get') bindGet();
    if (routeName === '#/video') bindVideo();
    if (routeName === '#/credits') bindCredits();
    if (routeName === '#/history') bindHistory();
  }

  function updatePlatformChip() {
    const input = document.getElementById('bypass-url');
    const chip = document.getElementById('platform-detect');
    if (!input || !chip) return;
    const p = ABP.detectPlatform(input.value);
    chip.innerHTML = p ? '<span class="platform-chip tone-' + p.tone + '"><i></i>' + p.label + '</span>' : '';
  }

  function paintRange(el) {
    if (!el) return;
    const min = Number(el.min || 0);
    const max = Number(el.max || 100);
    const v = Number(el.value || 0);
    const pct = max === min ? 0 : ((v - min) / (max - min)) * 100;
    el.style.setProperty('--p', pct + '%');
  }

  function refreshBypassPreview() {
    const host = document.getElementById('bypass-preview');
    if (!host) return;
    const tmp = document.createElement('div');
    tmp.innerHTML = bypassPreview();
    host.replaceWith(tmp.firstElementChild);
  }

  function bindBypass() {
    const tabs = document.getElementById('source-tabs');
    if (tabs) {
      tabs.addEventListener('click', (e) => {
        const b = e.target.closest('[data-tab]');
        if (!b) return;
        bypassState.tab = b.dataset.tab;
        tabs.querySelectorAll('.seg').forEach((s) => s.classList.toggle('is-active', s === b));
        document.getElementById('pane-link').hidden = bypassState.tab !== 'link';
        document.getElementById('pane-file').hidden = bypassState.tab !== 'file';
      });
      if (bypassState.tab === 'file') {
        tabs.querySelector('[data-tab="file"]').classList.add('is-active');
        tabs.querySelector('[data-tab="link"]').classList.remove('is-active');
        document.getElementById('pane-link').hidden = true;
        document.getElementById('pane-file').hidden = false;
      }
    }

    const url = document.getElementById('bypass-url');
    if (url) {
      url.value = bypassState.url;
      updatePlatformChip();
      url.addEventListener('input', U.debounce(() => {
        bypassState.url = url.value.trim();
        updatePlatformChip();
        refreshBypassPreview();
      }, 260));
    }

    const dz = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');
    if (dz && fileInput) {
      const setFile = (f) => {
        if (!f) return;
        bypassState.file = { name: f.name, size: f.size };
        bypassState.fileObj = f;
        const chip = document.getElementById('file-chip');
        chip.hidden = false;
        chip.innerHTML = icon('music', 16) + '<b>' + esc(f.name) + '</b><small>' + U.bytes(f.size) + '</small><button data-action="clear-file">' + icon('x', 13) + '</button>';
        refreshBypassPreview();
      };
      dz.addEventListener('click', () => fileInput.click());
      dz.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') fileInput.click();
      });
      fileInput.addEventListener('change', () => setFile(fileInput.files[0]));
      ['dragenter', 'dragover'].forEach((ev) => dz.addEventListener(ev, (e) => {
        e.preventDefault();
        dz.classList.add('is-over');
      }));
      ['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, (e) => {
        e.preventDefault();
        dz.classList.remove('is-over');
      }));
      dz.addEventListener('drop', (e) => setFile(e.dataTransfer.files[0]));
      if (bypassState.file) {
        const chip = document.getElementById('file-chip');
        chip.hidden = false;
        chip.innerHTML = icon('music', 16) + '<b>' + esc(bypassState.file.name) + '</b><small>' + U.bytes(bypassState.file.size) + '</small><button data-action="clear-file">' + icon('x', 13) + '</button>';
      }
    }

    const chips = document.getElementById('format-chips');
    if (chips) {
      chips.addEventListener('click', (e) => {
        const b = e.target.closest('[data-format]');
        if (!b) return;
        bypassState.format = b.dataset.format;
        chips.querySelectorAll('.chip').forEach((c) => c.classList.toggle('is-active', c === b));
        refreshBypassPreview();
      });
    }

    const speed = document.getElementById('speed');
    if (speed) {
      paintRange(speed);
      speed.addEventListener('input', () => {
        paintRange(speed);
        bypassState.speed = Number(speed.value);
        document.getElementById('speed-out').textContent = bypassState.speed + '×';
        const inline = document.getElementById('ps-inline');
        if (inline) inline.textContent = U.playbackSpeed(bypassState.speed);
        refreshBypassPreview();
      });
    }
    const pitch = document.getElementById('pitch');
    if (pitch) {
      paintRange(pitch);
      pitch.addEventListener('input', () => {
        paintRange(pitch);
        bypassState.pitch = Number(pitch.value);
        document.getElementById('pitch-out').textContent = bypassState.pitch + '×';
        refreshBypassPreview();
      });
    }
    const gain = document.getElementById('gain');
    if (gain) {
      paintRange(gain);
      gain.addEventListener('input', () => {
        paintRange(gain);
        bypassState.gain = Number(gain.value);
        document.getElementById('gain-out').textContent = bypassState.gain + ' dB';
        refreshBypassPreview();
      });
    }

    const presets = document.getElementById('preset-chips');
    if (presets) {
      presets.addEventListener('click', (e) => {
        const b = e.target.closest('[data-preset]');
        if (!b) return;
        applyPreset(b.dataset.preset);
      });
    }

    ['trim-start', 'trim-end', 'custom-name'].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', () => {
        if (id === 'trim-start') bypassState.trimStart = el.value;
        if (id === 'trim-end') bypassState.trimEnd = el.value;
        if (id === 'custom-name') bypassState.name = el.value;
      });
    });
  }

  function applyPreset(key) {
    const p = ABP.PRESETS.find((x) => x.key === key);
    if (!p) return;
    bypassState.preset = key;
    bypassState.speed = p.speed;
    bypassState.gain = p.gain;
    const speed = document.getElementById('speed');
    const gain = document.getElementById('gain');
    const presets = document.getElementById('preset-chips');
    if (speed) {
      speed.value = p.speed;
      paintRange(speed);
      document.getElementById('speed-out').textContent = p.speed + '×';
      const inline = document.getElementById('ps-inline');
      if (inline) inline.textContent = U.playbackSpeed(p.speed);
    }
    if (gain) {
      gain.value = p.gain;
      paintRange(gain);
      document.getElementById('gain-out').textContent = p.gain + ' dB';
    }
    if (presets) presets.querySelectorAll('.chip').forEach((c) => c.classList.toggle('is-active', c.dataset.preset === key));
    refreshBypassPreview();
    ui.toast({ title: 'Preset ' + p.label + ' aktif', msg: p.desc, tone: 'success', icon: 'sparkles' });
  }

  function bindSpoof() {
    const input = document.getElementById('spoof-input');
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          addSpoofItem();
        }
      });
    }
    const place = document.getElementById('spoof-place');
    if (place) place.addEventListener('input', () => { spoofState.place = place.value.trim(); });
    const chips = document.getElementById('spoof-format');
    if (chips) {
      chips.addEventListener('click', (e) => {
        const b = e.target.closest('[data-spoof-format]');
        if (!b) return;
        spoofState.format = b.dataset.spoofFormat;
        chips.querySelectorAll('.chip').forEach((c) => c.classList.toggle('is-active', c === b));
        app.render();
      });
    }
  }

  function addSpoofItem() {
    const input = document.getElementById('spoof-input');
    if (!input) return;
    const v = input.value.trim();
    if (!v) {
      ui.toast({ title: 'Asset ID kosong', msg: 'Masukkan angka asset atau link Roblox.', tone: 'danger' });
      return;
    }
    if (spoofState.batch.includes(v)) {
      ui.toast({ title: 'Sudah ada di batch', tone: 'warn' });
      return;
    }
    spoofState.batch.push(v);
    input.value = '';
    app.render();
  }

  function bindGet() {
    const url = document.getElementById('get-url');
    if (url) {
      url.value = getState.url;
      url.addEventListener('input', U.debounce(() => {
        getState.url = url.value.trim();
      }, 220));
    }
    document.querySelectorAll('[data-get-format]').forEach((b) => {
      b.addEventListener('click', () => {
        getState.format = b.dataset.getFormat;
        app.render();
      });
    });
  }

  function bindVideo() {
    const url = document.getElementById('video-url');
    if (url) {
      url.value = videoState.url;
      url.addEventListener('input', U.debounce(() => { videoState.url = url.value.trim(); }, 220));
    }
    const trim = document.getElementById('video-trim');
    if (trim) trim.addEventListener('input', () => { videoState.trim = trim.value.trim(); });
    document.querySelectorAll('[data-quality]').forEach((b) => {
      b.addEventListener('click', () => {
        videoState.quality = b.dataset.quality;
        app.render();
      });
    });
  }

  function bindCredits() {
    const input = document.getElementById('redeem-input');
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          redeem(input.value);
        }
      });
    }
  }

  function bindHistory() {
    const filters = document.getElementById('history-filters');
    if (filters) {
      filters.addEventListener('click', (e) => {
        const b = e.target.closest('[data-filter]');
        if (!b) return;
        ABP.historyFilter = b.dataset.filter;
        app.render();
      });
    }
    const search = document.getElementById('history-search');
    if (search) {
      search.addEventListener('input', U.debounce(() => {
        ABP.searchQuery = search.value;
        app.render();
        const again = document.getElementById('history-search');
        if (again) {
          again.focus();
          again.setSelectionRange(again.value.length, again.value.length);
        }
      }, 240));
    }
  }

  /* ------------------------------------------------------------------ redeem */
  async function redeem(rawCode) {
    if (ABP.live) {
      const code = String(rawCode || '').trim().toUpperCase();
      if (!code) {
        ui.toast({ title: 'Masukkan kode dulu', tone: 'warn' });
        return;
      }
      try {
        const res = await ABP.api.redeem(code);
        await ABP.api.refreshMe();
        ui.toast({ title: '+' + res.reward + ' kredit masuk', msg: 'Kode ' + res.code + ' berhasil diklaim.', tone: 'success', icon: 'gift', duration: 5000 });
        app.render();
        app.refreshChrome();
      } catch (err) {
        ui.toast({ title: 'Redeem gagal', msg: err.message, tone: 'danger', icon: 'alert' });
      }
      return;
    }
    const code = String(rawCode || '').trim().toUpperCase();
    if (!code) {
      ui.toast({ title: 'Masukkan kode dulu', tone: 'warn' });
      return;
    }
    const entry = ABP.state.codes.find((c) => c.code.toUpperCase() === code);
    if (!entry) {
      ui.toast({ title: 'Kode tidak ditemukan', msg: 'Periksa kembali ejaan kode redeem.', tone: 'danger' });
      return;
    }
    if (!entry.active) {
      ui.toast({ title: 'Kode nonaktif', msg: 'Kode ini sudah dimatikan oleh admin.', tone: 'danger' });
      return;
    }
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      ui.toast({ title: 'Kode kedaluwarsa', msg: 'Masa berlaku kode ini sudah habis.', tone: 'danger' });
      return;
    }
    if (entry.maxClaims > 0 && entry.claimCount >= entry.maxClaims) {
      ui.toast({ title: 'Kuota klaim habis', msg: 'Kode ini sudah diklaim maksimal ' + entry.maxClaims + ' kali.', tone: 'danger' });
      return;
    }
    entry.claimCount += 1;
    ABP.addCredit(entry.reward);
    ABP.audit('Kode redeem diklaim', entry.code + ' · +' + entry.reward + ' credit', 'success', 'guest');
    ABP.save();
    ui.toast({ title: '+' + entry.reward + ' kredit masuk', msg: 'Kode ' + entry.code + ' berhasil diklaim.', tone: 'success', icon: 'gift', duration: 5000 });
    app.render();
    app.refreshChrome();
  }

  /* ------------------------------------------------------------------ actions */
  function setBusy(btn, label) {
    if (!btn) return;
    btn.dataset.prev = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = icon('refresh', 18) + ' ' + label;
  }

  function clearBusy() {
    document.querySelectorAll('[data-action^="run-"]').forEach((b) => {
      if (b.dataset.prev) {
        b.innerHTML = b.dataset.prev;
        delete b.dataset.prev;
        b.disabled = false;
      }
    });
  }

  function guard() {
    if (ABP.isMaintenance()) {
      ui.toast({ title: 'Maintenance aktif', msg: ABP.state.settings.maintenanceReason, tone: 'danger', icon: 'alert' });
      return false;
    }
    const info = ABP.creditInfo();
    if (ABP.state.settings.creditsEnabled && info.remaining <= 0) {
      ui.toast({ title: 'Kredit habis', msg: 'Klaim kode redeem atau tunggu recovery otomatis.', tone: 'danger', icon: 'wallet' });
      return false;
    }
    return true;
  }

  async function runBypass() {
    if (!guard()) return;
    if (!bypassState.url && !bypassState.file) {
      ui.toast({ title: 'Sumber belum diisi', msg: 'Tempel link atau upload file audio dulu.', tone: 'warn' });
      const el = document.getElementById('bypass-url');
      if (el) el.focus();
      return;
    }
    const src = bypassState.file ? bypassState.file.name : bypassState.url;
    setBusy(document.querySelector('[data-action="run-bypass"]'), 'Memproses…');
    let job;
    try {
      job = await ABP.engine.run({
        type: 'bypass',
        title: 'Menganalisis sumber…',
        source: src,
        file: bypassState.fileObj || null,
        format: bypassState.format,
        speed: bypassState.speed,
        pitch: bypassState.pitch,
        gain: bypassState.gain,
        preset: bypassState.preset,
        normalize: bypassState.normalize,
        silence: bypassState.silence,
        trimStart: bypassState.trimStart,
        trimEnd: bypassState.trimEnd,
        customName: bypassState.name,
      });
    } catch (err) {
      clearBusy();
      ui.toast({ title: 'Gagal membuat job', msg: err.message, tone: 'danger', icon: 'alert' });
      return;
    }
    bypassState.jobId = job.id;
    lastCompleted = null;
    ui.toast({ title: 'Job masuk antrean', msg: 'Engine mulai memproses ' + (bypassState.file ? bypassState.file.name : 'link') + '.', tone: 'default', icon: 'bolt' });
    app.renderDock();
  }

  async function runSpoof() {
    if (!guard()) return;
    if (!spoofState.batch.length) {
      ui.toast({ title: 'Batch kosong', msg: 'Tambah minimal satu asset ID.', tone: 'warn' });
      return;
    }
    setBusy(document.querySelector('[data-action="run-spoof"]'), 'Memproses…');
    try {
      await ABP.engine.run({
        type: 'spoof',
        title: 'Asset #' + spoofState.batch[0].replace(/\D/g, '').slice(0, 12),
        source: ABP.live ? spoofState.batch[0] : spoofState.batch.join(', '),
        format: spoofState.format === 'audio' ? 'ogg' : 'rbxm',
        placeId: spoofState.place,
        assetType: spoofState.format,
      });
    } catch (err) {
      clearBusy();
      ui.toast({ title: 'Spoof gagal dibuat', msg: err.message, tone: 'danger', icon: 'alert' });
      return;
    }
    ui.toast({
      title: 'Spoof berjalan',
      msg: ABP.live && spoofState.batch.length > 1
        ? 'Mode live memproses 1 asset per job — antrekan sisanya setelah ini.'
        : spoofState.batch.length + ' asset dalam antrean.',
      tone: 'default',
      icon: 'cube',
    });
    app.renderDock();
  }

  async function runGet() {
    if (!guard()) return;
    if (!getState.url) {
      ui.toast({ title: 'Link belum diisi', msg: 'Tempel link lagu yang mau ditarik.', tone: 'warn' });
      document.getElementById('get-url')?.focus();
      return;
    }
    setBusy(document.querySelector('[data-action="run-get"]'), 'Menarik…');
    try {
      await ABP.engine.run({ type: 'get', title: 'Menganalisis sumber…', source: getState.url, format: getState.format, speed: 1, gain: 0 });
    } catch (err) {
      clearBusy();
      ui.toast({ title: 'Gagal membuat job', msg: err.message, tone: 'danger', icon: 'alert' });
      return;
    }
    ui.toast({ title: 'Menarik master', msg: 'Kualitas ' + (ABP.FORMATS[getState.format] || {}).label + ' · 1.0× original.', tone: 'default', icon: 'disc' });
    app.renderDock();
  }

  async function runVideo() {
    if (!guard()) return;
    if (!videoState.url) {
      ui.toast({ title: 'Link belum diisi', msg: 'Tempel link video dulu.', tone: 'warn' });
      document.getElementById('video-url')?.focus();
      return;
    }
    setBusy(document.querySelector('[data-action="run-video"]'), 'Mengunduh…');
    try {
      await ABP.engine.run({ type: 'video', title: 'Menganalisis sumber…', source: videoState.url, format: 'mp4', quality: videoState.quality, speed: 1 });
    } catch (err) {
      clearBusy();
      ui.toast({ title: 'Gagal membuat job', msg: err.message, tone: 'danger', icon: 'alert' });
      return;
    }
    ui.toast({ title: 'Mengunduh video ' + videoState.quality, msg: 'Clean stream, tanpa watermark.', tone: 'default', icon: 'film' });
    app.renderDock();
  }

  function demoDownload(jobId) {
    const job = ABP.state.jobs.find((j) => j.id === jobId);
    if (!job) return;
    if (ABP.live && job.downloadUrl) {
      ABP.api.download(job);
      ui.toast({ title: 'Download dimulai', msg: job.fileName || 'File hasil proses.', tone: 'success', icon: 'download' });
      return;
    }
    const fmt = ABP.FORMATS[job.format] || { label: job.format, ext: job.format };
    ui.toast({
      title: 'Demo mode',
      msg: 'File ' + fmt.label + ' (' + U.bytes(job.sizeBytes) + ') tidak disertakan di demo UI. Gunakan "Laporan .txt" untuk ekspor nyata.',
      tone: 'warn',
      icon: 'info',
      duration: 5600,
    });
  }

  function downloadReport(jobId) {
    const job = ABP.state.jobs.find((j) => j.id === jobId);
    if (!job) return;
    const fmt = ABP.FORMATS[job.format] || { label: job.format, ext: job.format };
    const lines = [
      'ANTIBYPASS V2 — ENGINE REPORT',
      'powered by ANTILUA',
      '='.repeat(46),
      'Job ID        : ' + job.id,
      'Judul         : ' + job.title,
      'Tipe          : ' + job.type,
      'Sumber        : ' + job.source,
      'Status        : ' + job.status,
      '',
      'OUTPUT',
      'Format        : ' + fmt.label,
      'Bitrate       : ' + (fmt.bitrate ? fmt.bitrate + ' kbps' : 'lossless'),
      'Sample rate   : ' + (job.format === 'opus' ? '48000 Hz' : '44100 Hz'),
      'Durasi        : ' + U.dur(job.outputDurationSec || job.durationSec),
      'Ukuran        : ' + U.bytes(job.sizeBytes),
      'Checksum      : ' + (job.checksum || '-'),
      '',
      'ROBLOX',
      'PlaybackSpeed : ' + job.playbackSpeed,
      'Engine        : ' + job.engine.toUpperCase(),
      'Speed         : ' + job.speed + 'x',
      '',
      'Dibuat        : ' + new Date().toLocaleString('id-ID'),
      '='.repeat(46),
      'Demo report — dihasilkan oleh UI ANTIBYPASS V2.',
    ];
    U.download('antibypass-' + job.id + '.txt', lines.join('\n'));
    ui.toast({ title: 'Laporan diunduh', msg: 'File .txt tersimpan.', tone: 'success', icon: 'check' });
  }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;
    switch (action) {
      case 'noop':
        break;
      case 'hist-back':
        history.back();
        break;
      case 'hist-forward':
        history.forward();
        break;
      case 'toggle-rail':
        document.getElementById('rail').classList.toggle('is-open');
        break;
      case 'notifications':
        ui.toast({ title: 'Tidak ada notifikasi baru', msg: 'Semua job selesai diproses dengan baik.', tone: 'default', icon: 'gift' });
        break;
      case 'profile':
        openProfile();
        break;
      case 'copy-speed':
        U.copy(el.dataset.value).then((ok) => ui.toast({ title: ok ? 'PlaybackSpeed disalin' : 'Gagal menyalin', msg: ok ? el.dataset.value + ' siap ditempel di Roblox Studio.' : 'Salin manual: ' + el.dataset.value, tone: ok ? 'success' : 'danger', icon: ok ? 'check' : 'alert' }));
        break;
      case 'demo-download':
        demoDownload(el.dataset.id);
        break;
      case 'download-report':
        downloadReport(el.dataset.id);
        break;
      case 'open-report':
        if (el.dataset.id) ui.openReport(el.dataset.id);
        break;
      case 'cancel-job':
        if (el.dataset.id) {
          ABP.engine.cancel(el.dataset.id);
          ui.toast({ title: 'Job dibatalkan', tone: 'warn', icon: 'x' });
          app.renderDock();
          app.render();
        }
        break;
      case 'close-dock':
        ABP.state.activeJobId = null;
        ABP.save();
        app.renderDock();
        break;
      case 'run-bypass':
        runBypass();
        break;
      case 'run-spoof':
        runSpoof();
        break;
      case 'run-get':
        runGet();
        break;
      case 'run-video':
        runVideo();
        break;
      case 'paste-url':
        navigator.clipboard.readText().then((t) => {
          const input = document.getElementById('bypass-url');
          if (input) {
            input.value = t;
            bypassState.url = t.trim();
            updatePlatformChip();
            refreshBypassPreview();
          }
        }).catch(() => ui.toast({ title: 'Clipboard diblokir', msg: 'Tempel manual dengan Ctrl+V.', tone: 'warn' }));
        break;
      case 'clear-file':
        bypassState.file = null;
        const fc = document.getElementById('file-chip');
        if (fc) fc.hidden = true;
        refreshBypassPreview();
        break;
      case 'reset-bypass':
        bypassState.url = '';
        bypassState.file = null;
        bypassState.name = '';
        lastCompleted = null;
        app.render();
        break;
      case 'use-preset':
        location.hash = '#/bypass';
        setTimeout(() => applyPreset(el.dataset.preset), 60);
        break;
      case 'spoof-add':
        addSpoofItem();
        break;
      case 'spoof-remove':
        spoofState.batch.splice(Number(el.dataset.idx), 1);
        app.render();
        break;
      case 'spoof-clear':
        spoofState.batch = [];
        app.render();
        break;
      case 'redeem':
        redeem(document.getElementById('redeem-input')?.value);
        break;
      case 'fill-redeem': {
        const input = document.getElementById('redeem-input');
        if (input) {
          input.value = el.dataset.code;
          input.focus();
        }
        break;
      }
      case 'clear-search':
        ABP.searchQuery = '';
        app.render();
        break;
      case 'rerun': {
        const job = ABP.state.jobs.find((j) => j.id === el.dataset.id);
        if (job) {
          if (!guard()) return;
          ABP.engine.run({ type: job.type, title: 'Menganalisis sumber…', source: job.source, format: job.format, speed: job.speed, preset: job.preset });
          ui.toast({ title: 'Job dijalankan ulang', msg: job.title, tone: 'default', icon: 'refresh' });
          app.renderDock();
        }
        break;
      }
      case 'reset-demo':
        ABP.resetState();
        lastCompleted = null;
        location.hash = '#/home';
        app.render();
        app.refreshChrome();
        app.renderDock();
        ui.toast({ title: 'Data demo direset', msg: 'Semua job, kode, dan setting kembali ke awal.', tone: 'success', icon: 'refresh' });
        break;
      default:
        break;
    }
  });

  document.addEventListener('change', (e) => {
    const t = e.target.closest('[data-toggle]');
    if (!t) return;
    const key = t.dataset.toggle;
    bypassState[key] = !bypassState[key];
    t.classList.toggle('is-on', bypassState[key]);
    t.setAttribute('aria-pressed', String(bypassState[key]));
    refreshBypassPreview();
  });

  function openProfile() {
    const s = ABP.auth.session();
    const info = ABP.creditInfo();
    ui.modal({
      kicker: 'AKUN',
      title: s ? 'Halo, ' + s.name : 'Guest session',
      body:
        '<div class="profile-card">' +
        '<span class="avatar avatar-lg">' + (s ? esc(s.name.slice(0, 1).toUpperCase()) : 'G') + '</span>' +
        '<div><b>' + (s ? esc(s.name) : 'Guest user') + '</b><small>' + (s ? esc(s.tag) + ' · ' + s.role : 'Belum login · free tier') + '</small></div>' +
        '<span class="pill ' + (s ? 'pill-success' : 'pill-muted') + '"><i class="dot"></i>' + (s ? 'Session aktif' : 'Guest') + '</span>' +
        '</div>' +
        '<div class="intel-list">' +
        '<div class="intel-row"><span>Kredit</span><b>' + info.remaining + ' / ' + info.max + '</b></div>' +
        '<div class="intel-row"><span>Total job</span><b>' + ABP.state.jobs.length + '</b></div>' +
        '<div class="intel-row"><span>Tier</span><b>' + (s ? s.role.toUpperCase() : 'FREE') + '</b></div>' +
        (s ? '<div class="intel-row"><span>Session berakhir</span><b>' + U.dateTime(s.expiresAt) + '</b></div>' : '') +
        '</div>',
      footer:
        (!ABP.live ? '<button class="btn btn-ghost" data-action="reset-demo">' + icon('refresh', 15) + ' Reset data demo</button>' : '') +
        (s
          ? '<a class="btn btn-soft" href="#/admin" data-close>Panel admin</a><button class="btn btn-danger" data-action="logout">' + icon('logout', 15) + ' Logout</button>'
          : '<a class="btn btn-primary" href="#/admin" data-close>Login admin</a>'),
    });
  }

  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-action="logout"]')) {
      ABP.auth.logout();
      ui.toast({ title: 'Logout berhasil', tone: 'success', icon: 'logout' });
      document.querySelectorAll('.modal-backdrop').forEach((m) => m.remove());
      document.body.classList.remove('is-locked');
      app.render();
      app.refreshChrome();
    }
  });

  /* ------------------------------------------------------------------- chrome */
  app.refreshChrome = function () {
    renderRail();
    renderTopbar();
    renderBanner();
    renderMobileNav();
    syncNav();
  };

  app.renderDock = function () {
    ui.renderDock();
  };

  app.render = function () {
    route();
  };

  app.boot = async function () {
    try {
      ABP.live = await ABP.api.init();
      if (ABP.live) await ABP.api.bootstrap();
    } catch (err) {
      console.warn('[api] bootstrap gagal, fallback demo:', err.message);
      ABP.live = false;
    }

    if (ABP.live) {
      const active = ABP.state.jobs.find((j) => j.status === 'running' || j.status === 'queued');
      if (active) {
        ABP.state.activeJobId = active.id;
        ABP.engine.running.set(active.id, true);
        ABP.api.pollJob(active.id);
      }
    }

    renderRail();
    renderTopbar();
    renderMobileNav();
    ui.renderDock();
    route();

    window.addEventListener('hashchange', route);

    ABP.bus.on('job:start', () => {
      app.renderDock();
      app.refreshChrome();
    });
    ABP.bus.on('job:tick', (job) => {
      ui.updateDockProgress();
      if (document.getElementById('report-overlay')) ui.refreshReport();
      if (currentRoute === '#/spoof' || currentRoute === '#/get' || currentRoute === '#/video') return;
      void job;
    });
    ABP.bus.on('job:done', (job) => {
      clearBusy();
      app.renderDock();
      app.refreshChrome();
      lastCompleted = job.id;
      if (currentRoute === '#/bypass' && job.type === 'bypass') {
        app.render();
      }
      if (document.getElementById('report-overlay')) ui.refreshReport();
      ui.toast({
        title: 'Selesai · ' + job.title.slice(0, 38),
        msg: (ABP.FORMATS[job.format] || { label: job.format }).label + ' · ' + U.bytes(job.sizeBytes) + (job.type === 'bypass' ? ' · PlaybackSpeed ' + job.playbackSpeed : ''),
        tone: 'success',
        icon: 'check',
        duration: 5000,
      });
    });
    ABP.bus.on('job:cancel', () => {
      clearBusy();
      app.renderDock();
    });
    ABP.bus.on('job:failed', (job) => {
      clearBusy();
      app.renderDock();
      app.refreshChrome();
      const aborted = job && job.errorCode === 'ABORTED';
      ui.toast({
        title: aborted ? 'Job dibatalkan' : 'Job gagal',
        msg: (job && job.error) || 'Engine menolak job ini.',
        tone: aborted ? 'warn' : 'danger',
        icon: aborted ? 'x' : 'alert',
        duration: 5200,
      });
      if (currentRoute === '#/bypass') app.render();
    });

    document.addEventListener('keydown', (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;
      if (e.key === '/' && !typing) {
        e.preventDefault();
        const s = document.getElementById('search-input');
        if (s) s.focus();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        ui.commandPalette();
      }
      if (e.key === 'Escape') {
        const rail = document.getElementById('rail');
        if (rail) rail.classList.remove('is-open');
      }
    });

    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]') && e.target.closest('.modal')) {
        /* handled by modal */
      }
      const rail = document.getElementById('rail');
      if (rail && rail.classList.contains('is-open') && !e.target.closest('#rail') && !e.target.closest('[data-action="toggle-rail"]')) {
        rail.classList.remove('is-open');
      }
    });

    setInterval(() => {
      ABP.refill();
      const info = ABP.creditInfo();
      const chip = document.querySelector('.credit-chip');
      if (chip) {
        const b = chip.querySelector('b');
        if (b) b.textContent = info.remaining;
        const ring = chip.querySelector('.credit-ring');
        if (ring) ring.style.setProperty('--p', Math.min(100, (info.remaining / info.max) * 100) + '%');
      }
      const live = document.querySelector('[data-live="refill"]');
      if (live) live.textContent = U.countdown(info.nextRefillMs);
    }, 1000);
  };

  ABP.app = app;
  ABP.boot = app.boot;
})();
