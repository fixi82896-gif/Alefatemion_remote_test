'use strict';

const http = require('http');
const https = require('https');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const net = require('net');

const PORT = Number(process.env.PORT || 3000);
const HOST = '0.0.0.0';
const SITE_ROOT = path.resolve(__dirname, 'docs');
const CACHE_ROOT = path.resolve(__dirname, '.release-cache');
const APK_CACHE = path.join(CACHE_ROOT, 'alefatemion-latest.apk');
const APK_TEMP = path.join(CACHE_ROOT, 'alefatemion-latest.tmp');
const SEED_ROOT = path.resolve(__dirname, 'release');
const SEED_MANIFEST = path.join(SEED_ROOT, 'manifest.json');
const PRODUCTION_CONFIG_URL = 'https://raw.githubusercontent.com/fixi82896-gif/Alefatemion_remote/main/app-config.json';
const SYNC_INTERVAL_MS = 2 * 60 * 1000;
const MAX_CONFIG_BYTES = 5 * 1024 * 1024;
const MAX_APK_BYTES = 200 * 1024 * 1024;

const TYPES = {
  '.html':'text/html; charset=utf-8',
  '.css':'text/css; charset=utf-8',
  '.js':'application/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8',
  '.svg':'image/svg+xml',
  '.webp':'image/webp',
  '.png':'image/png',
  '.jpg':'image/jpeg',
  '.jpeg':'image/jpeg',
  '.ico':'image/x-icon',
  '.webmanifest':'application/manifest+json; charset=utf-8'
};

function sha256Buffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function loadSeedRelease() {
  try {
    const manifest = JSON.parse(fs.readFileSync(SEED_MANIFEST, 'utf8'));
    const apkFile = path.join(SEED_ROOT, path.basename(String(manifest.file_name || '')));
    const apkBytes = fs.readFileSync(apkFile);
    const actualHash = sha256Buffer(apkBytes);
    const expectedHash = String(manifest.sha256 || '').toLowerCase();

    if (!Number.isInteger(manifest.version_code) || manifest.version_code <= 0) throw new Error('invalid seed version_code');
    if (!String(manifest.version_name || '').trim()) throw new Error('invalid seed version_name');
    if (!/^[a-f0-9]{64}$/i.test(expectedHash)) throw new Error('invalid seed sha256');
    if (actualHash !== expectedHash) throw new Error('seed APK SHA-256 mismatch');

    return {
      version_code: manifest.version_code,
      version_name: String(manifest.version_name),
      sha256: expectedHash,
      published_at: manifest.published_at || null,
      message: manifest.message || '',
      upstream_url: String(manifest.upstream_url || ''),
      size_bytes: apkBytes.length,
      mirrored: true,
      local_file: apkFile,
      source_kind: 'bundled-seed',
      last_sync_at: null,
      last_error: null
    };
  } catch (error) {
    console.error(`[release-seed] ${error && error.message ? error.message : 'invalid bundled release'}`);
    return {
      version_code: 0,
      version_name: '',
      sha256: '',
      published_at: null,
      message: '',
      upstream_url: '',
      size_bytes: 0,
      mirrored: false,
      local_file: null,
      source_kind: 'unavailable',
      last_sync_at: null,
      last_error: 'Bundled release unavailable'
    };
  }
}

let releaseState = loadSeedRelease();
let syncInFlight = null;

function isAllowedHost(hostHeader) {
  if (!hostHeader) return true;
  let hostname;
  try {
    hostname = new URL(`http://${String(hostHeader).trim()}`).hostname.toLowerCase().replace(/^\[|\]$/g, '');
  } catch {
    return false;
  }
  return hostname === 'alefatemion.ir' ||
    hostname === 'www.alefatemion.ir' ||
    hostname === 'localhost' ||
    hostname.endsWith('.liara.run') ||
    net.isIP(hostname) !== 0;
}

