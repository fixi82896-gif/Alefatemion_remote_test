const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process');
const {transcode,publicIPv4,createExportService}=require('../pwa-media-export');
(async()=>{
 for(const ip of ['127.0.0.1','10.0.0.1','169.254.169.254','172.16.0.1','192.168.0.1','100.64.0.1'])assert.equal(publicIPv4(ip),false);
 const bin=require('ffmpeg-static'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'alef-test-')),logo=path.resolve('docs/assets/logo_alfatemiun.webp');
 try{
  const image=path.join(dir,'image.png'),video=path.join(dir,'video.mp4');
  execFileSync(bin,['-y','-f','lavfi','-i','color=white:s=640x480:d=1','-frames:v','1',image],{stdio:'ignore'});
  execFileSync(bin,['-y','-f','lavfi','-i','color=white:s=640x480:d=1','-f','lavfi','-i','sine=frequency=440:duration=1','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest',video],{stdio:'ignore'});
  for(const [input,ext,isVideo]of [[image,'jpg',false],[video,'mp4',true]]){
   const output=path.join(dir,'marked.'+ext);await transcode(input,logo,output,isVideo);assert(fs.statSync(output).size>100);
   const raw=execFileSync(bin,['-v','error','-i',output,'-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','pipe:1'],{maxBuffer:2000000});
   const average=(x,y,w,h)=>{let sum=0,n=0;for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++){const k=(j*640+i)*3;sum+=raw[k]+raw[k+1]+raw[k+2];n+=3;}return sum/n;};
   assert(average(15,15,70,70)<average(520,380,70,70)-1,'Watermark must be burned into top-left output pixels');
   if(isVideo){const data=JSON.parse(execFileSync(require('ffprobe-static').path,['-v','error','-show_streams','-of','json',output]));assert(data.streams.some(s=>s.codec_type==='audio'),'Video audio preserved');}
  }
  let status;const service=createExportService({resolveItem:async()=>({video:true}),authorize:async()=>{status=403;return null;},logo,json:(_r,s)=>{status=s;}});
  await service({method:'POST'},{},new URL('https://fixture.invalid/api/media/export'),{id:'x'});assert.equal(status,403);
  console.log('PASS: image/video burned-in watermark, location, audio preservation, private-source rejection and denied export');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
