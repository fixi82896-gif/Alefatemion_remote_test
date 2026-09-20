'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = Number(process.env.PORT || 3000);
const HOST = '0.0.0.0';

const SITE_ROOT = path.join(__dirname, 'docs');
const PWA_ROOT = path.join(__dirname, 'docs', 'pwa');
const SYNC_SCRIPT = path.join(__dirname, 'scripts', 'sync-remote.mjs');
const REMOTE_SYNC_INTERVAL_MS = Math.max(60000, Number(process.env.REMOTE_SYNC_INTERVAL_MS || 300000));
let remoteSyncRunning = false;
let remoteSyncLastOk = 0;
let remoteSyncLastError = '';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

function requestHost(req) {
  const forwarded = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim();
  const host = forwarded || String(req.headers.host || '');
  return host.toLowerCase().replace(/:\d+$/, '');
}

function securityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
}

function cacheHeaders(res, filePath) {
  const name = path.basename(filePath).toLowerCase();
  const ext = path.extname(filePath).toLowerCase();

  if (name === 'sw.js' || ext === '.html') {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    return;
  }

  if (ext === '.js' || ext === '.css' || ext === '.webmanifest') {
    res.setHeader('Cache-Control', 'public, max-age=60, must-revalidate');
    return;
  }

  res.setHeader('Cache-Control', 'public, max-age=86400');
}

function safeFile(root, pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  if (decoded.includes('\0')) return null;

  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const resolved = path.resolve(root, relative);
  const rootResolved = path.resolve(root) + path.sep;

  if (resolved !== path.resolve(root) && !resolved.startsWith(rootResolved)) {
    return null;
  }

  return resolved;
}

function sendText(res, status, body, contentType = 'text/plain; charset=utf-8') {
  securityHeaders(res);
  res.statusCode = status;
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'no-store');
  res.end(body);
}

function redirect(res, location, status = 302) {
  securityHeaders(res);
  res.statusCode = status;
  res.setHeader('Location', location);
  res.setHeader('Cache-Control', 'no-store');
  res.end();
}

function serveFile(req, res, root, pathname) {
  const filePath = safeFile(root, pathname);
  if (!filePath) {
    sendText(res, 400, 'Bad request');
    return;
  }

  fs.stat(filePath, (error, stat) => {
    if (error || !stat.isFile()) {
      sendText(res, 404, 'Not found');
      return;
    }

    securityHeaders(res);
    cacheHeaders(res, filePath);

    const ext = path.extname(filePath).toLowerCase();
    res.statusCode = 200;
    res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
    res.setHeader('Content-Length', stat.size);

    if (req.method === 'HEAD') {
      res.end();
      return;
    }

    const stream = fs.createReadStream(filePath);
    stream.on('error', () => {
      if (!res.headersSent) sendText(res, 500, 'Server error');
      else res.destroy();
    });
    stream.pipe(res);
  });
}

const server = http.createServer((req, res) => {
  if (!['GET', 'HEAD'].includes(req.method || '')) {
    sendText(res, 405, 'Method not allowed');
    return;
  }

  const host = requestHost(req);
  const url = new URL(req.url || '/', 'http://localhost');
  const pathname = url.pathname;

  if (pathname === '/health') {
    sendText(
      res,
      200,
      JSON.stringify({
        ok: true,
        service: 'alefatemion-web',
        host,
        remote_sync: {
          running: remoteSyncRunning,
          last_ok: remoteSyncLastOk || null,
          last_error: remoteSyncLastError || null
        }
      }),
      'application/json; charset=utf-8'
    );
    return;
  }

  if (host === 'www.alefatemion.ir') {
    redirect(res, 'https://alefatemion.ir' + pathname + url.search, 301);
    return;
  }

  /*
   * داده‌ها و دارایی‌های مشترک از خود Liara سرو می‌شوند تا اجرای سایت/PWA
   * به GitHub یا سرویس فونت خارجی وابسته نباشد.
   */
  if (pathname === '/remote' || pathname.startsWith('/remote/')) {
    const remotePath = pathname === '/remote' ? '/' : pathname.slice('/remote'.length);
    serveFile(req, res, path.join(SITE_ROOT, 'remote'), remotePath);
    return;
  }

  if (
    pathname === '/assets/logo_alfatemiun.webp' ||
    pathname === '/assets/home-banner-local.svg' ||
    pathname.startsWith('/assets/remote/')
  ) {
    serveFile(req, res, SITE_ROOT, pathname);
    return;
  }

  if (host === 'app.alefatemion.ir') {
    serveFile(req, res, PWA_ROOT, pathname);
    return;
  }

  /*
   * پیش‌نمایش PWA روی دامنه موقت Liara قبل از اتصال app.alefatemion.ir.
   * پس از اتصال دامنه رسمی، کاربران مستقیماً app.alefatemion.ir را باز می‌کنند.
   */
  const isTemporaryHost =
    host.endsWith('.liara.run') ||
    host === 'localhost' ||
    host === '127.0.0.1';

  if (isTemporaryHost && (pathname === '/pwa' || pathname.startsWith('/pwa/'))) {
    if (pathname === '/pwa') {
      redirect(res, '/pwa/', 302);
      return;
    }
    const pwaPath = pathname.slice('/pwa'.length) || '/';
    serveFile(req, res, PWA_ROOT, pwaPath);
    return;
  }

  if (pathname === '/app' || pathname.startsWith('/app/')) {
    const suffix = pathname === '/app' ? '/' : pathname.slice(4);
    redirect(res, 'https://app.alefatemion.ir' + suffix + url.search, 302);
    return;
  }

  /*
   * دامنه اصلی و دامنه موقت liara.run هر دو سایت رسمی را نمایش می‌دهند.
   * این کار اجازه می‌دهد قبل از اتصال DNS، استقرار روی آدرس موقت لیارا تست شود.
   */
  serveFile(req, res, SITE_ROOT, pathname);
});

function runRemoteSync() {
  if (process.env.DISABLE_REMOTE_SYNC === '1' || remoteSyncRunning) return;
  remoteSyncRunning = true;
  const child = spawn(process.execPath, [SYNC_SCRIPT], {
    cwd: __dirname,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let stderr = '';
  child.stdout.on('data', data => process.stdout.write('[remote-sync] ' + data));
  child.stderr.on('data', data => {
    stderr += String(data);
    process.stderr.write('[remote-sync] ' + data);
  });
  child.on('error', error => {
    remoteSyncRunning = false;
    remoteSyncLastError = error.message || String(error);
  });
  child.on('exit', code => {
    remoteSyncRunning = false;
    if (code === 0) {
      remoteSyncLastOk = Date.now();
      remoteSyncLastError = '';
    } else {
      remoteSyncLastError = (stderr.trim() || ('sync exited with code ' + code)).slice(-1200);
    }
  });
}

server.listen(PORT, HOST, () => {
  console.log(`Al Fatemiun web service listening on ${HOST}:${PORT}`);
  setTimeout(runRemoteSync, 10000);
  setInterval(runRemoteSync, REMOTE_SYNC_INTERVAL_MS);
});
