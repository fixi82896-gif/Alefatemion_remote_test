'use strict';

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 3000);
const HOST = '0.0.0.0';
const ROOT = path.resolve(__dirname, 'pwa');
const IDENTITY_BASE = String(process.env.PWA_IDENTITY_BASE_URL || 'https://alfatemiun-identity-test.liara.run').replace(/\/$/, '');
const CONFIG_URL = String(process.env.PWA_CONFIG_URL || 'https://raw.githubusercontent.com/fixi82896-gif/Alefatemion_remote/main/app-config.json');
const ABR_BASE = 'https://abrehamrahi.ir';
const COOKIE_PREFIX = 'alef_pwa_';
const VERSION_NAME = 'PWA Test 1';
const VERSION_CODE = 1;
const MAX_BODY = 256 * 1024;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8'
};

function setSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' data: https:",
    "media-src 'self' blob: https:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self'",
    "connect-src 'self' https:",
    "manifest-src 'self'"
  ].join('; '));
}

function json(res, status, body) {
  setSecurityHeaders(res);
  const data = Buffer.from(JSON.stringify(body));
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': data.length
  });
  res.end(data);
}

function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

function secureCookie(name, value, maxAge) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

function clearCookie(name) {
  return `${name}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

function setSessionCookies(res, session, installId) {
  const accessMax = Math.max(60, Number(session.access_expires_in_seconds || 900));
  const refreshMax = Math.max(300, Number(session.refresh_expires_in_seconds || 2592000));
  res.setHeader('Set-Cookie', [
    secureCookie(`${COOKIE_PREFIX}access`, session.access_token, accessMax),
    secureCookie(`${COOKIE_PREFIX}refresh`, session.refresh_token, refreshMax),
    secureCookie(`${COOKIE_PREFIX}install`, installId, refreshMax)
  ]);
}

function clearSessionCookies(res) {
  res.setHeader('Set-Cookie', [
    clearCookie(`${COOKIE_PREFIX}access`),
    clearCookie(`${COOKIE_PREFIX}refresh`),
    clearCookie(`${COOKIE_PREFIX}install`)
  ]);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > MAX_BODY) {
        reject(Object.assign(new Error('body_too_large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(Object.assign(new Error('invalid_json'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function requestJson(urlString, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    if (url.protocol !== 'https:') return reject(new Error('https_required'));
    const payload = body == null ? null : Buffer.from(JSON.stringify(body));
    const req = https.request(url, {
      method: options.method || (payload ? 'POST' : 'GET'),
      timeout: 15000,
      headers: {
        Accept: 'application/json',
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': payload.length } : {}),
        ...(options.headers || {})
      }
    }, (resp) => {
      const chunks = [];
      let total = 0;
      resp.on('data', (chunk) => {
        total += chunk.length;
        if (total > 6 * 1024 * 1024) {
          resp.destroy(new Error('upstream_too_large'));
          return;
        }
        chunks.push(chunk);
      });
      resp.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        let parsed = {};
        try { parsed = raw ? JSON.parse(raw) : {}; } catch { parsed = { error: { code: 'UPSTREAM_INVALID_JSON', message: raw.slice(0, 200) } }; }
        resolve({ status: resp.statusCode || 502, body: parsed });
      });
    });
    req.on('timeout', () => req.destroy(new Error('upstream_timeout')));
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function accountHeaders(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`,
    'X-Alefatemion-Platform': 'pwa',
    'X-Alefatemion-Version-Name': VERSION_NAME,
    'X-Alefatemion-Version-Code': String(VERSION_CODE)
  };
}

async function refreshSession(req, res) {
  const cookies = parseCookies(req);
  const refresh = cookies[`${COOKIE_PREFIX}refresh`];
  const install = cookies[`${COOKIE_PREFIX}install`];
  if (!refresh || !install) return null;
  const result = await requestJson(`${IDENTITY_BASE}/v1/identity/session/refresh`, {}, {
    request_id: crypto.randomUUID(), install_id: install, refresh_token: refresh
  });
  if (result.status !== 200 || !result.body.session) return null;
  setSessionCookies(res, result.body.session, install);
  return result.body.session.access_token;
}

