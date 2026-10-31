import React from 'react';
import {AbsoluteFill,useCurrentFrame,interpolate} from 'remotion';
import {C,PIXEL,MONO} from '../theme.js';
import {Box,Icon,Sfx,pop,fade,typed} from '../lib.jsx';

// The twist: the deterministic check decides whether the result is ever submitted to the escrow.
const CASES=[
 {x:70,t:10,title:'JOB A · a real invoice',color:C.ok,bg:'#052e16',stamp:'PASS',
  out:'{"vendor": "Café Lisboa",\n "items": 3,\n "total": 25.81}',
  checks:[['✔','valid JSON'],['✔','matches the schema'],['✔','line items add up to total']],
  after:[['→','result hash submitted on-chain'],['→','escrow released: PAID']]},
 {x:990,t:170,title:'JOB B · not an invoice',color:C.fail,bg:'#2a0f17',stamp:'FAIL',
  out:'{"error": "not an invoice"}',
  checks:[['✖','missing field "vendor"'],['↻','retried once: still fails']],
  after:[['→','result never submitted'],["→","buyer isn't charged"]]},
];

function Card({c,f}){
 const t=f-c.t,s=pop(f,c.t,{damping:15}),stampAt=85,afterAt=105;
 return <div style={{position:'absolute',left:c.x,top:40,width:860,height:560,transform:`scale(${s})`,opacity:s}}>
  <Box border={t>=stampAt?c.color:C.line} bg={C.panel} style={{inset:0}}>
   <div style={{position:'absolute',left:34,top:30,fontFamily:PIXEL,fontSize:22,color:C.white}}>{c.title}</div>
   <div style={{position:'absolute',left:34,top:84,right:34,height:150,background:'#070b16',padding:'16px 22px',fontFamily:MONO,fontSize:24,lineHeight:1.45,color:C.accent2,whiteSpace:'pre'}}>
    {typed(c.out,t,14,44)}
   </div>
   <div style={{position:'absolute',left:34,top:270,fontFamily:MONO,fontSize:24,lineHeight:1.75}}>
    {c.checks.map(([i,l],k)=>t>=50+k*10&&<div key={k}><span style={{color:i==='↻'?C.warn:c.color}}>{i}</span> <span style={{color:C.text}}>{l}</span></div>)}
   </div>
   <div style={{position:'absolute',left:34,top:420,fontFamily:MONO,fontSize:24,lineHeight:1.65}}>
    {c.after.map(([i,l],k)=>t>=afterAt+k*14&&<div key={k} style={{color:c.color}}>{i} {l}</div>)}
   </div>
  </Box>
  {t>=stampAt&&<div style={{position:'absolute',right:40,top:240,transform:`scale(${2.4-1.4*pop(f,c.t+stampAt,{damping:14,stiffness:260})}) rotate(-10deg)`}}>
   <Box auto bw={8} border={c.color} bg={c.bg}><div style={{padding:'18px 30px',fontFamily:PIXEL,fontSize:54,color:c.color}}>{c.stamp}</div></Box>
  </div>}
 </div>;
}

export function Gate(){
 const f=useCurrentFrame();
 const [a,b]=CASES;
 // Pass: coin drops into the wallet. Fail: coin bounces back to the buyer.
 const drop=interpolate(f,[a.t+120,a.t+140],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});
 const back=interpolate(f,[b.t+120,b.t+145],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});
 const prov=fade(f,255,268);
 return <AbsoluteFill>
  {CASES.map((c,i)=><React.Fragment key={i}>
   <Sfx at={c.t} name="pop" volume={0.25}/>
   {c.checks.map((_,k)=><Sfx key={k} at={c.t+50+k*10} name={i?'buzz':'blip'} volume={i?0.12:0.15}/>)}
   <Sfx at={c.t+85} name="stamp" volume={0.45}/><Sfx at={c.t+88} name={i?'buzz':'chime'} volume={0.3}/>
  </React.Fragment>)}
  <Sfx at={a.t+140} name="coin" volume={0.35}/><Sfx at={b.t+120} name="jump" volume={0.2}/>
  {CASES.map((c,i)=><Card key={i} c={c} f={f}/>)}
  {f>=a.t+118&&<div style={{position:'absolute',left:a.x+700,top:460}}>
   <div style={{position:'absolute',left:10,top:-150+drop*130,opacity:drop<1?1:0}}><Icon name="coin" unit={6} color="#ca8a04" light="#fde047"/></div>
   <div style={{transform:`scale(${1+(drop===1?0.15*Math.max(0,1-(f-a.t-140)/8):0)})`}}><Icon name="wallet" unit={8} color={C.warn}/></div>
  </div>}
  {f>=b.t+118&&<div style={{position:'absolute',left:b.x+700,top:460}}>
   <div style={{position:'absolute',left:10+back*60,top:-30-Math.sin(back*Math.PI)*90-back*20,opacity:1-back*0.3}}><Icon name="coin" unit={6} color="#ca8a04" light="#fde047"/></div>
   <div style={{position:'absolute',left:-80,top:0,opacity:0.9}}><Icon name="shop" unit={8} color={C.pink}/></div>
  </div>}
  <div style={{position:'absolute',left:70,right:70,top:630,height:180,opacity:prov,transform:`translateY(${(1-prov)*30}px)`}}>
   <Box border={C.accent} bg={C.ink} style={{inset:0}}>
    <div style={{position:'absolute',left:36,top:28,fontFamily:PIXEL,fontSize:20,color:C.accent}}>PROVENANCE: the on-chain result hash</div>
    <div style={{position:'absolute',left:36,top:76,fontFamily:MONO,fontSize:25,color:C.text,whiteSpace:'pre'}}>
     sha256({'{'} output, model: <span style={{color:C.ok}}>"llama3.2:3b"</span>, digest: <span style={{color:C.accent2}}>"sha256:a80c4f17…"</span>, promptHash: <span style={{color:C.warn}}>"sha256:3b1f9e2c…"</span>, check {'}'})
    </div>
    <div style={{position:'absolute',left:36,top:122,fontFamily:MONO,fontSize:21,color:C.dim,opacity:fade(f,280,292)}}>→ anyone can recompute it and see exactly which weights and which prompt did the work</div>
   </Box>
  </div>
 </AbsoluteFill>;
}
