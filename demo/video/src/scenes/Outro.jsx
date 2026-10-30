import React from 'react';
import {AbsoluteFill,useCurrentFrame,random} from 'remotion';
import {C,PIXEL,MONO,PARTS} from '../theme.js';
import {INSTALL,LINES,SCENES,H} from '../script.mjs';
import {Box,Icon,Sfx,pop,fade} from '../lib.jsx';
import {Avatar} from '../Avatar.jsx';

const L=LINES.at(-1),OFF=SCENES.outro[0],U=10;

export function Outro(){
 const f=useCurrentFrame(),abs=f+OFF;
 return <AbsoluteFill>
  <Sfx at={8} name="fanfare" volume={0.4}/>
  {[30,60,90,120].map(t=><Sfx key={t} at={t} name="coin" volume={0.12}/>)}
  {Array.from({length:26},(_,i)=>{const t0=random(`ct${i}`)*150,y=(f-t0)*(6+random(`cv${i}`)*5)-80;
   return f>t0&&y<1100&&<div key={i} style={{position:'absolute',left:random(`cx${i}`)*1860,top:y,opacity:0.3}}><Icon name="coin" unit={4+Math.round(random(`cs${i}`)*2)} color="#ca8a04" light="#fde047"/></div>})}
  <div style={{position:'absolute',left:80,top:H-70*U,transform:`translateY(${(1-pop(f,4,{damping:16,stiffness:120}))*70*U}px)`}}>
   <Avatar unit={U} mood={L.mood} talking={abs>=L.from&&abs<L.to}/>
  </div>
  <div style={{position:'absolute',left:690,top:150,display:'flex'}}>
   {'lokAl'.split('').map((ch,i)=>{const s=pop(f,10+i*6,{damping:10});
    return <span key={i} style={{fontFamily:PIXEL,fontSize:170,color:i>2?C.accent2:C.accent,transform:`translateY(${(1-s)*-300}px)`,opacity:s>0.02?1:0,textShadow:`10px 10px 0 ${C.ink}`}}>{ch}</span>})}
  </div>
  <div style={{position:'absolute',left:696,top:400,fontFamily:PIXEL,fontSize:34,color:C.accent2,opacity:fade(f,48,60)}}>Your model. Paid. One command.</div>
  <div style={{position:'absolute',left:690,top:480,opacity:fade(f,66,78)}}>
   <Box auto bw={5} border={C.line} bg="#070b16"><div style={{padding:'16px 22px',fontFamily:MONO,fontSize:19,color:C.text,whiteSpace:'nowrap'}}><span style={{color:C.ok}}>$ </span>{INSTALL}</div></Box>
  </div>
  <div style={{position:'absolute',left:696,top:600,display:'flex',gap:28,fontFamily:PIXEL,fontSize:17,opacity:fade(f,84,96)}}>
   {PARTS.map(p=><span key={p.id} style={{color:p.color}}>{p.name}</span>)}
  </div>
  <div style={{position:'absolute',left:696,top:654,fontFamily:MONO,fontSize:22,color:C.dim,opacity:fade(f,96,108)}}>TUM Blockchain & AI Hackathon 2026 · Cardano track</div>
 </AbsoluteFill>;
}
