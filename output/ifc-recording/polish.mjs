import {createRequire} from 'node:module';
import {execFile} from 'node:child_process';
import fs from 'node:fs/promises';
const require=createRequire(import.meta.url);const ffmpeg=require('ffmpeg-static');
const run=(cmd,args)=>new Promise((resolve,reject)=>execFile(cmd,args,{maxBuffer:16*1024*1024},(e,stdout,stderr)=>e?reject(new Error(stderr||e.message)):resolve(stdout)));
const timeline=JSON.parse(await fs.readFile('output/ifc-demo.timeline.json','utf8'));
const trim=timeline.trimMs||0;
const ranges=timeline.segments.filter(s=>s.actualMs>s.durMs+1200).map(s=>({id:s.id,start:(s.startMs-trim)/1000,end:(s.startMs-trim+s.actualMs)/1000,factor:(s.durMs+280)/s.actualMs}));
const map=t=>t-ranges.reduce((n,r)=>n+Math.max(0,Math.min(t,r.end)-r.start)*(1-r.factor),0);
console.log('Visual pacing adjustments:',JSON.stringify(ranges));
const subtract=ranges.map(r=>`if(lt(T,${r.start}),0,if(lt(T,${r.end}),(T-${r.start})*${1-r.factor},${(r.end-r.start)*(1-r.factor)}))`).join('+');
if(ranges.length){
 const filter=`setpts='(T-(${subtract}))/TB',fps=30`;
 await run(ffmpeg,['-y','-loglevel','error','-progress','output/ifc-recording/polish-progress.txt','-i','output/ifc-demo.mp4','-vf',filter,'-an','-c:v','libx264','-preset','slow','-crf','16','-pix_fmt','yuv420p','-movflags','+faststart','output/ifc-recording/retimed.mp4']);
 await fs.copyFile('output/ifc-demo.timeline.json','output/ifc-recording/original.timeline.json');
 for(const s of timeline.segments){const originalStart=(s.startMs-trim)/1000;const originalEnd=originalStart+s.actualMs/1000;s.startMs=Math.round(map(originalStart)*1000);s.actualMs=Math.round((map(originalEnd)-map(originalStart))*1000);}
 for(const key of ['captions','urls','zooms'])for(const event of timeline[key]||[])event.tMs=Math.round(map((event.tMs-trim)/1000)*1000);
 timeline.trimMs=0;timeline.rawCuts=[];timeline.pacingAdjustments=ranges;
 await fs.writeFile('output/ifc-demo.timeline.json',JSON.stringify(timeline,null,2));
 const env={...process.env,PATH:[require('node:path').dirname(ffmpeg),require('node:path').dirname(require('ffprobe-static').path),process.env.PATH].join(require('node:path').delimiter)};
 await new Promise((resolve,reject)=>execFile(process.execPath,['output/ifc-recording/mux.mjs','output/ifc-recording/retimed.mp4','output/ifc-demo.timeline.json','output/ifc-recording/polished.mp4'],{env,maxBuffer:16*1024*1024},(e,stdout,stderr)=>{console.log(stderr);e?reject(e):resolve(stdout);}));
 await fs.rename('output/ifc-demo.mp4','output/ifc-recording/original-cut.mp4');
 await fs.rename('output/ifc-recording/polished.mp4','output/ifc-demo.mp4');
}
console.log('Final visual pacing complete; narration clips reused without regeneration.');