async function authenticatedRequest(req, res, apiPath, method = 'GET', body = null) {
  const cookies = parseCookies(req);
  let access = cookies[`${COOKIE_PREFIX}access`];
  if (!access) access = await refreshSession(req, res);
  if (!access) return { status: 401, body: { error: { code: 'SESSION_REQUIRED', message: 'ورود مجدد لازم است.' } } };

  let result = await requestJson(`${IDENTITY_BASE}${apiPath}`, { method, headers: accountHeaders(access) }, body);
  if (result.status === 401) {
    const renewed = await refreshSession(req, res);
    if (!renewed) return result;
    result = await requestJson(`${IDENTITY_BASE}${apiPath}`, { method, headers: accountHeaders(renewed) }, body);
  }
  return result;
}

function sameOriginRequest(req) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method || 'GET')) return true;
  const origin = String(req.headers.origin || '').trim();
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    return parsed.host === String(req.headers.host || '').trim() && ['https:', 'http:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function normalizePhone(raw) {
  const digits = String(raw || '').replace(/[^0-9]/g, '');
  if (/^09\d{9}$/.test(digits)) return `+98${digits.slice(1)}`;
  if (/^989\d{9}$/.test(digits)) return `+${digits}`;
  if (/^9\d{9}$/.test(digits)) return `+98${digits}`;
  return '';
}

async function handleApi(req, res, url) {
  if (!sameOriginRequest(req)) return json(res, 403, { error: { code: 'ORIGIN_REJECTED', message: 'درخواست نامعتبر است.' } });
  if (url.pathname === '/api/health') {
    return json(res, 200, { status: 'ok', version: VERSION_NAME, identity: IDENTITY_BASE });
  }
  if (url.pathname === '/api/config') {
    try {
      const result = await requestJson(CONFIG_URL);
      return json(res, result.status, result.body);
    } catch {
      return json(res, 502, { error: { code: 'CONFIG_UNAVAILABLE', message: 'تنظیمات برنامه در دسترس نیست.' } });
    }
  }
  if (url.pathname === '/api/media/list') {
    const hash = String(url.searchParams.get('hash') || '');
    if (!/^[A-Za-z0-9_-]{8,128}$/.test(hash)) return json(res, 400, { error: { code: 'INVALID_HASH', message: 'شناسه آلبوم نامعتبر است.' } });
    try {
      const target = `${ABR_BASE}/api/v4/sharing/list-shared-objects/?obj_hash=${encodeURIComponent(hash)}&recursive=false&limit=1000`;
      const result = await requestJson(target, { headers: { 'Accept-Language': 'fa', 'user-device': 'web-mobile' } });
      return json(res, result.status, result.body);
    } catch {
      return json(res, 502, { error: { code: 'MEDIA_UNAVAILABLE', message: 'دریافت آلبوم انجام نشد.' } });
    }
  }

  if (url.pathname === '/api/auth/register' && req.method === 'POST') {
    const body = await readBody(req);
    const phone = normalizePhone(body.phone);
    const installId = String(body.install_id || '');
    if (!phone || !/^[0-9a-f-]{36}$/i.test(installId)) return json(res, 400, { error: { code: 'INVALID_REQUEST', message: 'شماره همراه یا شناسه دستگاه نامعتبر است.' } });
    const result = await requestJson(`${IDENTITY_BASE}/v1/identity/installations/register`, {}, {
      request_id: crypto.randomUUID(),
      install_id: installId,
      display_name: 'عضو آل فاطمیون',
      phone_e164: phone,
      privacy_notice_version: 1,
      privacy_accepted_at: new Date().toISOString(),
      client: { platform: 'pwa', version_name: VERSION_NAME, version_code: VERSION_CODE }
    });
    return json(res, result.status, result.body);
  }

  if (url.pathname === '/api/auth/otp/request' && req.method === 'POST') {
    const body = await readBody(req);
    const result = await requestJson(`${IDENTITY_BASE}/v1/identity/otp/request`, {}, {
      request_id: crypto.randomUUID(), registration_id: body.registration_id, install_id: body.install_id
    });
    return json(res, result.status, result.body);
  }

  if (url.pathname === '/api/auth/otp/verify' && req.method === 'POST') {
    const body = await readBody(req);
    const result = await requestJson(`${IDENTITY_BASE}/v1/identity/otp/verify`, {}, {
      request_id: crypto.randomUUID(), registration_id: body.registration_id,
      otp_request_id: body.otp_request_id, install_id: body.install_id, code: String(body.code || '')
    });
    if (result.status === 200 && result.body.session) {
      setSessionCookies(res, result.body.session, body.install_id);
      const safe = { ...result.body, session: { active: true } };
      return json(res, 200, safe);
    }
    return json(res, result.status, result.body);
  }

  if (url.pathname === '/api/auth/logout' && req.method === 'POST') {
    const cookies = parseCookies(req);
    const refresh = cookies[`${COOKIE_PREFIX}refresh`];
    const install = cookies[`${COOKIE_PREFIX}install`];
    if (refresh && install) {
      try {
        await requestJson(`${IDENTITY_BASE}/v1/identity/session/logout`, {}, {
          request_id: crypto.randomUUID(), install_id: install, refresh_token: refresh
        });
      } catch { /* best effort */ }
    }
    clearSessionCookies(res);
    return json(res, 200, { logged_out: true });
  }

  const simpleRoutes = new Map([
    ['/api/account/me', '/v1/account/me'],
    ['/api/account/permissions', '/v1/account/permissions'],
    ['/api/account/installations', '/v1/account/installations'],
    ['/api/account/messages', '/v1/account/messages']
  ]);
  if (simpleRoutes.has(url.pathname)) {
    const target = simpleRoutes.get(url.pathname);
    const body = ['POST', 'PATCH', 'PUT'].includes(req.method) ? await readBody(req) : null;
    const result = await authenticatedRequest(req, res, target, req.method, body);
    if (result.status === 401) clearSessionCookies(res);
    return json(res, result.status, result.body);
  }

  let match = /^\/api\/account\/installations\/([0-9a-f-]{36})(\/history)?$/i.exec(url.pathname);
  if (match && req.method === 'DELETE') {
    const target = `/v1/account/installations/${match[1]}${match[2] || ''}`;
    const result = await authenticatedRequest(req, res, target, 'DELETE');
    if (result.status === 401) clearSessionCookies(res);
    return json(res, result.status, result.body);
  }

  match = /^\/api\/account\/messages\/([0-9a-f-]{36})\/read$/i.exec(url.pathname);
  if (match && req.method === 'POST') {
    const result = await authenticatedRequest(req, res, `/v1/account/messages/${match[1]}/read`, 'POST', {});
    return json(res, result.status, result.body);
  }

  return json(res, 404, { error: { code: 'NOT_FOUND', message: 'مسیر پیدا نشد.' } });
}