function securityHeaders(req, res, strict = false) {
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  res.setHeader('Cross-Origin-Opener-Policy','same-origin');
  res.setHeader('Cross-Origin-Resource-Policy','same-origin');
  res.setHeader('X-Permitted-Cross-Domain-Policies','none');
  res.setHeader('Origin-Agent-Cluster','?1');

  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
  if (forwardedProto === 'https' || String(req.headers.host || '').toLowerCase().startsWith('alefatemion.ir')) {
    res.setHeader('Strict-Transport-Security','max-age=15552000');
  }

  if (strict) {
    res.setHeader('Content-Security-Policy', [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'none'",
      "img-src 'self' data:",
      "style-src 'self'",
      "script-src 'self'",
      "connect-src 'self'",
      "font-src 'self'",
      "manifest-src 'self'",
      "upgrade-insecure-requests"
    ].join('; '));
  } else {
    res.setHeader('Content-Security-Policy', [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'none'",
      "img-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'none'",
      "connect-src 'self'",
      "font-src 'self'",
      "upgrade-insecure-requests"
    ].join('; '));
  }
}

function cacheHeaders(res, file) {
  const ext = path.extname(file).toLowerCase();
  const name = path.basename(file);
  if (ext === '.html' || name === 'sw.js' || ext === '.webmanifest') {
    res.setHeader('Cache-Control','no-cache, no-store, must-revalidate');
  } else if (['.webp','.png','.jpg','.jpeg','.svg','.ico'].includes(ext)) {
    res.setHeader('Cache-Control','public, max-age=86400');
  } else if (['.css','.js'].includes(ext)) {
    res.setHeader('Cache-Control','public, max-age=3600');
  } else {
    res.setHeader('Cache-Control','public, max-age=3600');
  }
}

function safeFile(root, pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const file = path.resolve(root, '.' + decoded);
  if (file !== root && !file.startsWith(root + path.sep)) return null;
  return file;
}

function isStrictPath(pathname) {
  return pathname === '/index.html' || pathname === '/privacy.html' || pathname.startsWith('/assets/site-vnext/') || pathname === '/api/release';
}

function sendErrorPage(req, res, statusCode) {
  const file = path.join(SITE_ROOT, statusCode === 404 ? '404.html' : '500.html');
  securityHeaders(req, res, false);
  res.statusCode = statusCode;
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Type','text/html; charset=utf-8');
  const stream = fs.createReadStream(file);
  stream.on('error', () => {
    if (!res.headersSent) res.statusCode = statusCode;
    res.end(statusCode === 404 ? 'صفحه موردنظر پیدا نشد.' : 'خطای موقت');
  });
  stream.pipe(res);
}

function sendFile(req, res, file, strict) {
  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) {
      sendErrorPage(req, res, 404);
      return;
    }
    securityHeaders(req, res, strict);
    cacheHeaders(res, file);
    res.statusCode = 200;
    res.setHeader('Content-Type', TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream');
    res.setHeader('Content-Length', stat.size);
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    const stream = fs.createReadStream(file);
    stream.on('error', () => {
      if (!res.headersSent) sendErrorPage(req, res, 500);
      else res.destroy();
    });
    stream.pipe(res);
  });
}

function requestBuffer(urlString, maxBytes, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) return reject(new Error('Too many redirects'));
    const url = new URL(urlString);
    if (url.protocol !== 'https:') return reject(new Error('HTTPS required'));
    const request = https.get(url, {
      headers: {
        'User-Agent': 'Alefatemion-Official-Site/2.2',
        'Accept': 'application/json,text/plain,*/*',
        'Cache-Control': 'no-cache'
      },
      timeout: 20000
    }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume();
        const next = new URL(response.headers.location, url).toString();
        resolve(requestBuffer(next, maxBytes, redirectCount + 1));
        return;
      }
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }
      const chunks = [];
      let total = 0;
      response.on('data', (chunk) => {
        total += chunk.length;
        if (total > maxBytes) {
          request.destroy(new Error('Response too large'));
          return;
        }
        chunks.push(chunk);
      });
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    });
    request.on('timeout', () => request.destroy(new Error('Request timeout')));
    request.on('error', reject);
  });
}

function isAllowedApkUrl(urlString) {
  try {
    const url = new URL(urlString);
    return url.protocol === 'https:' &&
      url.hostname === 'github.com' &&
      url.pathname.startsWith('/fixi82896-gif/Alefatemion_remote/releases/download/android-v');
  } catch {
    return false;
  }
}

function isAllowedRedirectHost(hostname) {
  return hostname === 'github.com' ||
    hostname === 'release-assets.githubusercontent.com' ||
    hostname.endsWith('.githubusercontent.com');
}

async function sha256File(file) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(file);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

