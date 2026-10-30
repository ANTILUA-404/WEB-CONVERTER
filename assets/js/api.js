/* ANTIBYPASS V2 — backend bridge (live mode) with static demo fallback */
(function () {
  'use strict';

  const ABP = window.ABP;
  const api = {
    live: false,
    base: '',
    health: null,
    session: null,
    credits: null,
    polling: new Map(),
  };

  async function request(path, opts = {}) {
    const init = { method: opts.method || 'GET', credentials: 'same-origin', cache: 'no-store', headers: {} };
    if (opts.body !== undefined) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(opts.body);
    }
    if (opts.headers) Object.assign(init.headers, opts.headers);
    if (opts.signal) init.signal = opts.signal;
    const res = await fetch(api.base + path, init);
    let data = null;
    try {
      data = await res.json();
    } catch (err) {
      data = null;
    }
    if (!res.ok) {
      const error = new Error((data && data.error) || 'HTTP ' + res.status);
      error.code = data && data.code;
      error.status = res.status;
      throw error;
    }
    return data;
  }

  api.request = request;

  api.init = async function () {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(api.base + '/api/health', { cache: 'no-store', signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) return false;
      const data = await res.json();
      if (!data || !data.ok) return false;
      api.health = data;
      api.live = true;
      return true;
    } catch (err) {
      api.live = false;
      return false;
    }
  };

  function applyCredits(credits) {
    if (!credits) return;
    api.credits = credits;
    ABP.state.credits = {
      remaining: credits.remaining,
      max: credits.max,
      refillHours: ABP.state.settings.refillHours || 6,
      lastRefill: Date.now(),
    };
  }

  api.applyCredits = applyCredits;

  api.bootstrap = async function () {
    const me = await request('/api/me');
    api.session = me.session || null;
    ABP.state.session = api.session;
    ABP.state.settings = Object.assign({}, ABP.state.settings, me.settings);
    applyCredits(me.credits);
    const jobs = await request('/api/jobs');
    ABP.state.jobs = jobs.jobs || [];
    applyCredits(jobs.credits || me.credits);
    ABP.save();
    return me;
  };

  api.refreshMe = async function () {
    const me = await request('/api/me');
    api.session = me.session || null;
    ABP.state.session = api.session;
    ABP.state.settings = Object.assign({}, ABP.state.settings, me.settings);
    applyCredits(me.credits);
    ABP.save();
    return me;
  };

  api.uploadFile = async function (file) {
    const form = new FormData();
    form.append('file', file, file.name);
    const res = await fetch(api.base + '/api/upload', { method: 'POST', body: form, credentials: 'same-origin' });
    let data = null;
    try {
      data = await res.json();
    } catch (err) {
      data = null;
    }
    if (!res.ok) throw new Error((data && data.error) || 'Upload gagal.');
    return data;
  };

  api.createJob = async function (payload) {
    const data = await request('/api/jobs', { method: 'POST', body: payload });
    if (data.credits) applyCredits(data.credits);
    return data.job;
  };

  api.pollJob = function (jobId) {
    if (api.polling.has(jobId)) return;
    const timer = setInterval(async () => {
      try {
        const data = await request('/api/jobs/' + jobId);
        const remote = data.job;
        let local = ABP.state.jobs.find((j) => j.id === jobId);
        if (!local) {
          ABP.state.jobs.unshift(remote);
          local = remote;
        } else {
          Object.assign(local, remote);
        }
        ABP.state.activeJobId = jobId;
        ABP.bus.emit('job:tick', local);
        if (remote.status === 'done' || remote.status === 'failed') {
          clearInterval(timer);
          api.polling.delete(jobId);
          ABP.engine.running.delete(jobId);
          try {
            const me = await request('/api/me');
            applyCredits(me.credits);
          } catch (err) {
            /* ignore */
          }
          ABP.save();
          ABP.bus.emit(remote.status === 'done' ? 'job:done' : 'job:failed', local);
        }
      } catch (err) {
        clearInterval(timer);
        api.polling.delete(jobId);
        ABP.engine.running.delete(jobId);
      }
    }, 700);
    api.polling.set(jobId, timer);
  };

  api.runJob = async function (payload) {
    let body = {
      type: payload.type,
      source: payload.source,
      format: payload.format,
      speed: payload.speed,
      pitch: payload.pitch,
      gain: payload.gain,
      preset: payload.preset,
      normalize: payload.normalize,
      silence: payload.silence,
      trimStart: payload.trimStart,
      trimEnd: payload.trimEnd,
      customName: payload.customName,
      quality: payload.quality,
      placeId: payload.placeId,
    };
    if (payload.file) {
      const up = await api.uploadFile(payload.file);
      body.uploadId = up.uploadId;
      body.source = '';
      body.customName = body.customName || up.name.replace(/\.[^.]+$/, '');
    }
    const job = await api.createJob(body);
    const existing = ABP.state.jobs.find((j) => j.id === job.id);
    if (!existing) ABP.state.jobs.unshift(job);
    ABP.state.activeJobId = job.id;
    ABP.engine.running.set(job.id, true);
    ABP.save();
    ABP.bus.emit('job:start', job);
    api.pollJob(job.id);
    return job;
  };

  api.cancelJob = async function (jobId) {
    await request('/api/jobs/' + jobId + '/cancel', { method: 'POST' });
  };

  api.redeem = async function (code) {
    const data = await request('/api/redeem', { method: 'POST', body: { code } });
    if (data.credits) applyCredits(data.credits);
    return data;
  };

  api.adminLogin = async function (username, password) {
    const data = await request('/api/auth/login', { method: 'POST', body: { username, password } });
    api.session = data.session;
    ABP.state.session = data.session;
    ABP.save();
    return data.session;
  };

  api.adminLogout = async function () {
    try {
      await request('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      /* ignore */
    }
    api.session = null;
    ABP.state.session = null;
    ABP.save();
  };

  api.refreshAdmin = async function () {
    const [overview, codes, blacklist, users, settings, audit] = await Promise.all([
      request('/api/admin/overview'),
      request('/api/admin/codes'),
      request('/api/admin/blacklist'),
      request('/api/admin/users'),
      request('/api/admin/settings'),
      request('/api/admin/audit'),
    ]);
    ABP.state.settings = Object.assign({}, ABP.state.settings, settings.settings);
    ABP.state.codes = codes.codes || [];
    ABP.state.blacklist = blacklist.blacklist || [];
    ABP.state.users = (users.users || []).map((u) => ({
      id: u.id,
      name: u.name || 'Guest',
      tag: u.tag || u.id,
      role: u.role || 'member',
      tier: u.tier || 'free',
      credits: u.credits || 0,
      lastSeen: u.lastSeen || Date.now(),
    }));
    ABP.state.audit = audit.audit || [];
    ABP.state.adminStats = overview.stats;
    ABP.state.adminJobs = overview.jobs || [];
    ABP.state.engineInfo = overview.engine;
    ABP.save();
    return overview;
  };

  api.download = function (job) {
    if (!job || !job.downloadUrl) return false;
    const a = document.createElement('a');
    a.href = api.base + job.downloadUrl;
    a.download = job.fileName || '';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return true;
  };

  ABP.api = api;
})();