function serveStatic(req, res, url) {
  let pathname = url.pathname === '/' ? '/index.html' : url.pathname;
  try { pathname = decodeURIComponent(pathname); } catch { return json(res, 400, { error: { code: 'BAD_PATH' } }); }
  const file = path.resolve(ROOT, '.' + pathname);
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) return json(res, 403, { error: { code: 'FORBIDDEN' } });
  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) {
      if (!path.extname(pathname)) return serveStatic(req, res, new URL('/index.html', `http://${req.headers.host || 'localhost'}`));
      return json(res, 404, { error: { code: 'NOT_FOUND' } });
    }
    setSecurityHeaders(res);
    res.statusCode = 200;
    res.setHeader('Content-Type', MIME[path.extname(file).toLowerCase()] || 'application/octet-stream');
    res.setHeader('Cache-Control', path.basename(file) === 'sw.js' || path.extname(file) === '.html' || path.extname(file) === '.webmanifest' ? 'no-cache, no-store, must-revalidate' : 'public, max-age=3600');
    res.setHeader('Content-Length', stat.size);
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    if (!['GET', 'HEAD'].includes(req.method)) return json(res, 405, { error: { code: 'METHOD_NOT_ALLOWED' } });
    return serveStatic(req, res, url);
  } catch (error) {
    console.error('[pwa]', error && error.stack ? error.stack : error);
    if (!res.headersSent) return json(res, error.status || 500, { error: { code: 'SERVICE_UNAVAILABLE', message: 'سرویس موقتاً در دسترس نیست.' } });
    res.end();
  }
});

server.listen(PORT, HOST, () => console.log(`[pwa] ${VERSION_NAME} listening on ${HOST}:${PORT}; identity=${IDENTITY_BASE}`));