async function downloadApk(urlString, expectedHash) {
  await fsp.mkdir(CACHE_ROOT, { recursive: true });
  await fsp.rm(APK_TEMP, { force: true });

  return new Promise((resolve, reject) => {
    let redirects = 0;
    let settled = false;

    const fail = async (error) => {
      if (settled) return;
      settled = true;
      await fsp.rm(APK_TEMP, { force: true }).catch(() => {});
      reject(error);
    };

    const start = (currentUrl) => {
      let parsed;
      try {
        parsed = new URL(currentUrl);
      } catch {
        fail(new Error('Invalid APK URL'));
        return;
      }

      if (parsed.protocol !== 'https:' || !isAllowedRedirectHost(parsed.hostname)) {
        fail(new Error('APK redirect host rejected'));
        return;
      }

      const req = https.get(parsed, {
        headers: {
          'User-Agent':'Alefatemion-Official-Site/2.2',
          'Accept':'application/vnd.android.package-archive,application/octet-stream,*/*'
        },
        timeout: 30000
      }, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          response.resume();
          redirects += 1;
          if (redirects > 5) {
            fail(new Error('Too many APK redirects'));
            return;
          }
          start(new URL(response.headers.location, parsed).toString());
          return;
        }

        if (response.statusCode !== 200) {
          response.resume();
          fail(new Error(`APK HTTP ${response.statusCode}`));
          return;
        }

        const contentLength = Number(response.headers['content-length'] || 0);
        if (contentLength > MAX_APK_BYTES) {
          response.resume();
          fail(new Error('APK exceeds size limit'));
          return;
        }

        const hash = crypto.createHash('sha256');
        let total = 0;
        const output = fs.createWriteStream(APK_TEMP, { flags:'w', mode:0o600 });

        response.on('data', (chunk) => {
          total += chunk.length;
          if (total > MAX_APK_BYTES) {
            req.destroy(new Error('APK exceeds size limit'));
            return;
          }
          hash.update(chunk);
        });

        response.on('error', fail);
        output.on('error', fail);
        response.pipe(output);

        output.on('finish', () => {
          output.close(async (closeError) => {
            if (closeError) {
              fail(closeError);
              return;
            }
            if (settled) return;
            const actualHash = hash.digest('hex');
            if (actualHash.toLowerCase() !== expectedHash.toLowerCase()) {
              fail(new Error('APK SHA-256 mismatch'));
              return;
            }
            try {
              await fsp.rename(APK_TEMP, APK_CACHE);
              settled = true;
              resolve({ file: APK_CACHE, size_bytes: total, sha256: actualHash });
            } catch (error) {
              fail(error);
            }
          });
        });
      });

      req.on('timeout', () => req.destroy(new Error('APK request timeout')));
      req.on('error', fail);
    };

    start(urlString);
  });
}

async function verifiedFile(file, expectedHash) {
  try {
    const stat = await fsp.stat(file);
    if (!stat.isFile()) return null;
    const actualHash = await sha256File(file);
    if (actualHash.toLowerCase() !== expectedHash.toLowerCase()) return null;
    return { file, size_bytes: stat.size, sha256: actualHash };
  } catch {
    return null;
  }
}

async function localApkMatches(expectedHash) {
  if (!expectedHash) return null;
  const runtime = await verifiedFile(APK_CACHE, expectedHash);
  if (runtime) return runtime;

  if (releaseState.source_kind === 'bundled-seed' && releaseState.local_file) {
    const seed = await verifiedFile(releaseState.local_file, expectedHash);
    if (seed) return seed;
  }

  try {
    const manifest = JSON.parse(await fsp.readFile(SEED_MANIFEST, 'utf8'));
    const seedFile = path.join(SEED_ROOT, path.basename(String(manifest.file_name || '')));
    if (String(manifest.sha256 || '').toLowerCase() === expectedHash.toLowerCase()) {
      return await verifiedFile(seedFile, expectedHash);
    }
  } catch {}

  return null;
}

