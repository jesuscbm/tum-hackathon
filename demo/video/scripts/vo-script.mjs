// Prints the voice-over sheet (timecodes + lines) from src/script.mjs and writes it to VOICEOVER.md.
import {writeFileSync} from 'node:fs';
import {LINES,SCENES,FPS} from '../src/script.mjs';
const tc=f=>{const s=f/FPS;return `${String(Math.floor(s/60)).padStart(1,'0')}:${(s%60).toFixed(1).padStart(4,'0')}`};
const scene=f=>Object.entries(SCENES).find(([,[a,b]])=>f>=a&&f<b)[0];
const words=t=>t.split(/\s+/).length;
const md=['# lokal demo: voice-over script','',
 'Read each line inside its time window; the narrator\'s mouth moves only inside it, so finishing a little early is fine.',
 'Record each line as its own take and line it up at the start time.',
 `Lines in the live demo slot (${tc(SCENES.demo[0])}–${tc(SCENES.demo[1])}) are suggestions: rewrite them to match the recording, keeping roughly the same windows.`,'',
 '| # | Start | End | Scene | Mood | Line | Words |','|---|---|---|---|---|---|---|',
 ...LINES.map((l,i)=>`| ${i+1} | ${tc(l.from)} | ${tc(l.to)} | ${scene(l.from)} | ${l.mood} | ${l.text} | ${words(l.text)} |`),
 '','To change a line or its timing, edit `src/script.mjs` and run `npm run script` again.',''].join('\n');
writeFileSync(new URL('../VOICEOVER.md',import.meta.url),md);
console.log(md);
