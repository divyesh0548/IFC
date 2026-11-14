import fs from 'node:fs';
const timeline=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const expressions=(timeline.rawCuts||[]).map(c=>`between(t,${Math.max(0,c.startMs-timeline.trimMs)/1000},${Math.max(0,c.endMs-timeline.trimMs)/1000})`);
process.stdout.write(expressions.length?`select='not(${expressions.join('+')})',setpts=N/25/TB,`:'');