async function syncProductionRelease() {
  if (syncInFlight) return syncInFlight;

  syncInFlight = (async () => {
    try {
      const refreshUrl = `${PRODUCTION_CONFIG_URL}?refresh=${Date.now()}`;
      const configBuffer = await requestBuffer(refreshUrl, MAX_CONFIG_BYTES);
      const config = JSON.parse(configBuffer.toString('utf8'));
      const ota = config && config.ota;

      if (!ota || !Number.isInteger(ota.version_code) || !ota.version_name || !ota.apk_url || !ota.sha256) {
        throw new Error('Production OTA metadata incomplete');
      }
      if (!/^[a-f0-9]{64}$/i.test(String(ota.sha256))) throw new Error('Invalid OTA SHA-256');
      if (!isAllowedApkUrl(String(ota.apk_url))) throw new Error('Production APK URL rejected');
      if (releaseState.version_code > 0 && ota.version_code < releaseState.version_code) throw new Error('Production OTA downgrade rejected');

      const nextState = {
        version_code: ota.version_code,
        version_name: String(ota.version_name),
        sha256: String(ota.sha256).toLowerCase(),
        published_at: ota.published_at || null,
        message: ota.message || '',
        upstream_url: String(ota.apk_url),
        size_bytes: 0,
        mirrored: false,
        local_file: null,
        source_kind: 'production-ota',
        last_sync_at: new Date().toISOString(),
        last_error: null
      };

      let local = await localApkMatches(nextState.sha256);
      if (!local) local = await downloadApk(nextState.upstream_url, nextState.sha256);

      nextState.size_bytes = local.size_bytes;
      nextState.mirrored = true;
      nextState.local_file = local.file;
      nextState.source_kind = local.file === APK_CACHE ? 'runtime-mirror' : 'bundled-seed';
      releaseState = nextState;
      console.log(`[release-sync] Production ${nextState.version_name} (${nextState.version_code}) ready, ${nextState.size_bytes} bytes`);
    } catch (error) {
      releaseState.last_error = error && error.message ? error.message : 'sync failed';
      releaseState.last_sync_at = new Date().toISOString();
      console.error(`[release-sync] ${releaseState.last_error}`);
    } finally {
      syncInFlight = null;
    }
  })();

  return syncInFlight;
}

function publicRelease() {
  return {
    version_code: releaseState.version_code,
    version_name: releaseState.version_name,
    sha256: releaseState.sha256,
    published_at: releaseState.published_at,
    message: releaseState.message,
    size_bytes: releaseState.size_bytes,
    mirrored: releaseState.mirrored,
    download_url: '/download/android',
    source: 'production-ota'
  };
}

async function sendReleaseApi(req, res) {
  securityHeaders(req, res, true);
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');

  if (!releaseState.mirrored) {
    await syncProductionRelease().catch(() => {});
  }

  if (!releaseState.mirrored || !releaseState.version_code) {
    res.statusCode = 503;
    res.setHeader('Retry-After','30');
    res.end(JSON.stringify({ ok:false, message:'نسخه رسمی موقتاً در دسترس نیست.' }));
    return;
  }

  res.statusCode = 200;
  res.end(JSON.stringify(publicRelease()));
}

function parseByteRange(rangeHeader, size) {
  if (!rangeHeader || !String(rangeHeader).startsWith('bytes=')) return null;
  const value = String(rangeHeader).slice(6).trim();
  if (!value || value.includes(',')) return { invalid:true };
  const match = /^(\d*)-(\d*)$/.exec(value);
  if (!match) return { invalid:true };

  let start;
  let end;
  if (match[1] === '' && match[2] !== '') {
    const suffix = Number(match[2]);
    if (!Number.isInteger(suffix) || suffix <= 0) return { invalid:true };
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === '' ? size - 1 : Number(match[2]);
  }

  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || start >= size) {
    return { invalid:true };
  }

  end = Math.min(end, size - 1);
  return { start, end };
}

