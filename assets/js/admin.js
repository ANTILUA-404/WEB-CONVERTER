/* ANTIBYPASS V2 — admin / owner control center (client-side demo auth) */
(function () {
  'use strict';

  const ABP = window.ABP;
  const U = ABP.util;
  const icon = ABP.icon;
  const ui = ABP.ui;
  const esc = U.esc;

  async function afterAdmin() {
    await ABP.api.refreshAdmin();
    ABP.app.render();
    ABP.app.refreshChrome();
  }

  async function liveAction(action, el) {
    const S = ABP.state.settings;
    const call = ABP.api.request;
    try {
      switch (action) {
        case 'admin-maint': {
          const enabling = !S.maintenance;
          await call('/api/admin/maintenance', { method: 'POST', body: { enabled: enabling, reason: S.maintenanceReason } });
          await afterAdmin();
          ui.toast({ title: enabling ? 'Maintenance ON' : 'Maintenance OFF', msg: enabling ? 'Job publik diblokir sementara.' : 'Engine kembali terbuka.', tone: enabling ? 'warn' : 'success', icon: 'alert' });
          return true;
        }
        case 'purge-cache': {
          const r = await call('/api/admin/cache/purge', { method: 'POST' });
          await afterAdmin();
          ui.toast({ title: 'Cache dibersihkan', msg: r.removed + ' folder temp dihapus.', tone: 'success', icon: 'trash' });
          return true;
        }
        case 'toggle-code': {
          const c = ABP.state.codes.find((x) => x.code === el.dataset.code);
          await call('/api/admin/codes/' + encodeURIComponent(el.dataset.code), { method: 'PATCH', body: { active: !(c && c.active) } });
          await afterAdmin();
          ui.toast({ title: el.dataset.code + ' ' + (c && c.active ? 'dinonaktifkan' : 'diaktifkan'), tone: 'success', icon: 'eye' });
          return true;
        }
        case 'delete-code': {
          const ok = await ui.confirm({ title: 'Hapus ' + el.dataset.code + '?', msg: 'Kode dihapus permanen dari server.', confirmLabel: 'Hapus kode', danger: true });
          if (!ok) return true;
          await call('/api/admin/codes/' + encodeURIComponent(el.dataset.code), { method: 'DELETE' });
          await afterAdmin();
          ui.toast({ title: 'Kode dihapus', msg: el.dataset.code, tone: 'success', icon: 'trash' });
          return true;
        }
        case 'remove-blacklist': {
          await call('/api/admin/blacklist/' + encodeURIComponent(el.dataset.id), { method: 'DELETE' });
          await afterAdmin();
          ui.toast({ title: 'Blacklist dicabut', msg: el.dataset.id, tone: 'success', icon: 'check' });
          return true;
        }
        case 'reset-all-credits': {
          if (!ABP.auth.isOwner()) {
            ui.toast({ title: 'Khusus owner', tone: 'danger', icon: 'lock' });
            return true;
          }
          const ok = await ui.confirm({ title: 'Reset semua kredit?', msg: 'Semua saldo user dikembalikan ke batas maksimal.', confirmLabel: 'Reset semua', danger: true });
          if (!ok) return true;
          await call('/api/admin/credits/reset', { method: 'POST' });
          await afterAdmin();
          ui.toast({ title: 'Semua kredit direset', tone: 'success', icon: 'refresh' });
          return true;
        }
        case 'save-settings': {
          const body = {};
          document.querySelectorAll('[data-setting]').forEach((input) => {
            body[input.dataset.setting] = input.type === 'number' ? Number(input.value) : input.value;
          });
          document.querySelectorAll('[data-setting-toggle]').forEach((toggle) => {
            body[toggle.dataset.settingToggle] = toggle.classList.contains('is-on');
          });
          await call('/api/admin/settings', { method: 'PUT', body });
          await afterAdmin();
          ui.toast({ title: 'Setting tersimpan', msg: 'Langsung berlaku ke engine.', tone: 'success', icon: 'check' });
          return true;
        }
        case 'reset-settings': {
          if (!ABP.auth.isOwner()) {
            ui.toast({ title: 'Khusus owner', tone: 'danger', icon: 'lock' });
            return true;
          }
          const ok = await ui.confirm({ title: 'Reset semua setting?', msg: 'Semua override dikembalikan ke default.', confirmLabel: 'Reset setting', danger: true });
          if (!ok) return true;
          await call('/api/admin/settings/reset', { method: 'POST' });
          await afterAdmin();
          ui.toast({ title: 'Setting direset', tone: 'success', icon: 'refresh' });
          return true;
        }
        case 'clear-audit': {
          if (!ABP.auth.isOwner()) {
            ui.toast({ title: 'Khusus owner', tone: 'danger', icon: 'lock' });
            return true;
          }
          await call('/api/admin/audit', { method: 'DELETE' });
          await afterAdmin();
          ui.toast({ title: 'Audit log dibersihkan', tone: 'success', icon: 'trash' });
          return true;
        }
        case 'admin-logout': {
          await ABP.api.adminLogout();
          ABP.adminReady = false;
          ui.toast({ title: 'Logout', msg: 'Session panel ditutup.', tone: 'success', icon: 'logout' });
          ABP.app.render();
          ABP.app.refreshChrome();
          return true;
        }
        default:
          return false;
      }
    } catch (err) {
      ui.toast({ title: 'Aksi gagal', msg: err.message, tone: 'danger', icon: 'alert' });
      return true;
    }
  }

  const TABS = [
    { key: 'overview', label: 'Overview', icon: 'grid' },
    { key: 'queue', label: 'Queue & Engine', icon: 'activity' },
    { key: 'redeem', label: 'Kode Redeem', icon: 'gift' },
    { key: 'blacklist', label: 'Blacklist', icon: 'ban' },
    { key: 'credits', label: 'Credit Users', icon: 'wallet' },
    { key: 'settings', label: 'Settings', icon: 'sliders', owner: true },
    { key: 'audit', label: 'Audit Log', icon: 'terminal' },
  ];

  let bound = false;

  /* ------------------------------------------------------------------- gate */
  function gate() {
    return (
      '<div class="gate">' +
      '<div class="gate-bg" aria-hidden="true"></div>' +
      '<div class="gate-card">' +
      '<div class="gate-lock">' + icon('lock', 26) + '</div>' +
      '<p class="kicker">RESTRICTED AREA</p>' +
      '<h1>Control Center</h1>' +
      '<p class="gate-sub">Panel ini hanya untuk <b>Owner</b> dan <b>Admin</b>. Semua aksi tercatat di audit log.</p>' +
      '<form id="gate-form" autocomplete="off">' +
      '<label class="field-label" for="gate-user">Username</label>' +
      '<div class="input-wrap"><span class="input-ico">' + icon('users', 16) + '</span>' +
      '<input class="input" id="gate-user" placeholder="owner" autocomplete="username" /></div>' +
      '<label class="field-label" for="gate-pass">Password</label>' +
      '<div class="input-wrap"><span class="input-ico">' + icon('key', 16) + '</span>' +
      '<input class="input" id="gate-pass" type="password" placeholder="••••••••" autocomplete="current-password" />' +
      '<button type="button" class="btn btn-icon btn-ghost btn-xs input-tail" data-action="toggle-pass" aria-label="Lihat password">' + icon('eye', 15) + '</button></div>' +
      '<p class="gate-error" id="gate-error" hidden>' + icon('alert', 14) + '<span></span></p>' +
      '<button class="btn btn-primary btn-block btn-lg" type="submit">' + icon('shield', 17) + ' Masuk ke panel</button>' +
      '</form>' +
      '<div class="gate-demo">' +
      '<p class="kicker">DEMO CREDENTIALS</p>' +
      '<div class="demo-row"><span>Owner</span><code>owner / antibypass</code><button class="copy-btn" data-action="fill-login" data-user="owner" data-pass="antibypass">' + icon('copy', 13) + '</button></div>' +
      '<div class="demo-row"><span>Admin</span><code>admin / admin123</code><button class="copy-btn" data-action="fill-login" data-user="admin" data-pass="admin123">' + icon('copy', 13) + '</button></div>' +
      '</div>' +
      '<p class="gate-note">' + icon('info', 13) + ' Demo: autentikasi berjalan di sisi klien. Untuk produksi, validasi wajib di server.</p>' +
      '<a class="gate-back" href="#/home">' + icon('arrowLeft', 14) + ' Kembali ke beranda</a>' +
      '</div>' +
      '</div>'
    );
  }

  function bindGate() {
    const form = document.getElementById('gate-form');
    if (!form) return;
    const showError = (msg) => {
      const err = document.getElementById('gate-error');
      err.hidden = false;
      err.querySelector('span').textContent = msg;
      const card = document.querySelector('.gate-card');
      card.classList.remove('shake');
      void card.offsetWidth;
      card.classList.add('shake');
    };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const user = document.getElementById('gate-user').value;
      const pass = document.getElementById('gate-pass').value;

      if (ABP.live) {
        const btn = form.querySelector('button[type="submit"]');
        if (btn) btn.disabled = true;
        try {
          const session = await ABP.api.adminLogin(user, pass);
          await ABP.api.refreshAdmin();
          ABP.adminReady = true;
          ui.toast({ title: 'Selamat datang, ' + session.name, msg: 'Role: ' + (session.role === 'owner' ? 'Owner' : 'Admin') + ' · session 2 jam.', tone: 'success', icon: 'shield' });
          ABP.app.render();
          ABP.app.refreshChrome();
        } catch (err) {
          showError(err.message || 'Kredensial salah.');
        } finally {
          if (btn) btn.disabled = false;
        }
        return;
      }

      const session = ABP.auth.login(user, pass);
      if (!session) {
        showError('Kredensial salah. Coba akun demo di bawah.');
        return;
      }
      ui.toast({ title: 'Selamat datang, ' + session.name, msg: 'Role: ' + (session.role === 'owner' ? 'Owner' : 'Admin') + ' · session 2 jam.', tone: 'success', icon: 'shield' });
      ABP.app.render();
      ABP.app.refreshChrome();
    });
    const first = document.getElementById('gate-user');
    if (first) setTimeout(() => first.focus(), 120);
  }

  /* ------------------------------------------------------------------ panel */
  function adminHeader(session) {
    const roleLabel = session.role === 'owner' ? 'Owner' : 'Admin';
    return (
      '<header class="admin-head">' +
      '<div class="admin-head-left">' +
      '<p class="kicker">EXECUTIVE CONTROL CENTER</p>' +
      '<h1>Halo, ' + esc(session.name) + '.</h1>' +
      '<p class="page-desc">Semua perubahan tersimpan otomatis dan langsung berlaku ke engine publik.</p>' +
      '</div>' +
      '<div class="admin-head-right">' +
      '<div class="session-chip"><span class="avatar">' + esc(session.name.slice(0, 1).toUpperCase()) + '</span>' +
      '<div><b>' + esc(session.name) + '</b><small>' + roleLabel + ' · expires ' + U.dateTime(session.expiresAt) + '</small></div></div>' +
      '<button class="btn btn-ghost btn-sm" data-action="admin-logout">' + icon('logout', 15) + ' Logout</button>' +
      '</div>' +
      '</header>'
    );
  }

  function adminNav(session) {
    return (
      '<nav class="admin-nav">' +
      TABS.map((t) => {
        const locked = t.owner && session.role !== 'owner';
        return '<button class="admin-tab' + (ABP.adminTab === t.key ? ' is-active' : '') + '" data-admin-tab="' + t.key + '"' + (locked ? ' data-locked="1"' : '') + '>' +
          icon(t.icon, 17) + '<span>' + t.label + '</span>' + (locked ? icon('lock', 12) : '') + '</button>';
      }).join('') +
      '<div class="admin-nav-foot"><p class="kicker">ENGINE</p><p class="muted tiny">v2.4.1 · DSP rubberband</p>' +
      '<div class="engine-row"><span class="engine-dot"></span><b>Operational</b></div></div>' +
      '</nav>'
    );
  }

  function kpi(label, value, sub, color) {
    return '<div class="kpi"><span>' + label + '</span><strong style="color:' + (color || 'var(--text)') + '">' + value + '</strong><small>' + sub + '</small></div>';
  }

  function tabOverview(session) {
    const stats = ABP.live && ABP.state.adminStats ? ABP.state.adminStats : ABP.stats();
    const queueRunning = ABP.live && ABP.state.engineInfo ? ABP.state.engineInfo.queue.running : ABP.engine.running.size;
    const info = ABP.creditInfo();
    const codes = ABP.state.codes;
    const activeCodes = codes.filter((c) => c.active).length;
    const bars = ABP.art.spark('admin-load', 28, 8, 92);

    return (
      '<div class="admin-kpis">' +
      kpi('Job hari ini', stats.total, '+12% vs kemarin', 'var(--accent)') +
      kpi('Success rate', stats.successRate + '%', 'target ≥ 98%', 'var(--green)') +
      kpi('Queue aktif', queueRunning + ' / 4', 'concurrency worker', 'var(--cyan)') +
      kpi('Kredit beredar', stats.creditsCirculating != null ? stats.creditsCirculating : info.remaining, stats.users + ' akun terdaftar', 'var(--gold)') +
      '</div>' +

      '<div class="admin-grid-2">' +
      '<section class="panel"><div class="panel-head"><div><p class="kicker">THROUGHPUT</p><h3>Beban engine 28 jam</h3></div>' + ui.badge('LIVE', 'accent', true) + '</div>' +
      '<div class="panel-body"><div class="chart-bars">' +
      bars.map((v, i) => '<span class="chart-bar' + (i > 22 ? ' is-hot' : '') + '" style="height:' + Math.round(v) + '%"></span>').join('') +
      '</div><div class="chart-axis"><span>00:00</span><span>07:00</span><span>14:00</span><span>21:00</span><span>now</span></div>' +
      '<div class="chart-legend"><span>' + icon('activity', 13) + ' ' + stats.total + ' job · rata-rata 8.4s</span><span>cache ' + stats.cacheItems + ' item · ' + stats.cacheMb + ' MB</span></div>' +
      '</div></section>' +

      '<section class="panel"><div class="panel-head"><div><p class="kicker">SYSTEM</p><h3>Status layanan</h3></div></div>' +
      '<div class="panel-body"><div class="status-list">' +
      [
        ['Engine DSP', 'rubberband 1.9.2', 'ok'],
        ['Extractor', 'yt-dlp 2026.10.27', 'ok'],
        ['Roblox API', ABP.state.settings.robloxCookie || ABP.state.settings.robloxApiKey ? 'auth terpasang' : 'public mode', ABP.state.settings.robloxCookie || ABP.state.settings.robloxApiKey ? 'ok' : 'warn'],
        ['Redeem registry', activeCodes + ' aktif / ' + codes.length, 'ok'],
        ['Maintenance', ABP.isMaintenance() ? 'ON' : 'OFF', ABP.isMaintenance() ? 'warn' : 'ok'],
        ['Cache', stats.cacheMb + ' MB terpakai', 'ok'],
      ].map((r) => '<div class="status-row"><span class="status-dot is-' + r[2] + '"></span><b>' + r[0] + '</b><small>' + r[1] + '</small></div>').join('') +
      '</div>' +
      '<div class="admin-quick">' +
      '<button class="btn btn-soft btn-sm" data-action="admin-maint">' + icon('alert', 14) + ' ' + (ABP.isMaintenance() ? 'Matikan maintenance' : 'Aktifkan maintenance') + '</button>' +
      '<button class="btn btn-soft btn-sm" data-action="purge-cache">' + icon('trash', 14) + ' Purge cache</button>' +
      '</div></div></section>' +
      '</div>' +

      '<div class="admin-grid-2">' +
      '<section class="panel"><div class="panel-head"><div><p class="kicker">RECENT</p><h3>Audit terakhir</h3></div><button class="btn btn-xs btn-ghost" data-admin-tab="audit">Lihat semua</button></div>' +
      '<div class="panel-body">' + auditList(ABP.state.audit.slice(0, 5)) + '</div></section>' +

      '<section class="panel"><div class="panel-head"><div><p class="kicker">SECURITY</p><h3>Peran & akses</h3></div></div>' +
      '<div class="panel-body"><div class="intel-list">' +
      '<div class="intel-row"><span>Session aktif</span><b>' + esc(session.name) + ' · ' + session.role.toUpperCase() + '</b></div>' +
      '<div class="intel-row"><span>Owner-only settings</span><b>' + (session.role === 'owner' ? 'TERBUKA' : 'TERKUNCI') + '</b></div>' +
      '<div class="intel-row"><span>Global blacklist</span><b>' + ABP.state.blacklist.length + ' user ID</b></div>' +
      '<div class="intel-row"><span>Kontak support</span><b>' + esc(ABP.state.settings.supportContact) + '</b></div>' +
      '</div>' +
      '<div class="admin-quick"><button class="btn btn-soft btn-sm" data-admin-tab="redeem">' + icon('gift', 14) + ' Buat kode</button>' +
      '<button class="btn btn-soft btn-sm" data-admin-tab="blacklist">' + icon('ban', 14) + ' Kelola blacklist</button></div>' +
      '</div></section>' +
      '</div>'
    );
  }

  function auditList(rows) {
    return '<div class="audit-list">' +
      rows.map((a) => '<div class="audit-row"><span class="audit-dot is-' + a.level + '"></span>' +
        '<div><b>' + esc(a.action) + '</b><small>' + esc(a.detail) + '</small></div>' +
        '<span class="audit-meta">' + esc(a.actor) + ' · ' + U.ago(a.at) + '</span></div>').join('') +
      '</div>';
  }

  function tabQueue() {
    const source = ABP.live ? ABP.state.adminJobs || [] : ABP.state.jobs;
    const running = source.filter((j) => j.status === 'running' || j.status === 'queued');
    const recent = source.slice(0, 8);
    return (
      '<section class="panel"><div class="panel-head"><div><p class="kicker">LIVE</p><h3>Worker & antrean</h3></div>' + ui.badge(running.length + ' AKTIF', 'accent', true) + '</div>' +
      '<div class="panel-body">' +
      (running.length
        ? '<div class="queue-list">' + running.map((j) => '<div class="queue-row">' + ui.cover(j.artworkSeed, { className: 'row-cover' }) +
          '<div class="queue-main"><div class="queue-title"><b>' + esc(j.title) + '</b><span>' + j.progress + '%</span></div>' +
          '<div class="queue-bar"><i style="width:' + j.progress + '%"></i></div>' +
          '<small>' + esc(j.stageLabel) + '</small></div>' +
          '<button class="btn btn-icon btn-ghost" data-action="cancel-job" data-id="' + j.id + '" aria-label="Batalkan">' + icon('x', 16) + '</button>' +
          '</div>').join('') + '</div>'
        : '<div class="empty-inline-block">' + icon('activity', 22) + '<p>Engine idle. Tidak ada job berjalan.</p></div>') +
      '<div class="divider"></div>' +
      '<div class="worker-grid">' +
      [1, 2, 3, 4].map((i) => {
        const active = i <= running.length;
        return '<div class="worker' + (active ? ' is-busy' : '') + '"><span class="worker-dot"></span><b>worker-' + i + '</b><small>' + (active ? 'processing' : 'idle') + '</small></div>';
      }).join('') +
      '</div>' +
      '</div></section>' +

      '<section class="panel"><div class="panel-head"><div><p class="kicker">HISTORY</p><h3>Job terakhir</h3></div></div>' +
      '<div class="panel-body"><div class="table-wrap"><table class="table"><thead><tr><th>Job</th><th>Tipe</th><th>Status</th><th>Ukuran</th><th>Waktu</th><th></th></tr></thead><tbody>' +
      recent.map((j) => '<tr><td><div class="cell-title">' + ui.cover(j.artworkSeed, { className: 'row-cover' }) + '<div><b>' + esc(j.title) + '</b><small>' + j.id + '</small></div></div></td>' +
        '<td><span class="type-chip tone-' + ui.typeMeta(j.type).tone + '">' + ui.typeMeta(j.type).label + '</span></td>' +
        '<td>' + ui.statusPill(j.status) + '</td><td class="mono">' + U.bytes(j.sizeBytes) + '</td><td class="muted">' + U.ago(j.createdAt) + '</td>' +
        '<td><button class="btn btn-icon btn-ghost btn-xs" data-action="open-report" data-id="' + j.id + '">' + icon('external', 14) + '</button></td></tr>').join('') +
      '</tbody></table></div></div></section>'
    );
  }

  function codeStatus(c) {
    if (!c.active) return ['Nonaktif', 'muted'];
    if (c.expiresAt && c.expiresAt < Date.now()) return ['Expired', 'danger'];
    if (c.maxClaims > 0 && c.claimCount >= c.maxClaims) return ['Habis', 'danger'];
    return ['Aktif', 'success'];
  }

  function tabRedeem() {
    return (
      '<section class="panel"><div class="panel-head"><div><p class="kicker">VOUCHER REGISTRY</p><h3>Kode redeem (' + ABP.state.codes.length + ')</h3></div>' +
      '<button class="btn btn-primary btn-sm" data-action="new-code">' + icon('plus', 15) + ' Buat kode</button></div>' +
      '<div class="panel-body"><div class="table-wrap"><table class="table"><thead><tr><th>Kode</th><th>Reward</th><th>Klaim</th><th>Berlaku</th><th>Status</th><th>Catatan</th><th></th></tr></thead><tbody>' +
      (ABP.state.codes.length
        ? ABP.state.codes.map((c) => {
            const st = codeStatus(c);
            const quota = c.maxClaims === 0 ? c.claimCount + ' / ∞' : c.claimCount + ' / ' + c.maxClaims;
            return '<tr><td><button class="ps-copy" data-action="copy-code" data-code="' + esc(c.code) + '">' + esc(c.code) + icon('copy', 12) + '</button></td>' +
              '<td><b class="mono">+' + c.reward + '</b></td><td class="mono">' + quota + '</td>' +
              '<td class="muted">' + (c.expiresAt ? U.date(c.expiresAt) : 'Permanen') + '</td>' +
              '<td><span class="pill pill-' + st[1] + '"><i class="dot"></i>' + st[0] + '</span></td>' +
              '<td class="muted">' + esc(c.note || '—') + '</td>' +
              '<td class="row-actions"><button class="btn btn-icon btn-ghost btn-xs" data-action="edit-code" data-code="' + esc(c.code) + '" aria-label="Edit">' + icon('edit', 14) + '</button>' +
              '<button class="btn btn-icon btn-ghost btn-xs" data-action="toggle-code" data-code="' + esc(c.code) + '" aria-label="Aktif/nonaktif">' + icon(c.active ? 'eye' : 'eyeOff', 14) + '</button>' +
              '<button class="btn btn-icon btn-ghost btn-xs is-danger" data-action="delete-code" data-code="' + esc(c.code) + '" aria-label="Hapus">' + icon('trash', 14) + '</button></td></tr>';
          }).join('')
        : '<tr><td colspan="7"><p class="empty-inline">Belum ada kode redeem.</p></td></tr>') +
      '</tbody></table></div></div></section>' +
      '<p class="admin-hint">' + icon('info', 14) + ' Kode redeem menambah kredit di atas batas maksimal (overflow) dan tidak hangus saat recovery berjalan.</p>'
    );
  }

  function tabBlacklist() {
    return (
      '<section class="panel"><div class="panel-head"><div><p class="kicker">GLOBAL SECURITY</p><h3>Blacklist UserId (' + ABP.state.blacklist.length + ')</h3></div>' +
      '<button class="btn btn-primary btn-sm" data-action="new-blacklist">' + icon('plus', 15) + ' Tambah ID</button></div>' +
      '<div class="panel-body"><div class="table-wrap"><table class="table"><thead><tr><th>User ID</th><th>Alasan</th><th>Ditambahkan</th><th>Berakhir</th><th></th></tr></thead><tbody>' +
      (ABP.state.blacklist.length
        ? ABP.state.blacklist.map((b) => '<tr><td><b class="mono">' + esc(b.id) + '</b></td><td>' + esc(b.reason) + '</td>' +
          '<td class="muted">' + U.date(b.addedAt) + '</td><td>' + (b.expiresAt ? U.date(b.expiresAt) : '<span class="pill pill-danger"><i class="dot"></i>Permanen</span>') + '</td>' +
          '<td><button class="btn btn-icon btn-ghost btn-xs is-danger" data-action="remove-blacklist" data-id="' + esc(b.id) + '" aria-label="Cabut">' + icon('trash', 14) + '</button></td></tr>').join('')
        : '<tr><td colspan="5"><p class="empty-inline">Tidak ada User ID diblokir.</p></td></tr>') +
      '</tbody></table></div></div></section>' +
      '<p class="admin-hint">' + icon('shield', 14) + ' Blacklist berlaku global di semua server & DM. Owner tidak bisa memblokir dirinya sendiri.</p>'
    );
  }

  function tabCredits() {
    return (
      '<section class="panel"><div class="panel-head"><div><p class="kicker">QUOTA LEDGER</p><h3>Saldo pengguna</h3></div>' +
      '<button class="btn btn-soft btn-sm" data-action="reset-all-credits">' + icon('refresh', 14) + ' Reset semua</button></div>' +
      '<div class="panel-body"><div class="table-wrap"><table class="table"><thead><tr><th>User</th><th>Tier</th><th>Kredit</th><th>Terakhir aktif</th><th></th></tr></thead><tbody>' +
      ABP.state.users.map((u) => '<tr><td><div class="cell-title"><span class="avatar avatar-sm">' + esc(u.name.slice(0, 1).toUpperCase()) + '</span>' +
        '<div><b>' + esc(u.name) + '</b><small>' + esc(u.tag) + '</small></div></div></td>' +
        '<td><span class="badge badge-' + (u.tier === 'premium' ? 'gold' : u.tier === 'owner' ? 'accent' : 'muted') + '">' + u.tier.toUpperCase() + '</span></td>' +
        '<td><b class="mono">' + u.credits + '</b></td><td class="muted">' + U.ago(u.lastSeen) + '</td>' +
        '<td class="row-actions"><button class="btn btn-xs btn-soft" data-action="credit-add" data-id="' + u.id + '">+ Kredit</button>' +
        '<button class="btn btn-icon btn-ghost btn-xs" data-action="credit-set" data-id="' + u.id + '" aria-label="Set">' + icon('edit', 14) + '</button></td></tr>').join('') +
      '</tbody></table></div></div></section>' +
      '<p class="admin-hint">' + icon('wallet', 14) + ' Penambahan kredit mendukung overflow (contoh 25 + 10 = 35) dan recovery otomatis berhenti selama saldo ≥ batas.</p>'
    );
  }

  function settingRow(label, hint, inputHtml, ownerOnly, isOwner) {
    const locked = ownerOnly && !isOwner;
    return '<div class="setting-row' + (locked ? ' is-locked' : '') + '">' +
      '<div class="setting-copy"><b>' + label + (ownerOnly ? ' <span class="lock-badge">' + icon('lock', 10) + ' OWNER</span>' : '') + '</b><small>' + hint + '</small></div>' +
      '<div class="setting-input">' + (locked ? '<span class="muted tiny">Butuh role owner</span>' : inputHtml) + '</div>' +
      '</div>';
  }

  function tabSettings(session) {
    const s = ABP.state.settings;
    const isOwner = session.role === 'owner';
    return (
      '<div class="admin-grid-2">' +
      '<section class="panel"><div class="panel-head"><div><p class="kicker">ENGINE DEFAULTS</p><h3>Konversi & batas</h3></div></div><div class="panel-body">' +
      settingRow('Format default bypass', 'Berlaku untuk job baru', '<select class="input" data-setting="defaultFormat">' +
        Object.keys(ABP.FORMATS).filter((k) => ['mp3', 'ogg', 'wav', 'flac', 'm4a', 'aac', 'opus', 'wma'].includes(k))
          .map((k) => '<option value="' + k + '"' + (s.defaultFormat === k ? ' selected' : '') + '>' + k.toUpperCase() + '</option>').join('') + '</select>') +
      settingRow('Format default fresh master', 'Kualitas tertinggi', '<select class="input" data-setting="defaultGetFormat">' +
        ['mp3', 'flac', 'wav', 'm4a'].map((k) => '<option value="' + k + '"' + (s.defaultGetFormat === k ? ' selected' : '') + '>' + k.toUpperCase() + '</option>').join('') + '</select>') +
      settingRow('Kecepatan default', '0.5× – 3.0×', '<input class="input" type="number" step="0.05" min="0.5" max="3" data-setting="defaultSpeed" value="' + s.defaultSpeed + '" />') +
      settingRow('Batas durasi media', '0 = tanpa batas', '<input class="input" type="number" min="0" data-setting="maxDurationSec" value="' + s.maxDurationSec + '" />') +
      settingRow('Cooldown antar job', 'Detik', '<input class="input" type="number" min="0" max="3600" data-setting="cooldownSec" value="' + s.cooldownSec + '" />') +
      settingRow('Maks upload output', 'MB', '<input class="input" type="number" min="1" max="100" data-setting="maxFileMb" value="' + s.maxFileMb + '" />') +
      settingRow('Maks sumber unduhan', 'MB', '<input class="input" type="number" min="5" data-setting="maxSourceMb" value="' + s.maxSourceMb + '" />') +
      settingRow('Batas item bulk', '1 – 50', '<input class="input" type="number" min="1" max="50" data-setting="bulkMaxLinks" value="' + s.bulkMaxLinks + '" />') +
      '</div></section>' +

      '<section class="panel"><div class="panel-head"><div><p class="kicker">QUOTA</p><h3>Kredit & akses</h3></div></div><div class="panel-body">' +
      settingRow('Sistem kredit publik', 'Matikan untuk gratis unlimited', '<button class="switch' + (s.creditsEnabled ? ' is-on' : '') + '" data-setting-toggle="creditsEnabled"><i></i></button>') +
      settingRow('Maks kredit publik', 'Batas normal', '<input class="input" type="number" min="1" data-setting="maxCredits" value="' + s.maxCredits + '" />') +
      settingRow('Interval recovery', 'Jam per +1 kredit', '<input class="input" type="number" step="0.5" min="0.5" data-setting="refillHours" value="' + s.refillHours + '" />') +
      settingRow('Akses via DM', 'Bot bisa dipakai di DM', '<button class="switch' + (s.allowDm ? ' is-on' : '') + '" data-setting-toggle="allowDm"><i></i></button>') +
      settingRow('Resolusi video default', '2160p – 360p', '<select class="input" data-setting="defaultVideoQuality">' +
        ['2160p', '1440p', '1080p', '720p', '480p', '360p'].map((q) => '<option' + (s.defaultVideoQuality === q ? ' selected' : '') + '>' + q + '</option>').join('') + '</select>') +
      '</div></section>' +

      '<section class="panel"><div class="panel-head"><div><p class="kicker">ISPOOFERMOTION</p><h3>Roblox auth</h3></div>' + ui.badge('OWNER ONLY', 'gold') + '</div><div class="panel-body">' +
      settingRow('Roblox .ROBLOSECURITY', 'Cookie untuk asset privat', '<input class="input mono" type="password" data-setting="robloxCookie" value="' + esc(s.robloxCookie) + '" placeholder="belum dipasang" />', true, isOwner) +
      settingRow('Open Cloud API key', 'Upload otomatis', '<input class="input mono" type="password" data-setting="robloxApiKey" value="' + esc(s.robloxApiKey) + '" placeholder="belum dipasang" />', true, isOwner) +
      settingRow('Group ID upload', 'Kosong = akun user', '<input class="input" data-setting="robloxGroupId" value="' + esc(s.robloxGroupId) + '" placeholder="auto" />', true, isOwner) +
      settingRow('Override Place ID', 'Kosong = auto discover', '<input class="input" data-setting="robloxPlaceId" value="' + esc(s.robloxPlaceId) + '" placeholder="auto" />') +
      settingRow('Kontak support', 'Tampil di pesan error', '<input class="input" data-setting="supportContact" value="' + esc(s.supportContact) + '" />', true, isOwner) +
      '</div></section>' +

      '<section class="panel"><div class="panel-head"><div><p class="kicker">DANGER ZONE</p><h3>Maintenance & data</h3></div></div><div class="panel-body">' +
      settingRow('Mode maintenance', 'Blokir semua job publik', '<button class="switch' + (s.maintenance ? ' is-on' : '') + '" data-setting-toggle="maintenance"><i></i></button>') +
      settingRow('Pesan maintenance', 'Tampil di banner publik', '<input class="input" data-setting="maintenanceReason" value="' + esc(s.maintenanceReason) + '" />') +
      '<div class="danger-actions">' +
      '<button class="btn btn-ghost btn-sm" data-action="purge-cache">' + icon('trash', 14) + ' Purge cache & temp</button>' +
      '<button class="btn btn-danger btn-sm" data-action="reset-settings"' + (isOwner ? '' : ' disabled') + '>' + icon('refresh', 14) + ' Reset semua setting</button>' +
      '</div>' +
      '<p class="admin-hint">' + icon('alert', 14) + ' Reset hanya untuk owner. Semua override dikembalikan ke nilai default.</p>' +
      '</div></section>' +
      '</div>' +
      '<div class="settings-save"><span class="muted tiny">Perubahan disimpan otomatis ke state lokal.</span>' +
      '<button class="btn btn-primary" data-action="save-settings">' + icon('check', 16) + ' Simpan perubahan</button></div>'
    );
  }

  function tabAudit() {
    return (
      '<section class="panel"><div class="panel-head"><div><p class="kicker">AUDIT TRAIL</p><h3>Semua aktivitas (' + ABP.state.audit.length + ')</h3></div>' +
      '<button class="btn btn-soft btn-sm" data-action="clear-audit">' + icon('trash', 14) + ' Bersihkan</button></div>' +
      '<div class="panel-body">' + auditList(ABP.state.audit) + '</div></section>'
    );
  }

  /* ------------------------------------------------------------------ modals */
  function codeModal(existing) {
    const isEdit = Boolean(existing);
    const c = existing || { code: '', reward: 10, maxClaims: 0, note: '', expiresAt: null, active: true };
    ui.modal({
      kicker: 'VOUCHER',
      title: isEdit ? 'Edit ' + c.code : 'Buat kode redeem',
      body:
        '<div class="field-grid">' +
        '<div><label class="field-label">Kode</label><input class="input mono" id="m-code" placeholder="AUTO" value="' + esc(c.code) + '"' + (isEdit ? ' readonly' : '') + ' /></div>' +
        '<div><label class="field-label">Reward kredit</label><input class="input" id="m-reward" type="number" min="1" value="' + c.reward + '" /></div>' +
        '<div><label class="field-label">Batas klaim (0 = ∞)</label><input class="input" id="m-max" type="number" min="0" value="' + c.maxClaims + '" /></div>' +
        '<div><label class="field-label">Durasi (hari, 0 = permanen)</label><input class="input" id="m-days" type="number" min="0" value="' + (c.expiresAt ? Math.max(1, Math.round((c.expiresAt - Date.now()) / 86400000)) : 0) + '" /></div>' +
        '</div>' +
        '<label class="field-label">Catatan</label><input class="input" id="m-note" placeholder="Event launch, private drop…" value="' + esc(c.note || '') + '" />' +
        (isEdit ? '<div class="toggle-row"><div><b>Status kode</b><small>Aktif / nonaktif sementara</small></div><button class="switch' + (c.active ? ' is-on' : '') + '" id="m-active"><i></i></button></div>' : ''),
      footer:
        '<button class="btn btn-ghost" data-close>Batal</button>' +
        '<button class="btn btn-primary" id="m-save">' + (isEdit ? 'Simpan perubahan' : 'Buat kode') + '</button>',
    });
    const activeBtn = document.getElementById('m-active');
    if (activeBtn) activeBtn.addEventListener('click', () => activeBtn.classList.toggle('is-on'));
    document.getElementById('m-save').addEventListener('click', async () => {
      const reward = Math.max(1, Math.floor(Number(document.getElementById('m-reward').value) || 1));
      const maxClaims = Math.max(0, Math.floor(Number(document.getElementById('m-max').value) || 0));
      const days = Math.max(0, Math.floor(Number(document.getElementById('m-days').value) || 0));
      const note = document.getElementById('m-note').value.trim().slice(0, 80);
      let code = document.getElementById('m-code').value.trim().toUpperCase();
      if (!code || code === 'AUTO') code = 'ABV2-' + Math.random().toString(36).slice(2, 6).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
      if (!/^[A-Z0-9-]{4,24}$/.test(code)) {
        ui.toast({ title: 'Kode tidak valid', msg: 'Gunakan 4–24 karakter huruf, angka, atau tanda hubung.', tone: 'danger' });
        return;
      }
      if (ABP.live) {
        try {
          if (isEdit) {
            await ABP.api.request('/api/admin/codes/' + encodeURIComponent(existing.code), {
              method: 'PATCH',
              body: { reward, maxClaims, note, days, active: activeBtn ? activeBtn.classList.contains('is-on') : existing.active },
            });
          } else {
            await ABP.api.request('/api/admin/codes', { method: 'POST', body: { code, reward, maxClaims, note, days } });
          }
          document.querySelectorAll('.modal-backdrop').forEach((m) => m.remove());
          document.body.classList.remove('is-locked');
          await afterAdmin();
          ui.toast({ title: isEdit ? 'Kode diperbarui' : 'Kode dibuat', msg: code + ' · +' + reward + ' kredit', tone: 'success', icon: 'gift' });
        } catch (err) {
          ui.toast({ title: 'Gagal menyimpan', msg: err.message, tone: 'danger', icon: 'alert' });
        }
        return;
      }
      const expiresAt = days > 0 ? Date.now() + days * 86400000 : null;
      if (isEdit) {
        Object.assign(existing, { reward, maxClaims, note, expiresAt, active: activeBtn ? activeBtn.classList.contains('is-on') : existing.active });
        ABP.audit('Kode redeem diperbarui', code + ' · +' + reward + ' credit', 'success');
        ui.toast({ title: 'Kode diperbarui', msg: code + ' · +' + reward + ' kredit', tone: 'success', icon: 'check' });
      } else {
        if (ABP.state.codes.some((x) => x.code === code)) {
          ui.toast({ title: 'Kode sudah ada', msg: 'Gunakan kode lain atau biarkan AUTO.', tone: 'danger' });
          return;
        }
        ABP.state.codes.unshift({ code, reward, maxClaims, claimCount: 0, active: true, expiresAt, createdAt: Date.now(), note, claimedBy: [] });
        ABP.audit('Kode redeem dibuat', code + ' · +' + reward + ' credit · ' + (maxClaims || '∞') + ' klaim', 'success');
        ui.toast({ title: 'Kode dibuat', msg: code + ' · +' + reward + ' kredit', tone: 'success', icon: 'gift' });
      }
      ABP.save();
      document.querySelectorAll('.modal-backdrop').forEach((m) => m.remove());
      document.body.classList.remove('is-locked');
      ABP.app.render();
    });
  }

  function blacklistModal() {
    ui.modal({
      kicker: 'SECURITY',
      title: 'Blacklist UserId',
      body:
        '<label class="field-label">User ID (15–22 digit)</label>' +
        '<input class="input mono" id="b-id" placeholder="123456789012345678" />' +
        '<label class="field-label">Alasan</label><input class="input" id="b-reason" placeholder="Spam request / abuse endpoint" />' +
        '<label class="field-label">Durasi (hari, 0 = permanen)</label><input class="input" id="b-days" type="number" min="0" value="0" />',
      footer: '<button class="btn btn-ghost" data-close>Batal</button><button class="btn btn-danger" id="b-save">Blokir global</button>',
    });
    document.getElementById('b-save').addEventListener('click', async () => {
      const raw = document.getElementById('b-id').value.trim();
      const id = /^u_[a-f0-9]+$/.test(raw) ? raw : raw.replace(/\D/g, '');
      const reason = document.getElementById('b-reason').value.trim() || 'Melanggar ketentuan penggunaan.';
      const days = Math.max(0, Math.floor(Number(document.getElementById('b-days').value) || 0));
      if (ABP.live) {
        try {
          await ABP.api.request('/api/admin/blacklist', { method: 'POST', body: { id, reason, days } });
          document.querySelectorAll('.modal-backdrop').forEach((m) => m.remove());
          document.body.classList.remove('is-locked');
          await afterAdmin();
          ui.toast({ title: 'User diblokir global', msg: id, tone: 'success', icon: 'ban' });
        } catch (err) {
          ui.toast({ title: 'Gagal memblokir', msg: err.message, tone: 'danger', icon: 'alert' });
        }
        return;
      }
      if (!/^\d{15,22}$/.test(id)) {
        ui.toast({ title: 'User ID tidak valid', msg: 'Masukkan 15–22 digit angka.', tone: 'danger' });
        return;
      }
      if (ABP.state.blacklist.some((b) => b.id === id)) {
        ui.toast({ title: 'Sudah diblacklist', tone: 'warn' });
        return;
      }
      ABP.state.blacklist.unshift({ id, reason, addedAt: Date.now(), expiresAt: days ? Date.now() + days * 86400000 : null });
      ABP.audit('Blacklist ditambahkan', id, 'warn');
      ABP.save();
      document.querySelectorAll('.modal-backdrop').forEach((m) => m.remove());
      document.body.classList.remove('is-locked');
      ui.toast({ title: 'User diblokir global', msg: id, tone: 'success', icon: 'ban' });
      ABP.app.render();
    });
  }

  function creditModal(userId, mode) {
    const user = ABP.state.users.find((u) => u.id === userId);
    if (!user) return;
    ui.modal({
      kicker: 'QUOTA',
      title: (mode === 'set' ? 'Set saldo · ' : 'Tambah kredit · ') + user.name,
      body:
        '<div class="intel-list"><div class="intel-row"><span>Saldo sekarang</span><b>' + user.credits + '</b></div>' +
        '<div class="intel-row"><span>Tier</span><b>' + user.tier.toUpperCase() + '</b></div></div>' +
        '<label class="field-label">' + (mode === 'set' ? 'Saldo baru' : 'Jumlah kredit') + '</label>' +
        '<input class="input" id="c-amount" type="number" min="0" value="' + (mode === 'set' ? user.credits : 5) + '" />',
      footer: '<button class="btn btn-ghost" data-close>Batal</button><button class="btn btn-primary" id="c-save">Simpan</button>',
    });
    document.getElementById('c-save').addEventListener('click', async () => {
      const n = Math.max(0, Math.floor(Number(document.getElementById('c-amount').value) || 0));
      if (ABP.live) {
        try {
          await ABP.api.request('/api/admin/users/' + encodeURIComponent(user.id) + '/credits', { method: 'POST', body: { action: mode === 'set' ? 'set' : 'add', amount: n } });
          document.querySelectorAll('.modal-backdrop').forEach((m) => m.remove());
          document.body.classList.remove('is-locked');
          await afterAdmin();
          ui.toast({ title: 'Saldo diperbarui', msg: user.name, tone: 'success', icon: 'wallet' });
        } catch (err) {
          ui.toast({ title: 'Gagal memperbarui', msg: err.message, tone: 'danger', icon: 'alert' });
        }
        return;
      }
      user.credits = mode === 'set' ? n : user.credits + n;
      ABP.audit(mode === 'set' ? 'Saldo kredit di-set' : 'Kredit ditambahkan', user.name + ' → ' + user.credits, 'success');
      ABP.save();
      document.querySelectorAll('.modal-backdrop').forEach((m) => m.remove());
      document.body.classList.remove('is-locked');
      ui.toast({ title: 'Saldo diperbarui', msg: user.name + ' · ' + user.credits + ' kredit', tone: 'success', icon: 'wallet' });
      ABP.app.render();
    });
  }

  /* ----------------------------------------------------------------- actions */
  async function handleAction(action, el) {
    if (ABP.live) {
      const handled = await liveAction(action, el);
      if (handled) return;
    }
    switch (action) {
      case 'toggle-pass': {
        const p = document.getElementById('gate-pass');
        if (p) p.type = p.type === 'password' ? 'text' : 'password';
        break;
      }
      case 'fill-login': {
        const u = document.getElementById('gate-user');
        const p = document.getElementById('gate-pass');
        if (u && p) {
          u.value = el.dataset.user;
          p.value = el.dataset.pass;
          p.focus();
        }
        break;
      }
      case 'admin-logout':
        ABP.auth.logout();
        ui.toast({ title: 'Logout', msg: 'Session panel ditutup.', tone: 'success', icon: 'logout' });
        ABP.app.render();
        ABP.app.refreshChrome();
        break;
      case 'admin-maint':
        ABP.state.settings.maintenance = !ABP.state.settings.maintenance;
        ABP.audit('Maintenance ' + (ABP.state.settings.maintenance ? 'diaktifkan' : 'dimatikan'), 'oleh ' + ABP.auth.session().user, ABP.state.settings.maintenance ? 'warn' : 'success');
        ABP.save();
        ABP.app.refreshChrome();
        ABP.app.render();
        ui.toast({
          title: ABP.state.settings.maintenance ? 'Maintenance ON' : 'Maintenance OFF',
          msg: ABP.state.settings.maintenance ? 'Job publik diblokir sementara.' : 'Engine kembali terbuka untuk publik.',
          tone: ABP.state.settings.maintenance ? 'warn' : 'success',
          icon: 'alert',
        });
        break;
      case 'purge-cache':
        ABP.audit('Cache dibersihkan', '412 item · 286 MB dibebaskan', 'info');
        ABP.save();
        ui.toast({ title: 'Cache dibersihkan', msg: '412 item · 286 MB dibebaskan.', tone: 'success', icon: 'trash' });
        ABP.app.render();
        break;
      case 'new-code':
        codeModal(null);
        break;
      case 'edit-code': {
        const c = ABP.state.codes.find((x) => x.code === el.dataset.code);
        if (c) codeModal(c);
        break;
      }
      case 'toggle-code': {
        const c = ABP.state.codes.find((x) => x.code === el.dataset.code);
        if (c) {
          c.active = !c.active;
          ABP.audit('Status kode diubah', c.code + ' → ' + (c.active ? 'aktif' : 'nonaktif'), 'info');
          ABP.save();
          ui.toast({ title: c.code + ' ' + (c.active ? 'diaktifkan' : 'dinonaktifkan'), tone: 'success', icon: 'eye' });
          ABP.app.render();
        }
        break;
      }
      case 'copy-code':
        U.copy(el.dataset.code).then((ok) => ui.toast({ title: ok ? 'Kode disalin' : 'Gagal menyalin', msg: el.dataset.code, tone: ok ? 'success' : 'danger', icon: 'copy' }));
        break;
      case 'delete-code': {
        const code = el.dataset.code;
        ui.confirm({ title: 'Hapus ' + code + '?', msg: 'Kode akan dihapus permanen dan tidak bisa diklaim lagi.', confirmLabel: 'Hapus kode', danger: true }).then((ok) => {
          if (!ok) return;
          ABP.state.codes = ABP.state.codes.filter((x) => x.code !== code);
          ABP.audit('Kode redeem dihapus', code, 'warn');
          ABP.save();
          ui.toast({ title: 'Kode dihapus', msg: code, tone: 'success', icon: 'trash' });
          ABP.app.render();
        });
        break;
      }
      case 'new-blacklist':
        blacklistModal();
        break;
      case 'remove-blacklist': {
        const id = el.dataset.id;
        ABP.state.blacklist = ABP.state.blacklist.filter((b) => b.id !== id);
        ABP.audit('Blacklist dicabut', id, 'success');
        ABP.save();
        ui.toast({ title: 'Blacklist dicabut', msg: id, tone: 'success', icon: 'check' });
        ABP.app.render();
        break;
      }
      case 'credit-add':
        creditModal(el.dataset.id, 'add');
        break;
      case 'credit-set':
        creditModal(el.dataset.id, 'set');
        break;
      case 'reset-all-credits': {
        if (!ABP.auth.isOwner()) {
          ui.toast({ title: 'Khusus owner', msg: 'Reset massal hanya untuk owner.', tone: 'danger', icon: 'lock' });
          return;
        }
        ui.confirm({ title: 'Reset semua kredit?', msg: 'Semua saldo user dikembalikan ke batas maksimal ' + ABP.state.settings.maxCredits + '.', confirmLabel: 'Reset semua', danger: true }).then((ok) => {
          if (!ok) return;
          ABP.state.users.forEach((u) => { u.credits = ABP.state.settings.maxCredits; });
          ABP.state.credits.remaining = ABP.state.settings.maxCredits;
          ABP.state.credits.lastRefill = Date.now();
          ABP.audit('Reset semua kredit', ABP.state.users.length + ' akun', 'warn');
          ABP.save();
          ui.toast({ title: 'Semua kredit direset', tone: 'success', icon: 'refresh' });
          ABP.app.render();
          ABP.app.refreshChrome();
        });
        break;
      }
      case 'save-settings': {
        const session = ABP.auth.session();
        document.querySelectorAll('[data-setting]').forEach((input) => {
          const key = input.dataset.setting;
          if (['robloxCookie', 'robloxApiKey', 'supportContact'].includes(key) && session.role !== 'owner') return;
          let v = input.value;
          if (input.type === 'number') v = Number(v);
          if (typeof ABP.state.settings[key] === 'number' && Number.isFinite(Number(v))) v = Number(v);
          ABP.state.settings[key] = v;
        });
        if (ABP.state.settings.maxCredits < 1) ABP.state.settings.maxCredits = 1;
        if (ABP.state.settings.refillHours < 0.5) ABP.state.settings.refillHours = 0.5;
        ABP.audit('Setting diperbarui', 'engine defaults & quota', 'success');
        ABP.save();
        ABP.app.refreshChrome();
        ui.toast({ title: 'Setting tersimpan', msg: 'Perubahan langsung berlaku ke engine publik.', tone: 'success', icon: 'check' });
        ABP.app.render();
        break;
      }
      case 'reset-settings': {
        if (!ABP.auth.isOwner()) {
          ui.toast({ title: 'Khusus owner', tone: 'danger', icon: 'lock' });
          return;
        }
        ui.confirm({ title: 'Reset semua setting?', msg: 'Semua override dikembalikan ke nilai default engine.', confirmLabel: 'Reset setting', danger: true }).then((ok) => {
          if (!ok) return;
          const def = {
            maxCredits: 25, refillHours: 6, creditsEnabled: true, maxDurationSec: 0, cooldownSec: 30,
            maxFileMb: 25, maxSourceMb: 500, defaultFormat: 'ogg', defaultGetFormat: 'mp3', defaultSpeed: 2.3,
            defaultVideoQuality: '1080p', bulkMaxLinks: 10, allowDm: true, maintenance: false,
            maintenanceReason: 'Engine sedang di-upgrade ke DSP v2.4 — kembali dalam 15 menit.',
            supportContact: '@xelzlovecean_33932', robloxCookie: '', robloxApiKey: '', robloxGroupId: '', robloxPlaceId: '',
          };
          Object.assign(ABP.state.settings, def);
          ABP.audit('Setting direset', 'kembali ke default', 'warn');
          ABP.save();
          ABP.app.refreshChrome();
          ABP.app.render();
          ui.toast({ title: 'Setting direset', tone: 'success', icon: 'refresh' });
        });
        break;
      }
      case 'clear-audit':
        ABP.state.audit = [];
        ABP.save();
        ABP.app.render();
        ui.toast({ title: 'Audit log dibersihkan', tone: 'success', icon: 'trash' });
        break;
      default:
        break;
    }
  }

  /* ------------------------------------------------------------------ render */
  function bindPanel() {
    if (bound) return;
    bound = true;
    document.addEventListener('click', (e) => {
      const tab = e.target.closest('[data-admin-tab]');
      if (tab) {
        if (tab.dataset.locked === '1') {
          ui.toast({ title: 'Khusus owner', msg: 'Tab settings hanya terbuka untuk role owner.', tone: 'danger', icon: 'lock' });
          return;
        }
        ABP.adminTab = tab.dataset.adminTab;
        ABP.app.render();
        return;
      }
      const toggle = e.target.closest('[data-setting-toggle]');
      if (toggle) {
        const key = toggle.dataset.settingToggle;
        ABP.state.settings[key] = !ABP.state.settings[key];
        toggle.classList.toggle('is-on', ABP.state.settings[key]);
        if (key === 'maintenance') {
          ABP.audit('Maintenance ' + (ABP.state.settings.maintenance ? 'diaktifkan' : 'dimatikan'), 'via settings', ABP.state.settings.maintenance ? 'warn' : 'success');
          ABP.app.refreshChrome();
        }
        ABP.save();
        return;
      }
      const el = e.target.closest('[data-action]');
      if (!el) return;
      if (!el.closest('.admin-shell') && !el.closest('.gate')) return;
      handleAction(el.dataset.action, el);
    });
  }

  ABP.renderAdmin = function (view) {
    const session = ABP.auth.session();
    if (!session) {
      view.innerHTML = gate();
      bindGate();
      document.title = 'Restricted · ANTIBYPASS V2';
      return;
    }
    if (ABP.live && !ABP.adminReady) {
      ABP.adminReady = true;
      ABP.api
        .refreshAdmin()
        .then(() => ABP.app.render())
        .catch((err) => ui.toast({ title: 'Gagal memuat data admin', msg: err.message, tone: 'danger', icon: 'alert' }));
    }
    ABP.adminTab = ABP.adminTab || 'overview';
    const tab = TABS.some((t) => t.key === ABP.adminTab) ? ABP.adminTab : 'overview';
    if (tab === 'settings' && session.role !== 'owner') {
      ABP.adminTab = 'overview';
      ABP.app.render();
      return;
    }
    let body = '';
    if (tab === 'overview') body = tabOverview(session);
    if (tab === 'queue') body = tabQueue();
    if (tab === 'redeem') body = tabRedeem();
    if (tab === 'blacklist') body = tabBlacklist();
    if (tab === 'credits') body = tabCredits();
    if (tab === 'settings') body = tabSettings(session);
    if (tab === 'audit') body = tabAudit();

    view.innerHTML =
      '<div class="admin-shell">' +
      adminHeader(session) +
      '<div class="admin-layout">' + adminNav(session) + '<div class="admin-content">' + body + '</div></div>' +
      '</div>';
    bindPanel();
    document.title = 'Control Center · ANTIBYPASS V2';
  };

  ABP.adminTab = 'overview';
})();
