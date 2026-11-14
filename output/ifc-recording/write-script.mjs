import {narration} from './flow.mjs';
import fs from 'node:fs/promises';
await fs.writeFile('output/ifc-narration.md','# Strata company admin walkthrough\n\n'+narration.map((s,i)=>`## ${i+1}. ${s.caption}\n\n${s.text}\n`).join('\n'));
console.log('Narration segments:',narration.length,'Words:',narration.reduce((n,s)=>n+s.text.split(/\s+/).length,0));