async function sendApk(req, res) {
  securityHeaders(req, res, true);
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Type','application/vnd.android.package-archive');
  res.setHeader('X-Download-Source','alefatemion-site');
  res.setHeader('Accept-Ranges','bytes');

  try {
    let local = releaseState.mirrored && releaseState.local_file
      ? await verifiedFile(releaseState.local_file, releaseState.sha256)
      : null;

    if (!local) {
      local = await localApkMatches(releaseState.sha256);
    }

    if (!local) {
      await syncProductionRelease();
      local = releaseState.local_file
        ? await verifiedFile(releaseState.local_file, releaseState.sha256)
        : await localApkMatches(releaseState.sha256);
    }

    if (!local) {
      res.statusCode = 503;
      res.setHeader('Retry-After','30');
      res.end('نسخه رسمی در حال آماده‌سازی است. لطفاً چند لحظه دیگر دوباره تلاش کنید.');
      return;
    }

    const safeVersion = String(releaseState.version_name || releaseState.version_code || 'latest').replace(/[^0-9A-Za-z._-]/g, '-');
    res.setHeader('Content-Disposition', `attachment; filename="Alefatemion-${safeVersion}.apk"`);
    res.setHeader('ETag', `"sha256-${releaseState.sha256}"`);
    res.setHeader('X-APK-SHA256', releaseState.sha256);

    const range = parseByteRange(req.headers.range, local.size_bytes);
    if (range && range.invalid) {
      res.statusCode = 416;
      res.setHeader('Content-Range', `bytes */${local.size_bytes}`);
      res.end();
      return;
    }

    let streamOptions = undefined;
    if (range) {
      res.statusCode = 206;
      res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${local.size_bytes}`);
      res.setHeader('Content-Length', range.end - range.start + 1);
      streamOptions = { start: range.start, end: range.end };
    } else {
      res.statusCode = 200;
      res.setHeader('Content-Length', local.size_bytes);
    }

    if (req.method === 'HEAD') {
      res.end();
      return;
    }

    const stream = fs.createReadStream(local.file, streamOptions);
    stream.on('error', () => {
      if (!res.headersSent) {
        res.statusCode = 503;
        res.end('دانلود موقتاً در دسترس نیست.');
      } else {
        res.destroy();
      }
    });
    stream.pipe(res);
  } catch {
    res.statusCode = 503;
    res.setHeader('Retry-After','30');
    res.end('نسخه رسمی در حال آماده‌سازی است. لطفاً چند لحظه دیگر دوباره تلاش کنید.');
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (!['GET','HEAD'].includes(req.method)) {
      securityHeaders(req, res, false);
      res.statusCode = 405;
      res.setHeader('Allow','GET, HEAD');
      res.setHeader('Cache-Control','no-store');
      res.end('Method Not Allowed');
      return;
    }

    if (!isAllowedHost(req.headers.host)) {
      securityHeaders(req, res, false);
      res.statusCode = 421;
      res.setHeader('Cache-Control','no-store');
      res.end('Misdirected Request');
      return;
    }

    const url = new URL(req.url, 'http://localhost');
    let pathname = url.pathname;

    if (pathname === '/health') {
      securityHeaders(req, res, true);
      res.statusCode = 200;
      res.setHeader('Content-Type','application/json; charset=utf-8');
      res.setHeader('Cache-Control','no-store');
      res.end(JSON.stringify({
        ok:true,
        service:'alefatemion-official-site',
        release_ready:Boolean(releaseState.mirrored && releaseState.version_code),
        release_version:releaseState.version_name || null,
        release_code:releaseState.version_code || null
      }));
      return;
    }

    if (pathname === '/api/release') {
      await sendReleaseApi(req, res);
      return;
    }

    if (pathname === '/download/android' || pathname === '/downloads/alefatemion-latest.apk') {
      await sendApk(req, res);
      return;
    }

    if (pathname === '/pwa' || pathname.startsWith('/pwa/')) {
      securityHeaders(req, res, true);
      res.statusCode = 410;
      res.setHeader('Cache-Control','no-store');
      res.end('Gone');
      return;
    }

    if (pathname === '/test' || pathname.startsWith('/test/')) {
      securityHeaders(req, res, true);
      res.statusCode = 410;
      res.setHeader('Content-Type','text/html; charset=utf-8');
      res.setHeader('Cache-Control','no-store');
      const gonePage = path.join(SITE_ROOT, '404.html');
      const stream = fs.createReadStream(gonePage);
      stream.on('error', () => res.end('این نشانی دیگر در دسترس نیست.'));
      stream.pipe(res);
      return;
    }

    if (pathname === '/') pathname = '/index.html';

    const file = safeFile(SITE_ROOT, pathname);
    if (!file) {
      securityHeaders(req, res, false);
      res.statusCode = 400;
      res.setHeader('Cache-Control','no-store');
      res.end('Bad Request');
      return;
    }

    sendFile(req, res, file, isStrictPath(pathname));
  } catch {
    sendErrorPage(req, res, 500);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Al Fatemiun official site listening on ${HOST}:${PORT}`);
  console.log(`[release-seed] ${releaseState.version_name || 'none'} (${releaseState.version_code || 0}), ready=${releaseState.mirrored}`);
  syncProductionRelease().catch(() => {});
  const timer = setInterval(() => syncProductionRelease().catch(() => {}), SYNC_INTERVAL_MS);
  if (typeof timer.unref === 'function') timer.unref();
});
