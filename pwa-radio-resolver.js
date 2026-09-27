'use strict';

const https = require('https');
const dns = require('dns').promises;
const net = require('net');

const AUDIO_EXTENSIONS = new Set(['mp3','m4a','aac','ogg','oga','opus','wav','flac','mp4','m3u8']);
const MAX_PAGE_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 4;
const CACHE_TTL = 10 * 60 * 1000;
const CACHE_LIMIT = 64;
const cache = new Map();
const BROWSER_UA = 'Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36';

function isPrivateIp(address) {
  const version = net.isIP(address);
  if (version === 4) {
    const p = address.split('.').map(Number);
    return p[0] === 10 || p[0] === 127 || p[0] === 0 ||
      (p[0] === 169 && p[1] === 254) ||
      (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
      (p[0] === 192 && p[1] === 168) ||
      (p[0] === 100 && p[1] >= 64 && p[1] <= 127) ||
      p[0] >= 224;
  }
  if (version === 6) {
    const v = address.toLowerCase();
    return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe8') || v.startsWith('fe9') || v.startsWith('fea') || v.startsWith('feb');
  }
  return true;
}

async function normalizePublicHttps(raw, base = null) {
  let parsed;
  try { parsed = base ? new URL(String(raw || '').trim(), base) : new URL(String(raw || '').trim()); }
  catch { return null; }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return null;
  const host = parsed.hostname.toLowerCase();
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return null;
  if (net.isIP(host)) {
    if (isPrivateIp(host)) return null;
  } else {
    let addresses;
    try { addresses = await dns.lookup(host, { all:true, verbatim:true }); }
    catch { return null; }
    if (!addresses.length || addresses.some((entry) => isPrivateIp(entry.address))) return null;
  }
  parsed.hash = '';
  return parsed.href;
}

function extensionOf(value) {
  try {
    const pathname = new URL(value).pathname.toLowerCase();
    const match = /\.([a-z0-9]{2,6})$/.exec(pathname);
    return match ? match[1] : '';
  } catch { return ''; }
}

function looksDirectMedia(value) { return AUDIO_EXTENSIONS.has(extensionOf(value)); }
function playableContentType(value) {
  const type = String(value || '').toLowerCase();
  return type.startsWith('audio/') || type === 'application/vnd.apple.mpegurl' || type === 'application/x-mpegurl' || type === 'video/mp4';
}

function decodeEscapedText(value) {
  return String(value || '')
    .replace(/\\u0026/gi, '&').replace(/\\u003d/gi, '=').replace(/\\u002f/gi, '/')
    .replace(/\\\//g, '/').replace(/&amp;/gi, '&').replace(/&#x2f;/gi, '/').replace(/&#47;/g, '/');
}

async function requestPage(url, redirects = 0) {
  const safe = await normalizePublicHttps(url);
  if (!safe) throw new Error('unsafe_source');
  return new Promise((resolve, reject) => {
    const isNava = /^https:\/\/(?:[^.]+\.)?navaapp\.com\/nava\//i.test(safe);
    const request = https.request(safe, {
      method:'GET', timeout:15000,
      headers:{
        'User-Agent':BROWSER_UA,
        'Accept':'text/html,application/xhtml+xml,application/json,audio/*;q=0.9,*/*;q=0.7',
        'Accept-Language':'fa-IR,fa;q=0.9,en;q=0.6',
        ...(isNava ? { Referer:'https://navaapp.com/' } : {})
      }
    }, (response) => {
      const status = response.statusCode || 0;
      if ([301,302,303,307,308].includes(status) && response.headers.location) {
        response.resume();
        if (redirects >= MAX_REDIRECTS) return reject(new Error('too_many_redirects'));
        let next;
        try { next = new URL(response.headers.location, safe).href; } catch { return reject(new Error('bad_redirect')); }
        requestPage(next, redirects + 1).then(resolve, reject);
        return;
      }
      if (status < 200 || status >= 300) { response.resume(); return reject(new Error(`source_http_${status}`)); }
      const contentType = String(response.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
      const finalUrl = safe;
      if (playableContentType(contentType)) { response.destroy(); return resolve({ finalUrl, contentType, body:'', direct:true }); }
      const chunks = [];
      let total = 0;
      response.on('data', (chunk) => {
        total += chunk.length;
        if (total > MAX_PAGE_BYTES) response.destroy(new Error('source_page_too_large'));
        else chunks.push(chunk);
      });
      response.on('end', () => resolve({ finalUrl, contentType, body:Buffer.concat(chunks).toString('utf8'), direct:false }));
    });
    request.on('timeout', () => request.destroy(new Error('source_timeout')));
    request.on('error', reject);
    request.end();
  });
}

function collectCandidates(document) {
  const text = decodeEscapedText(document);
  const found = [];
  let order = 0;
  function add(raw, score) {
    const value = decodeEscapedText(raw).trim().replace(/^['"`]|['"`]$/g, '');
    if (value) found.push({ value, score, order:order++ });
  }
  const tagRe = /<(meta|audio|source|a|link)\b[^>]*>/gi;
  let tag;
  while ((tag = tagRe.exec(text))) {
    const html = tag[0];
    const attrs = {};
    html.replace(/([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g, (_, key, a, b, c) => { attrs[key.toLowerCase()] = a || b || c || ''; return _; });
    const name = tag[1].toLowerCase();
    if (name === 'meta') {
      const key = String(attrs.property || attrs.name || attrs.itemprop || '').toLowerCase();
      if (['og:audio','og:audio:url','og:audio:secure_url','twitter:player:stream','contenturl','audio'].includes(key)) add(attrs.content, 140);
    } else if (name === 'audio' || name === 'source') add(attrs.src || attrs['data-src'] || attrs['data-url'], 130);
    else if (looksDirectMedia(attrs.href || '')) add(attrs.href, 90);
  }
  const keyRe = /["'](?:content[_-]?url|contentUrl|audio(?:[_-]?(?:url|src|path))?|stream(?:[_-]?(?:url|src|path))?|file(?:[_-]?(?:url|src|path))?|media(?:[_-]?(?:url|src|path))?|download(?:[_-]?(?:url|link))?|play[_-]?url)["']\s*:\s*["']((?:\\.|[^"'\\])*)["']/gi;
  let match;
  while ((match = keyRe.exec(text))) add(match[1], 120);
  const httpsRe = /https:\/\/[^\s"'<>\\]+/gi;
  while ((match = httpsRe.exec(text))) {
    const value = match[0];
    if (looksDirectMedia(value)) add(value, 80);
  }
  return found.sort((a,b) => b.score - a.score || a.order - b.order);
}

async function resolvePublicMediaUrl(source) {
  const normalized = await normalizePublicHttps(source);
  if (!normalized) throw Object.assign(new Error('لینک نوا باید HTTPS عمومی و معتبر باشد.'), { code:'RADIO_SOURCE_UNAVAILABLE' });
  if (looksDirectMedia(normalized)) return { media_url:normalized, resolved_from_page:false };
  const cached = cache.get(normalized);
  if (cached && cached.expires > Date.now()) return cached.value;
  const page = await requestPage(normalized);
  if (page.direct) return { media_url:page.finalUrl, resolved_from_page:false };
  const candidates = collectCandidates(page.body);
  for (const candidate of candidates) {
    const safe = await normalizePublicHttps(candidate.value, page.finalUrl);
    if (!safe || safe === page.finalUrl) continue;
    if (!looksDirectMedia(safe) && candidate.score < 120) continue;
    const value = { media_url:safe, resolved_from_page:true };
    cache.set(normalized, { value, expires:Date.now() + CACHE_TTL });
    if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value);
    return value;
  }
  throw Object.assign(new Error('هیچ منبع صوتی عمومی و قابل‌پخش در این صفحه پیدا نشد.'), { code:'RADIO_SOURCE_UNAVAILABLE' });
}

module.exports = { resolvePublicMediaUrl, normalizePublicHttps };
