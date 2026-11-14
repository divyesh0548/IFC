import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs/promises';
const require=createRequire(import.meta.url);
require('../../backend/node_modules/dotenv').config({path:'backend/.env',quiet:true});
const root=process.cwd();
const mode=process.argv[2]||'record';
const ffmpeg=path.dirname(require('ffmpeg-static'));
const ffprobe=path.dirname(require('ffprobe-static').path);
const env={...process.env,PATH:[ffmpeg,ffprobe,process.env.PATH].join(path.delimiter),BASE:'http://localhost:5174',WIDTH:'2560',HEIGHT:'1440',SCALE:'2',SLOWMO:'20',CRF:'16',STORAGE_STATE:path.join(root,'output/ifc-recording/session.private.json'),TTS_PROVIDER:'elevenlabs',TTS_CACHE_DIR:path.join(root,'output/ifc-recording/tts-cache'),OUT_DIR:path.join(root,'output/ifc-recording/capture'),VERIFY_FRAME_DIR:path.join(root,'output/ifc-recording/verification'),NARRATION:mode==='silent'?'0':'1'};
await fs.mkdir(env.VERIFY_FRAME_DIR,{recursive:true});
if(mode!=='silent')env.VERIFY_FRAME_DIR='';
if(mode==='synthesize'){
 Object.assign(process.env,env);
 const {narration}=await import('./flow.mjs');const {synthesize}=await import('./tts.mjs');
 const clips=await synthesize(narration);
 await fs.writeFile('output/ifc-recording/narration-cache.json',JSON.stringify([...clips],null,2));
}else{
 if(mode!=='silent') env.TTS_CACHE_ONLY='1';
 const out=process.env.DEMO_OUT || (mode==='silent'?'output/ifc-demo.silent.mp4':'output/ifc-demo.mp4');
 const child=spawn('C:/Program Files/Git/bin/bash.exe',['output/ifc-recording/record.sh',process.env.DEMO_FLOW || 'output/ifc-recording/flow.mjs',out],{env,stdio:'inherit',windowsHide:true});
 child.on('exit',code=>process.exit(code??1));
}
