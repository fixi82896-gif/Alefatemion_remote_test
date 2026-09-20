'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 3000);
const HOST = '0.0.0.0';
const SITE_ROOT = path.resolve(__dirname, 'docs');

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

function securityHeaders(res){
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options','SAMEORIGIN');
  res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
}

function cacheHeaders(res,file){
  const ext=path.extname(file).toLowerCase();
  const name=path.basename(file);
  if(ext==='.html' || name==='sw.js' || ext==='.webmanifest'){
    res.setHeader('Cache-Control','no-cache, no-store, must-revalidate');
  }else if(['.webp','.png','.jpg','.jpeg','.svg','.ico'].includes(ext)){
    res.setHeader('Cache-Control','public, max-age=86400');
  }else{
    res.setHeader('Cache-Control','public, max-age=3600');
  }
}

function safeFile(root,pathname){
  let decoded;
  try{
    decoded=decodeURIComponent(pathname);
  }catch{
    return null;
  }
  const file=path.resolve(root,'.'+decoded);
  if(file!==root && !file.startsWith(root+path.sep)) return null;
  return file;
}

function sendFile(res,file){
  fs.stat(file,(err,stat)=>{
    if(err || !stat.isFile()){
      res.statusCode=404;
      res.setHeader('Content-Type','text/plain; charset=utf-8');
      res.end('صفحه موردنظر پیدا نشد.');
      return;
    }
    securityHeaders(res);
    cacheHeaders(res,file);
    res.statusCode=200;
    res.setHeader('Content-Type',TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
}

const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  let pathname=url.pathname;

  securityHeaders(res);

  if(pathname==='/health'){
    res.statusCode=200;
    res.setHeader('Content-Type','application/json; charset=utf-8');
    res.setHeader('Cache-Control','no-store');
    res.end(JSON.stringify({ok:true,service:'alefatemion-official-site'}));
    return;
  }

  if(pathname==='/pwa' || pathname.startsWith('/pwa/')){
    res.statusCode=302;
    res.setHeader('Location','/#access');
    res.setHeader('Cache-Control','no-store');
    res.end();
    return;
  }

  if(pathname==='/') pathname='/index.html';

  const file=safeFile(SITE_ROOT,pathname);
  if(!file){
    res.statusCode=400;
    res.end('Bad request');
    return;
  }
  sendFile(res,file);
});

server.listen(PORT,HOST,()=>{
  console.log(`Al Fatemiun official site listening on ${HOST}:${PORT}`);
});
