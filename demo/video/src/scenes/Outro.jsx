import React from 'react';
import {AbsoluteFill,useCurrentFrame,random} from 'remotion';
import {C,PIXEL,MONO,PARTS} from '../theme.js';
import {INSTALL,LINES,SCENES,H} from '../script.mjs';
import {Box,Icon,Sfx,pop,fade} from '../lib.jsx';
import {Avatar} from '../Avatar.jsx';

const L=LINES.at(-1),OFF=SCENES.outro[0],U=10,LOGO=110;
// What comes next, then the logo. Keep it to four items: there are 10 seconds.
const NEXT=[
 ['ada','MAINNET','real ADA and USDM, same one command',C.blue],
 ['doc','MORE JOBS','new templates and checks beyond invoices',C.accent2],
 ['shop','AGENTS HIRE AGENTS','bigger agents subcontract to lokAl agents',C.pink],
 ['chip','PROVEN WEIGHTS','attested hardware, not just a claimed digest',C.ok],
];

export function Outro(){
 const f=useCurrentFrame(),abs=f+OFF;
 return <AbsoluteFill>
  {NEXT.map((_,i)=><Sfx key={i} at={14+i*14} name="pop" volume={0.25}/>)}
  <Sfx at={LOGO} name="fanfare" volume={0.4}/>
  {[140,170,200,230].map(t=><Sfx key={t} at={t} name="coin" volume={0.12}/>)}
  {Array.from({length:26},(_,i)=>{const t0=LOGO+random(`ct${i}`)*120,y=(f-t0)*(6+random(`cv${i}`)*5)-80;
   return f>t0&&y<1100&&<div key={i} style={{position:'absolute',left:random(`cx${i}`)*1860,top:y,opacity:0.3}}><Icon name="coin" unit={4+Math.round(random(`cs${i}`)*2)} color="#ca8a04" light="#fde047"/></div>})}
  <div style={{position:'absolute',left:80,top:H-70*U,transform:`translateY(${(1-pop(f,4,{damping:16,stiffness:120}))*70*U}px)`}}>
   <Avatar unit={U} mood={L.mood} talking={abs>=L.from&&abs<L.to}/>
  </div>
  <div style={{position:'absolute',left:690,top:64,fontFamily:PIXEL,fontSize:34,color:C.warn,transform:`scale(${pop(f,4)})`,transformOrigin:'left center'}}>WHAT'S NEXT</div>
  {NEXT.map(([icon,title,sub,color],i)=>{const s=pop(f,14+i*14,{damping:14});
   return <div key={title} style={{position:'absolute',left:690,top:136+i*84,display:'flex',gap:24,alignItems:'center',opacity:s,transform:`translateX(${(1-s)*60}px)`}}>
    <Icon name={icon} unit={7} color={color}/>
    <div>
     <div style={{fontFamily:PIXEL,fontSize:22,color:C.white}}>{title}</div>
     <div style={{fontFamily:MONO,fontSize:21,color:C.text,opacity:0.8,marginTop:8}}>{sub}</div>
    </div>
   </div>})}
  <div style={{position:'absolute',left:690,top:500,display:'flex'}}>
   {'lokAl'.split('').map((ch,i)=>{const s=pop(f,LOGO+i*5,{damping:10});
    return <span key={i} style={{fontFamily:PIXEL,fontSize:120,color:i>2?C.accent2:C.accent,transform:`translateY(${(1-s)*-300}px)`,opacity:s>0.02?1:0,textShadow:`8px 8px 0 ${C.ink}`}}>{ch}</span>})}
  </div>
  <div style={{position:'absolute',left:696,top:660,fontFamily:PIXEL,fontSize:28,color:C.accent2,opacity:fade(f,LOGO+30,LOGO+42)}}>Your model. Paid. One command.</div>
  <div style={{position:'absolute',left:690,top:728,opacity:fade(f,LOGO+44,LOGO+56)}}>
   <Box auto bw={5} border={C.line} bg="#070b16"><div style={{padding:'16px 22px',fontFamily:MONO,fontSize:19,color:C.text,whiteSpace:'nowrap'}}><span style={{color:C.ok}}>$ </span>{INSTALL}</div></Box>
  </div>
  <div style={{position:'absolute',left:696,top:842,display:'flex',gap:28,fontFamily:PIXEL,fontSize:17,opacity:fade(f,LOGO+58,LOGO+70)}}>
   {PARTS.filter(p=>p.id!=='x402').map(p=><span key={p.id} style={{color:p.color}}>{p.name}</span>)}
  </div>
  <div style={{position:'absolute',left:696,top:892,fontFamily:MONO,fontSize:22,color:C.dim,opacity:fade(f,LOGO+66,LOGO+78)}}>TUM Blockchain & AI Hackathon 2026 · Cardano track</div>
 </AbsoluteFill>;
}
