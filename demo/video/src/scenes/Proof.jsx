import React from 'react';
import {AbsoluteFill,Sequence,useCurrentFrame,interpolate,random} from 'remotion';
import {C,PIXEL,MONO} from '../theme.js';
import {Box,Icon,Sfx,pop,fade,typed} from '../lib.jsx';
import {Node} from './Flow.jsx';

// The paid job from docs/evidence.md (task 01a18e94…, 1 test USDM, Llama 3.2 3B), as it is on Cardano preprod.
// Hashes, blocks and datum fields were read from the chain; times are UTC on 30 Oct 2026.
const TX=[
 {kind:'AgentRegistered',hash:'27d3b0f8af44874537ef4a5fbccb15c9338996279f80a231351fec342303af11',block:5354444,time:'20:21',what:'agent 67ab0c92… joins the registry',color:C.accent2},
 {kind:'FundsLocked',hash:'bc6d593bb5dd5f62c84b611d577c38ea31a70297dbf2ae0b7fdf2da177c8b6e1',block:5354515,time:'20:53',what:'buyer → escrow · 1 USDM',color:C.pink},
 {kind:'ResultSubmitted',hash:'7332dccf8073bf45c3d69430bbdae30837ed67f116fa3b16c45e8d21af3107bb',block:5354521,time:'20:55',what:'result hash → escrow datum',color:C.ok},
 {kind:'Withdrawn',hash:'69b2da448d1e816f0b01d8a282ae9333a4ad365e65593a7af74b7ac8e4448bbe',block:5354839,time:'22:48',what:'escrow → my wallet · 1 USDM',color:C.warn},
];
const CONTRACT='addr_test1wzs4e6wc95hkwezlccjw9mdvq0r0rsgx6zk34avptga3ftgn37w4g';
const RESULT='6fc71a1c1004e6c723614aeb4e6bc2fbacc25bfef363ba7dc53ca6e4c05aed08';
const short=(h,a=14,b=8)=>`${h.slice(0,a)}…${h.slice(-b)}`;
const BEATS=[['EXPLORER',0,300],['CONTRACT',300,300],['TAMPER TEST',600,320]];

// Each beat fades in, and out again unless it is the last one (the scene crossfade takes over then).
const Beat=({len,last,children})=>{const f=useCurrentFrame();
 return <AbsoluteFill style={{opacity:Math.min(fade(f,0,10),last?1:1-fade(f,len-10,len))}}>{children}</AbsoluteFill>};

const Window=({title,style,children})=><div style={{position:'absolute',...style}}>
 <Box border="#374151" bg="#070b16" style={{inset:0}}>
  <div style={{height:52,background:'#1f2937',display:'flex',alignItems:'center',paddingLeft:22,gap:14}}>
   {[C.fail,C.warn,C.ok].map(c=><div key={c} style={{width:16,height:16,background:c}}/>)}
   <div style={{flex:1,textAlign:'center',fontFamily:MONO,fontSize:20,color:C.dim,marginRight:90}}>{title}</div>
  </div>
  {children}
 </Box>
</div>;

const Caption=({f,at,children})=><div style={{position:'absolute',left:300,right:120,top:808,fontFamily:MONO,fontSize:22,color:C.accent2,opacity:fade(f,at,at+10)}}>{children}</div>;

