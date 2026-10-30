'use strict';

const crypto = require('crypto');
const { env } = require('./env');
const { parseCookies, setCookie, clearCookie, sendJson } = require('./http');

const UID_COOKIE = 'abp_uid';
const SID_COOKIE = 'abp_sid';

function hmac(secret, value) {
  return crypto.createHmac('sha256', secret).update(value).digest('hex');
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

class Auth {
  constructor(store) {
    this.store = store;
    this.secret = env.SECRET || store.data.secret;
  }

  ensureUser(req, res) {
    const cookies = parseCookies(req);
    const raw = cookies[UID_COOKIE];
    let id = null;
    if (raw) {
      const [candidate, sig] = String(raw).split('.');
      if (candidate && sig && safeEqual(sig, hmac(this.secret, candidate).slice(0, 24))) {
        id = candidate;
      }
    }
    if (!id) {
      id = 'u_' + crypto.randomBytes(9).toString('hex');
      const value = id + '.' + hmac(this.secret, id).slice(0, 24);
      setCookie(res, UID_COOKIE, value, { maxAge: 365 * 24 * 3600, httpOnly: true, sameSite: 'Lax' });
    }
    const user = this.store.ensureUser(id);
    const blocked = this.store.isBlacklisted(id);
    return { user, blocked };
  }

  login(username, password) {
    const accounts = [
      { user: env.OWNER_USER, pass: env.OWNER_PASS, role: 'owner', name: 'Owner' },
      { user: env.ADMIN_USER, pass: env.ADMIN_PASS, role: 'admin', name: 'Studio Admin' },
    ];
    for (const acc of accounts) {
      if (
        safeEqual(String(username || '').trim().toLowerCase(), acc.user.toLowerCase()) &&
        safeEqual(String(password || ''), acc.pass)
      ) {
        const token = this.store.createSession(acc.user, acc.role, acc.name);
        this.store.audit('Login panel admin', acc.user + ' · role ' + acc.role, 'success', acc.user);
        return { token, role: acc.role, name: acc.name, user: acc.user, expiresAt: Date.now() + 2 * 3600_000 };
      }
    }
    return null;
  }

  sessionFromReq(req) {
    const cookies = parseCookies(req);
    return this.store.session(cookies[SID_COOKIE]);
  }

  attachSessionCookie(res, token) {
    setCookie(res, SID_COOKIE, token, { maxAge: 2 * 3600, httpOnly: true, sameSite: 'Lax' });
  }

  logout(req, res) {
    const cookies = parseCookies(req);
    this.store.destroySession(cookies[SID_COOKIE]);
    clearCookie(res, SID_COOKIE);
  }

  requireSession(req, res) {
    const session = this.sessionFromReq(req);
    if (!session) {
      sendJson(res, 401, { error: 'Butuh login admin.' });
      return null;
    }
    return session;
  }

  requireOwner(req, res) {
    const session = this.requireSession(req, res);
    if (!session) return null;
    if (session.role !== 'owner') {
      sendJson(res, 403, { error: 'Aksi ini khusus owner.' });
      return null;
    }
    return session;
  }
}

module.exports = { Auth, UID_COOKIE, SID_COOKIE };
