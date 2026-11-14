import {createRequire} from 'node:module';
import {execFile} from 'node:child_process';
import fs from 'node:fs/promises';
const require=createRequire(import.meta.url);
const ffmpeg=require('ffmpeg-static');const ffprobe=require('ffprobe-static').path;
const run=(cmd,args)=>new Promise((resolve,reject)=>execFile(cmd,args,{maxBuffer:16*1024*1024},(e,stdout,stderr)=>e?reject(new Error(stderr||e.message)):resolve({stdout,stderr})));
const video='output/ifc-demo.mp4';
const timeline=JSON.parse(await fs.readFile('output/ifc-demo.timeline.json','utf8'));
const info=JSON.parse((await run(ffprobe,['-v','error','-show_entries','format=duration,size:stream=codec_name,codec_type,width,height,r_frame_rate','-of','json',video])).stdout);
await fs.mkdir('output/ifc-recording/final-frames',{recursive:true});
for(const [index,s] of timeline.segments.entries()){
 const seconds=Math.max(0,(s.startMs+(timeline.offsetMs||0)-timeline.trimMs+s.durMs-800)/1000);
 console.log(index+1,s.id,seconds.toFixed(2)+'s');
 await run(ffmpeg,['-y','-loglevel','error','-ss',String(seconds),'-i',video,'-frames:v','1','-q:v','3',`output/ifc-recording/final-frames/frame-${String(index+1).padStart(2,'0')}.jpg`]);
}
await run(ffmpeg,['-y','-loglevel','error','-framerate','1','-start_number','1','-i','output/ifc-recording/final-frames/frame-%02d.jpg','-vf','scale=640:360,tile=3x3','-frames:v','2','output/ifc-recording/final-frames/contact-%02d.jpg']);
const silence=await run(ffmpeg,['-hide_banner','-i',video,'-vn','-af','silencedetect=noise=-40dB:d=1.2','-f','null','-']);
const pauses=silence.stderr.split('\n').filter(s=>s.includes('silence_'));
console.log('Pauses over 1.2 seconds:',pauses.join('\n')||'None');
console.log('Video metadata:',JSON.stringify(info));
await fs.writeFile('output/ifc-recording/verification-summary.json',JSON.stringify({info,pauses,steps:timeline.segments.map(s=>({id:s.id,spokenMs:s.durMs,onScreenMs:s.actualMs}))},null,2));