function Explorer(){
 const f=useCurrentFrame(),COL=[30,340,720,880,1000];
 return <>
  {TX.map((_,i)=><Sfx key={i} at={20+i*36} name="blip" volume={0.2}/>)}
  <Sfx at={180} name="coin" volume={0.3}/>
  <Window title="preprod.cardanoscan.io · Cardano preprod testnet" style={{left:120,top:130,width:1680,height:640}}>
   <div style={{position:'absolute',top:84,left:0,right:0,fontFamily:MONO,fontSize:18,color:C.dim}}>
    {['TYPE','TX HASH','BLOCK','UTC','WHAT HAPPENED'].map((h,i)=><span key={h} style={{position:'absolute',left:COL[i]}}>{h}</span>)}
   </div>
   {TX.map((t,i)=>{const s=pop(f,20+i*36,{damping:15});
    return <div key={t.kind} style={{position:'absolute',left:0,right:0,top:128+i*92,height:76,opacity:s,transform:`translateX(${(1-s)*-40}px)`,background:i%2?'transparent':'#0d1328'}}>
     <div style={{position:'absolute',left:COL[0],top:14}}><Box auto bw={4} border={t.color} bg={C.bg2}><div style={{padding:'10px 14px',fontFamily:PIXEL,fontSize:14,color:t.color}}>{t.kind}</div></Box></div>
     {[[short(t.hash),C.white],['#'+t.block,C.text],[t.time,C.text],[t.what,C.text]].map(([v,c],k)=>
      <span key={k} style={{position:'absolute',left:COL[k+1],top:22,fontFamily:MONO,fontSize:22,color:c}}>{v}</span>)}
    </div>})}
   <div style={{position:'absolute',left:30,top:508,fontFamily:PIXEL,fontSize:18,color:C.ok,opacity:fade(f,180,190)}}>ONE PAID JOB, END TO END</div>
   <div style={{position:'absolute',left:30,top:552,fontFamily:MONO,fontSize:21,color:C.text,opacity:fade(f,190,200)}}>
    task 01a18e94-ee86-7719-8354-10e1caa7333e · invoice → JSON · Llama 3.2 3B on my laptop · <span style={{color:C.warn}}>1 USDM to my wallet</span>
   </div>
  </Window>
  <Caption f={f} at={60}>↗ preprod.cardanoscan.io/transaction/{TX[2].hash}</Caption>
 </>;
}

