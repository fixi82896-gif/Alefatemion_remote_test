import fs from 'node:fs/promises';
import path from 'node:path';

const root=process.cwd();
const read=p=>fs.readFile(path.join(root,p),'utf8');

function fail(message){throw new Error('[verify-pwa] '+message)}
function need(condition,message){if(!condition)fail(message)}

const [html,js,css,sw,configText,catalogText]=await Promise.all([
  read('docs/pwa/index.html'),
  read('docs/pwa/app.js'),
  read('docs/pwa/styles.css'),
  read('docs/pwa/sw.js'),
  read('docs/remote/app-config.json'),
  read('docs/remote/media-catalog.json')
]);

new Function(js);
const config=JSON.parse(configText);
const catalog=JSON.parse(catalogText);

need(Array.isArray(config?.home?.banners),'home.banners missing');
need(Array.isArray(catalog?.folders)&&Array.isArray(catalog?.media),'catalog arrays missing');
need(html.includes('id="profileDrawer"'),'profile drawer missing');
need(html.includes('id="clearCacheBtn"'),'cache settings missing');
need(html.includes('id="albumLayoutSelector"'),'album settings missing');
need(js.includes("const CONFIG_URL='/remote/app-config.json'"),'PWA config is not local');
need(js.includes("const CATALOG_URL='/remote/media-catalog.json'"),'PWA catalog is not local');
need(css.includes('object-fit:contain'),'hero banner must use Android ContentScale.Fit equivalent');
need(!/fonts\.googleapis\.com|fonts\.gstatic\.com|raw\.githubusercontent\.com/.test(html+js+css),'runtime has forbidden external dependency');
need(!sw.includes("'/remote/app-config.json'")&&!sw.includes("'/remote/media-catalog.json'"),'mutable Remote JSON must not be precached');
need(sw.includes("url.pathname.startsWith('/remote/')"),'Remote JSON network-first rule missing');

for(const banner of config.home.banners.filter(item=>item?.enabled)){
  need(String(banner.image_url||'').startsWith('/assets/'),'enabled banner is not mirrored locally: '+String(banner.id||''));
}

console.log('[verify-pwa] OK',JSON.stringify({
  config_revision:config.revision,
  catalog_revision:catalog.revision,
  folders:catalog.folders.length,
  media:catalog.media.length,
  active_banners:config.home.banners.filter(item=>item?.enabled).length
}));
