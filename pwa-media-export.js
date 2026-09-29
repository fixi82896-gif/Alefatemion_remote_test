'use strict';
const fs=require('fs'),fsp=fs.promises,path=require('path'),os=require('os'),crypto=require('crypto'),https=require('https'),dns=require('dns').promises;
const {spawn}=require('child_process');
const {pipeline}=require('stream/promises');
const {Transform}=require('stream');
const MAX_BYTES=512*1024*1024;
function publicIPv4(ip){const p=ip.split('.').map(Number);return p.length===4&&p.every(x=>Number.isInteger(x)&&x>=0&&x<256)&&![0,10,127].includes(p[0])&&p[0]<224&&!(p[0]===169&&p[1]===254)&&!(p[0]===172&&p[1]>=16&&p[1]<=31)&&!(p[0]===192&&p[1]===168)&&!(p[0]===100&&p[1]>=64&&p[1]<=127)&&!(p[0]===198&&[18,19].includes(p[1]));}
async function download(url,file,redirects=0){
 const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password||(u.port&&u.port!=='443'))throw Error('unsafe_source');
 const addresses=await dns.lookup(u.hostname,{family:4,all:true});if(!addresses.length||addresses.some(x=>!publicIPv4(x.address)))throw Error('unsafe_address');
 const response=await new Promise((resolve,reject)=>{const req=https.get(u,{timeout:60000,lookup:(_h,_o,cb)=>cb(null,addresses[0].address,4)},resolve);req.on('timeout',()=>req.destroy(Error('timeout')));req.on('error',reject);});
 if([301,302,303,307,308].includes(response.statusCode)&&response.headers.location){response.resume();if(redirects>=4)throw Error('redirect_limit');return download(new URL(response.headers.location,u).href,file,redirects+1);}
 if(response.statusCode!==200){response.resume();throw Error('source_unavailable');}
 if(Number(response.headers['content-length'])>MAX_BYTES){response.destroy();throw Error('file_too_large');}
 let total=0;const timer=setTimeout(()=>response.destroy(Error('download_deadline')),180000);
 try{await pipeline(response,new Transform({transform(chunk,_enc,cb){total+=chunk.length;cb(total>MAX_BYTES?Error('file_too_large'):null,chunk);}}),fs.createWriteStream(file,{flags:'wx'}));}finally{clearTimeout(timer);}
}
function run(bin,args,timeout=600000){return new Promise((resolve,reject)=>{let output='';const child=spawn(bin,args,{stdio:['ignore','pipe','pipe']});const timer=setTimeout(()=>child.kill('SIGKILL'),timeout);for(const stream of [child.stdout,child.stderr])stream.on('data',d=>{output=(output+d).slice(-50000);});child.on('error',e=>{clearTimeout(timer);reject(e);});child.on('close',code=>{clearTimeout(timer);code===0?resolve(output):reject(Error('media_processing_failed: '+output.slice(-1200)));});});}
async function transcode(source,logo,destination,video){
 const ffmpeg=process.env.PWA_FFMPEG_PATH||require('ffmpeg-static');
 const ffprobe=process.env.PWA_FFPROBE_PATH||require('ffprobe-static').path;
 const metadata=JSON.parse(await run(ffprobe,['-v','error','-select_streams','v:0','-show_streams','-of','json',source],30000));
 const stream=metadata.streams?.[0];if(!stream?.width||!stream?.height||stream.width*stream.height>40000000)throw Error('invalid_media_dimensions');
 let w=stream.width,h=stream.height;const rotation=Number(stream.tags?.rotate||stream.side_data_list?.find(x=>x.rotation)?.rotation||0);if(Math.abs(rotation)%180===90)[w,h]=[h,w];
 const short=Math.min(w,h),size=Math.min(Math.round(short*(video?.15:.16)),video?512:768),margin=Math.max(1,Math.round(short*.025));
 const filter=`[1:v]scale=${Math.max(1,size)}:${Math.max(1,size)},format=rgba,colorchannelmixer=aa=${video?.28:.30}[logo];[0:v][logo]overlay=${margin}:${margin}:format=auto,${video?'pad=ceil(iw/2)*2:ceil(ih/2)*2,':''}format=${video?'yuv420p':'rgb24'}[out]`;
 const args=['-y','-threads','2','-filter_complex_threads','1','-i',source,'-i',logo,'-filter_complex',filter,'-map','[out]'];
 if(video)args.push('-map','0:a?','-c:v','libx264','-preset','veryfast','-crf','23','-threads','2','-c:a','aac','-b:a','160k','-movflags','+faststart');else args.push('-frames:v','1','-q:v','2');
 args.push(destination);await run(ffmpeg,args);
 const stat=await fsp.stat(destination);if(!stat.size||stat.size>MAX_BYTES)throw Error('invalid_output_size');
}
function createExportService({resolveItem,authorize,logo,json}){
 const jobs=new Map();let running=false;const queue=[];
 async function pump(){if(running)return;running=true;try{while(queue.length){const job=queue.shift();job.status='processing';try{await download(job.source,path.join(job.dir,'source'));await transcode(path.join(job.dir,'source'),logo,job.file,job.video);job.status='ready';}catch{job.status='failed';job.message='ساخت فایل همراه لوگو انجام نشد؛ دوباره تلاش کنید.';}finally{await fsp.rm(path.join(job.dir,'source'),{force:true}).catch(()=>{});job.finished=Date.now();}}}finally{running=false;}}
 const sweep=setInterval(()=>{for(const [id,j]of jobs)if(j.finished&&Date.now()-j.finished>15*60*1000){jobs.delete(id);fsp.rm(j.dir,{recursive:true,force:true}).catch(()=>{});}},60000);sweep.unref();
 return async function handle(req,res,url,body){
  const match=/^\/api\/media\/export(?:\/([0-9a-f-]{36})(\/file)?)?$/.exec(url.pathname);if(!match)return json(res,404,{error:{message:'مسیر نامعتبر است.'}});
  if(!match[1]&&req.method==='POST'){
   if(queue.length>=6||jobs.size>=24)return json(res,429,{error:{message:'صف آماده‌سازی پر است؛ کمی بعد تلاش کنید.'}});
   const action=body?.action==='share'?'share':'download';
   const item=await resolveItem(String(body?.id||''),String(body?.folder_hash||''));const owner=await authorize(req,res,item.video,action);
   if(!owner)return;
   if([...jobs.values()].some(j=>j.owner===owner&&!j.finished))return json(res,429,{error:{message:'یک فایل برای حساب شما در حال آماده‌سازی است.'}});
   const id=crypto.randomUUID(),dir=await fsp.mkdtemp(path.join(os.tmpdir(),'alef-export-')),ext=item.video?'mp4':'jpg';
   const name=String(item.name||'media').replace(/[^\p{L}\p{N} _-]/gu,'_').slice(0,100)+'_alfatemiun.'+ext;
   const job={id,dir,owner,action,source:item.url,video:item.video,file:path.join(dir,'output.'+ext),name,mime:item.video?'video/mp4':'image/jpeg',status:'queued'};
   jobs.set(id,job);queue.push(job);pump();return json(res,202,{id,status:'queued'});
  }
  const job=jobs.get(match[1]);if(!job)return json(res,404,{error:{message:'فایل آماده‌شده منقضی شده است.'}});
  const owner=await authorize(req,res,job.video,job.action);if(!owner)return;if(owner!==job.owner)return json(res,404,{error:{message:'فایل یافت نشد.'}});
  if(req.method!=='GET')return json(res,405,{error:{message:'درخواست نامعتبر است.'}});
  if(!match[2])return json(res,200,{id:job.id,status:job.status,name:job.name,mime:job.mime,message:job.message});
  if(job.status!=='ready')return json(res,409,{error:{message:'فایل هنوز آماده نیست.'}});
  res.writeHead(200,{'Content-Type':job.mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Disposition':`attachment; filename="alefatemiun.${job.video?'mp4':'jpg'}"; filename*=UTF-8''${encodeURIComponent(job.name)}`,'Content-Length':(await fsp.stat(job.file)).size});
  await pipeline(fs.createReadStream(job.file),res);
 };
}
module.exports={createExportService,transcode,publicIPv4};