// Buyer, escrow contract and seller wallet; the coin and the result hash move along the transactions above.
const ROLES=[{title:'BUYER',sub:'addr_test1qz2aac…',icon:'shop',color:C.pink},{title:'ESCROW',sub:'addr_test1wzs4e6…',icon:'lock',color:C.accent},{title:'MY WALLET',sub:'addr_test1qqqgjj…',icon:'wallet',color:C.warn}];
const LOCK=[30,70],SUBMIT=[100,140],PAY=[170,210];
const lerp=(f,[a,b],x0,x1)=>x0+(x1-x0)*interpolate(f,[a,b],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});
function Lane({f,at,x0,x1,y,label,hash,color,below}){
 const dir=x1>x0?1:-1,head=dir>0?`${x1-14},${y-12} ${x1},${y} ${x1-14},${y+12}`:`${x1+14},${y-12} ${x1},${y} ${x1+14},${y+12}`;
 return <>
  <svg width="1920" height="1080" style={{position:'absolute',opacity:fade(f,at-8,at)}}>
   <line x1={x0} y1={y} x2={x1} y2={y} stroke={color} strokeWidth={6} strokeDasharray="12 10" strokeDashoffset={-f*dir*2}/>
   <polygon points={head} fill={color}/>
  </svg>
  <div style={{position:'absolute',left:Math.min(x0,x1),width:Math.abs(x1-x0),top:below?y+18:y-78,textAlign:'center',opacity:fade(f,at-8,at)}}>
   <div style={{fontFamily:PIXEL,fontSize:14,color}}>{label}</div>
   <div style={{fontFamily:MONO,fontSize:19,color:C.text,marginTop:10}}>{hash}</div>
  </div>
 </>;
}
function Contract(){
 const f=useCurrentFrame(),locked=f>=LOCK[1]&&f<PAY[0],held=f>=SUBMIT[1];
 return <>
  <Sfx at={LOCK[0]} name="jump" volume={0.2}/><Sfx at={LOCK[1]} name="stamp" volume={0.3}/><Sfx at={SUBMIT[0]} name="jump" volume={0.2}/>
  <Sfx at={SUBMIT[1]} name="chime" volume={0.25}/><Sfx at={PAY[0]} name="jump" volume={0.2}/><Sfx at={PAY[1]} name="coin" volume={0.35}/>
  <div style={{position:'absolute',top:130,width:'100%',textAlign:'center',fontFamily:PIXEL,fontSize:20,color:C.accent}}>MASUMI ESCROW SMART CONTRACT</div>
  <div style={{position:'absolute',top:170,width:'100%',textAlign:'center',fontFamily:MONO,fontSize:28,color:C.white,opacity:fade(f,4,14)}}>{CONTRACT}</div>
  <div style={{position:'absolute',left:0,top:160}}>{ROLES.map((n,i)=><Node key={n.title} n={n} i={i*2} f={f} at={6+i*6}/>)}</div>
  <Lane f={f} at={LOCK[0]} x0={375} x1={795} y={385} label="FundsLocked" hash="bc6d593b…" color={C.pink}/>
  <Lane f={f} at={SUBMIT[0]} x0={1545} x1={1125} y={345} label="ResultSubmitted" hash="7332dccf…" color={C.ok}/>
  <Lane f={f} at={PAY[0]} x0={1125} x1={1545} y={430} label="Withdrawn" hash="69b2da44…" color={C.warn} below/>
  {f>=LOCK[0]&&f<LOCK[1]&&<div style={{position:'absolute',left:lerp(f,LOCK,375,795)-20,top:385-20}}><Icon name="coin" unit={5} color="#ca8a04" light="#fde047"/></div>}
  {f>=PAY[0]&&f<PAY[1]&&<div style={{position:'absolute',left:lerp(f,PAY,1125,1545)-20,top:430-20}}><Icon name="coin" unit={5} color="#ca8a04" light="#fde047"/></div>}
  {f>=SUBMIT[0]&&f<SUBMIT[1]&&<div style={{position:'absolute',left:lerp(f,SUBMIT,1545,1125)-24,top:345-24}}><Icon name="doc" unit={6} color={C.ok}/></div>}
  {locked&&<div style={{position:'absolute',left:1040,top:226,transform:`scale(${pop(f,LOCK[1])})`}}><Box auto bw={4} border={C.warn} bg={C.bg2}><div style={{padding:'8px 12px',fontFamily:PIXEL,fontSize:14,color:C.warn}}>1 USDM</div></Box></div>}
  {held&&<div style={{position:'absolute',left:960-90,top:500,transform:`scale(${pop(f,SUBMIT[1])})`}}><Box auto bw={4} border={C.ok} bg="#052e16"><div style={{padding:'8px 12px',fontFamily:MONO,fontSize:19,color:C.ok}}># {RESULT.slice(0,8)}</div></Box></div>}
  {f>=PAY[1]&&<div style={{position:'absolute',left:1740,top:226,transform:`scale(${pop(f,PAY[1])})`}}><Box auto bw={4} border={C.warn} bg={C.bg2}><div style={{padding:'8px 12px',fontFamily:PIXEL,fontSize:14,color:C.warn}}>+1 USDM</div></Box></div>}
  <div style={{position:'absolute',left:120,top:590,width:1680,height:190,opacity:fade(f,SUBMIT[1]-10,SUBMIT[1]),transform:`translateY(${(1-fade(f,SUBMIT[1]-10,SUBMIT[1]))*20}px)`}}>
   <Box border={C.accent} bg={C.ink} style={{inset:0}}>
    <div style={{position:'absolute',left:34,top:26,fontFamily:PIXEL,fontSize:16,color:C.accent}}>ESCROW DATUM · ON-CHAIN IN TX 7332dccf…</div>
    <div style={{position:'absolute',left:34,top:68,fontFamily:MONO,fontSize:22,color:C.text,whiteSpace:'pre'}}>
     buyer <span style={{color:C.pink}}>95dee1f5cdb6…</span>   seller <span style={{color:C.warn}}>00894802b33c…</span>   agent <span style={{color:C.accent2}}>67ab0c92c4ac1610…</span>
    </div>
    <div style={{position:'absolute',left:34,top:112,fontFamily:MONO,fontSize:22,color:C.text,whiteSpace:'pre',opacity:fade(f,SUBMIT[1]+8,SUBMIT[1]+16)}}>
     resultHash <span style={{color:C.ok,fontWeight:700}}>{RESULT}</span>
    </div>
   </Box>
  </div>
  <Caption f={f} at={PAY[1]}>→ the money waited in the contract, not with me and not with the buyer</Caption>
 </>;
}

// The re-run's hash depends on the exact result text, which only the seller holds; this one is illustrative.
const BAD=Array.from({length:8},(_,i)=>'0123456789abcdef'[Math.floor(random(`tamper${i}`)*16)]).join('');
const VERIFY=`lokal verify result.json ${RESULT}`,SED=`sed -i 's/llama3.2:3b/llama3.1:8b/' result.json`;
const OK=[['✔ hash matches',C.ok],['  model   llama3.2:3b',C.text],['  weights sha256:a80c4f17acd5…',C.text],['  prompt  sha256:a15a80b39171…',C.text],['  check   invoice: passed',C.text]];
function Tamper(){
 const f=useCurrentFrame(),cursor=f%16<8?'█':' ';
 const at=[[8,44],[96,126],[150,150]],out=52,rerun=166,stamp=182;
 return <>
  {Array.from({length:12},(_,i)=><Sfx key={'a'+i} at={8+i*3} name="key" volume={0.1}/>)}
  {Array.from({length:10},(_,i)=><Sfx key={'b'+i} at={96+i*3} name="key" volume={0.1}/>)}
  <Sfx at={48} name="enter" volume={0.25}/><Sfx at={out} name="chime" volume={0.25}/><Sfx at={128} name="enter" volume={0.25}/>
  <Sfx at={160} name="enter" volume={0.25}/><Sfx at={rerun} name="buzz" volume={0.3}/><Sfx at={stamp} name="stamp" volume={0.45}/>
  <Window title="~ — zsh · anyone can run this" style={{left:170,top:130,width:1580,height:640}}>
   <div style={{padding:'26px 34px',fontFamily:MONO,fontSize:24,lineHeight:1.55,color:C.text,whiteSpace:'pre'}}>
    <div><span style={{color:C.ok}}>$ </span>{typed(VERIFY,f,...at[0])}{f<48&&cursor}</div>
    {OK.map(([l,c],i)=>f>=out+i*6&&<div key={i} style={{color:c}}>{l}</div>)}
    {f>=90&&<div><span style={{color:C.ok}}>$ </span>{typed(SED,f,...at[1])}{f>=130&&<span style={{color:C.dim}}>   # claim a bigger model</span>}{f>=90&&f<128&&cursor}</div>}
    {f>=150&&<div><span style={{color:C.ok}}>$ </span>{VERIFY}{f<160&&cursor}</div>}
    {f>=rerun&&<div style={{color:C.fail}}>✖ hash {BAD}… ≠ expected {RESULT.slice(0,8)}…</div>}
   </div>
  </Window>
  {f>=stamp&&<div style={{position:'absolute',left:1260,top:560,transform:`scale(${2.4-1.4*pop(f,stamp,{damping:14,stiffness:260})}) rotate(-10deg)`}}>
   <Box auto bw={8} border={C.fail} bg="#2a0f17"><div style={{padding:'18px 30px',fontFamily:PIXEL,fontSize:48,color:C.fail}}>TAMPERED</div></Box>
  </div>}
  <Caption f={f} at={stamp+20}>one changed word → a different hash · the chain keeps the original</Caption>
 </>;
}

const PARTS=[Explorer,Contract,Tamper];
export function Proof(){
 const f=useCurrentFrame(),cur=BEATS.findLastIndex(([,a])=>f>=a);
 return <AbsoluteFill>
  <div style={{position:'absolute',left:120,right:120,top:44,display:'flex',alignItems:'center',gap:16}}>
   <span style={{fontFamily:PIXEL,fontSize:26,color:C.accent}}>PROOF</span>
   <span style={{fontFamily:MONO,fontSize:22,color:C.dim,flex:1,marginLeft:10}}>on Cardano preprod</span>
   {BEATS.map(([t],k)=><Box key={t} auto bw={4} border={k===cur?C.accent2:C.line} bg={k===cur?'#1a2148':C.bg}>
    <div style={{padding:'10px 16px',fontFamily:PIXEL,fontSize:16,color:k===cur?C.white:C.dim}}>{k+1} {t}</div>
   </Box>)}
  </div>
  {BEATS.map(([t,a,len],k)=>{const Part=PARTS[k];
   return <Sequence key={t} from={a} durationInFrames={len} name={t}><Beat len={len} last={k===BEATS.length-1}><Part/></Beat></Sequence>})}
 </AbsoluteFill>;
}
