// Synthesises the 8-bit sound effects into public/sfx/*.wav (mono, 16-bit, 44.1 kHz). No downloaded assets.
import {mkdirSync,writeFileSync} from 'node:fs';
const SR=44100,dir=new URL('../public/sfx/',import.meta.url);
mkdirSync(dir,{recursive:true});

const osc={square:p=>p%1<0.5?1:-1,tri:p=>1-4*Math.abs((p%1)-0.5),noise:()=>Math.random()*2-1};
// One note: frequency glides f0→f1, linear attack, exponential-ish decay.
function note({dur,f0,f1=f0,wave='square',vol=0.5,decay=4,vib=0}){
 const n=Math.round(dur*SR),out=new Float32Array(n);let ph=0;
 for(let i=0;i<n;i++){const t=i/n,f=f0*Math.pow(f1/f0,t)*(1+vib*Math.sin(i/SR*2*Math.PI*6));ph+=f/SR;
  out[i]=osc[wave](ph)*vol*Math.min(1,i/(SR*0.004))*Math.pow(1-t,decay*0.5)}
 return out;
}
const seq=(...parts)=>{const n=parts.reduce((a,p)=>a+p.length,0),o=new Float32Array(n);let k=0;for(const p of parts){o.set(p,k);k+=p.length}return o};
const mix=(...parts)=>{const n=Math.max(...parts.map(p=>p.length)),o=new Float32Array(n);for(const p of parts)p.forEach((v,i)=>o[i]+=v);return o};

function wav(name,s){
 const b=Buffer.alloc(44+s.length*2);
 b.write('RIFF',0);b.writeUInt32LE(36+s.length*2,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);
 b.writeUInt32LE(SR,24);b.writeUInt32LE(SR*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(s.length*2,40);
 s.forEach((v,i)=>b.writeInt16LE(Math.round(Math.max(-1,Math.min(1,v))*32767),44+i*2));
 writeFileSync(new URL(`${name}.wav`,dir),b);
}

const SFX={
 power:mix(note({dur:0.45,f0:60,f1:900,vol:0.35,decay:2}),note({dur:0.3,f0:1,wave:'noise',vol:0.15})),
 pop:note({dur:0.09,f0:380,f1:980,vol:0.4,decay:3}),
 blip:note({dur:0.045,f0:1250,vol:0.3,decay:2}),
 key:note({dur:0.018,f0:1,wave:'noise',vol:0.35,decay:6}),
 enter:seq(note({dur:0.03,f0:1,wave:'noise',vol:0.4,decay:6}),note({dur:0.06,f0:660,vol:0.25})),
 jump:note({dur:0.16,f0:300,f1:820,vol:0.3,decay:2}),
 chime:seq(...[1047,1319,1568].map(f0=>note({dur:0.07,f0,vol:0.3,decay:1})),note({dur:0.22,f0:2093,vol:0.25})),
 coin:seq(note({dur:0.07,f0:988,vol:0.35,decay:0.2}),note({dur:0.35,f0:1319,vol:0.35,decay:3})),
 buzz:mix(note({dur:0.32,f0:110,vol:0.35,decay:1}),note({dur:0.32,f0:117,vol:0.3,decay:1})),
 stamp:mix(note({dur:0.16,f0:1,wave:'noise',vol:0.5,decay:5}),note({dur:0.18,f0:140,f1:50,wave:'tri',vol:0.7,decay:3})),
 later:seq(...[523,659,784,988,1175,1319,1568].map(f0=>note({dur:0.05,f0,wave:'tri',vol:0.4,decay:1})),mix(note({dur:0.7,f0:1047,wave:'tri',vol:0.35,decay:2,vib:0.015}),note({dur:0.7,f0:1568,wave:'tri',vol:0.25,decay:2,vib:0.015}))),
 fanfare:seq(...[523,659,784].map(f0=>note({dur:0.1,f0,vol:0.3,decay:0.5})),note({dur:0.12,f0:1047,vol:0.3,decay:0.5}),note({dur:0.08,f0:784,vol:0.3}),note({dur:0.55,f0:1047,vol:0.3,decay:2,vib:0.012})),
};
for(const [name,s] of Object.entries(SFX))wav(name,s);
console.log(`sfx: ${Object.keys(SFX).length} sounds in public/sfx/`);
