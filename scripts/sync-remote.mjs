import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const DOCS = path.join(ROOT, 'docs');
const REMOTE_DIR = path.join(DOCS, 'remote');
const ASSET_DIR = path.join(DOCS, 'assets', 'remote', 'banners');
const STAGE = path.join(ROOT, '.liara-sync-stage');
const CONFIG_URL = 'https://raw.githubusercontent.com/fixi82896-gif/Alefatemion_remote/main/app-config.json';
const CATALOG_URL = 'https://raw.githubusercontent.com/fixi82896-gif/Alefatemion_remote/main/media-catalog.json';

async function fetchOk(url, kind = 'resource') {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(url, { redirect: 'follow', signal: controller.signal });
    if (!response.ok) throw new Error(kind + ' HTTP ' + response.status);
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJson(url, kind) {
  const response = await fetchOk(url, kind);
  const value = await response.json();
  if (!value || typeof value !== 'object') throw new Error(kind + ' is not a JSON object');
  return value;
}

function assertRemote(config, catalog) {
  if (!Number.isFinite(Number(config.revision))) throw new Error('app-config revision is invalid');
  if (!Array.isArray(config?.home?.banners)) throw new Error('home.banners is missing');
  if (!Array.isArray(catalog?.folders) || !Array.isArray(catalog?.media)) {
    throw new Error('media-catalog folders/media are missing');
  }
}

function safeExt(url) {
  const pathname = new URL(url).pathname;
  const name = pathname.split('/').pop() || '';
  const match = name.match(/\.(png|jpe?g|webp|gif)$/i);
  return match ? '.' + match[1].toLowerCase().replace('jpeg', 'jpg') : '.bin';
}

function isGitHubReleaseAsset(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' &&
      u.hostname === 'github.com' &&
      u.pathname.startsWith('/fixi82896-gif/Alefatemion_remote/releases/download/');
  } catch {
    return false;
  }
}

async function downloadBanner(url, id, dir) {
  if (!isGitHubReleaseAsset(url)) return url;
  const safeId = String(id || 'banner').replace(/[^a-zA-Z0-9_-]/g, '-');
  const filename = safeId + safeExt(url);
  const response = await fetchOk(url, 'banner ' + safeId);
  const type = (response.headers.get('content-type') || '').toLowerCase();
  if (type && !type.startsWith('image/') && type !== 'application/octet-stream') {
    throw new Error('banner ' + safeId + ' returned unexpected content-type ' + type);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 128) throw new Error('banner ' + safeId + ' is unexpectedly small');
  if (bytes.length > 12 * 1024 * 1024) throw new Error('banner ' + safeId + ' exceeds 12 MB');
  await fs.writeFile(path.join(dir, filename), bytes);
  return '/assets/remote/banners/' + filename;
}

async function main() {
  await fs.rm(STAGE, { recursive: true, force: true });
  const stagedRemote = path.join(STAGE, 'remote');
  const stagedBanners = path.join(STAGE, 'banners');
  await fs.mkdir(stagedRemote, { recursive: true });
  await fs.mkdir(stagedBanners, { recursive: true });

  const [config, catalog] = await Promise.all([
    fetchJson(CONFIG_URL, 'app-config'),
    fetchJson(CATALOG_URL, 'media-catalog')
  ]);
  assertRemote(config, catalog);

  const cloned = structuredClone(config);
  for (const banner of cloned.home.banners) {
    const url = String(banner.image_url || '').trim();
    if (url) banner.image_url = await downloadBanner(url, banner.id, stagedBanners);
  }

  const meta = {
    synced_at: new Date().toISOString(),
    config_revision: cloned.revision,
    catalog_revision: catalog.revision ?? null,
    folder_count: catalog.folders.length,
    media_count: catalog.media.length,
    banner_count: cloned.home.banners.length,
    source: 'Alefatemion_remote/main'
  };

  await fs.writeFile(path.join(stagedRemote, 'app-config.json'), JSON.stringify(cloned, null, 2) + '\n');
  await fs.writeFile(path.join(stagedRemote, 'media-catalog.json'), JSON.stringify(catalog, null, 2) + '\n');
  await fs.writeFile(path.join(stagedRemote, 'sync-meta.json'), JSON.stringify(meta, null, 2) + '\n');

  await fs.mkdir(path.dirname(ASSET_DIR), { recursive: true });
  const oldAssets = ASSET_DIR + '.old';
  await fs.rm(oldAssets, { recursive: true, force: true });
  let hadAssets = false;
  try {
    await fs.rename(ASSET_DIR, oldAssets);
    hadAssets = true;
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  try {
    await fs.rename(stagedBanners, ASSET_DIR);
    await fs.rm(oldAssets, { recursive: true, force: true });
  } catch (error) {
    if (hadAssets) {
      await fs.rm(ASSET_DIR, { recursive: true, force: true }).catch(() => {});
      await fs.rename(oldAssets, ASSET_DIR).catch(() => {});
    }
    throw error;
  }

  await fs.mkdir(REMOTE_DIR, { recursive: true });
  for (const name of ['media-catalog.json', 'sync-meta.json', 'app-config.json']) {
    const target = path.join(REMOTE_DIR, name);
    const tempTarget = target + '.new';
    await fs.copyFile(path.join(stagedRemote, name), tempTarget);
    await fs.rename(tempTarget, target);
  }

  await fs.rm(STAGE, { recursive: true, force: true });
  console.log('[liara-sync] OK', JSON.stringify(meta));
}

main().catch(async error => {
  console.error('[liara-sync] FAILED:', error?.stack || error);
  await fs.rm(STAGE, { recursive: true, force: true }).catch(() => {});
  process.exit(1);
});
