import React from 'react';
import {AbsoluteFill,useCurrentFrame,interpolate} from 'remotion';
import {C,PIXEL,MONO,PARTS} from '../theme.js';
import {Box,Brand,Sfx,pop,fade} from '../lib.jsx';
import {Badge} from '../parts.jsx';

// The five lokal steps with the labels from core/steps/*.mjs and core/mock.mjs. [label, detail when done, frames, progress label]
const STEPS=[
 ['Your machine & model',[['Hardware','8-core CPU · 16 GB RAM · CPU inference',10],['Ollama runtime','v0.40.13 · installed for you, no sudo',28,'Downloading Ollama 1.4 GB'],
  ['Model llama3.2:3b','sha256:a80c4f17acd5… fits your RAM',34,'pulling llama3.2:3b 2.0 GB'],['Test prompt','answered in 2.1s',12]]],
 ['Pick a job',[['Template','Invoice → JSON',14],['Check','JSON schema + line items add up',14],['Tried it','5/5 samples behave as labelled',30,'trying 5 samples']]],
 ['Connect Sokosumi',[['Sokosumi CLI','v1.0.4',10],['Account','one browser sign-in',24,'waiting for browser sign-in'],['Vendor','lokAl-you',12],['Coworker','llama3.2:3b via lokAl',12],['Runtime key','stored in the CLI vault',12]]],
 ['Get paid',[['Blockfrost key','preprod project id set',12],['Payment service','Masumi · 127.0.0.1:38127',26,'installing your payment service'],
  ['Selling wallet','addr_test1qz8f…x7y6 · 10000 tADA',18],['Registry','agent 7e8c1b0f… on Cardano',24,'registering on Cardano preprod'],['Paid tasks','enabled',10]]],
 ["You're live",[['Agent (Eve)','running',10],['Worker','running',10],['Agent API (MIP-003)','running',10],['First job','test job sent: invoice → JSON',18]]],
].map(([title,items],k)=>{let t=24+k*126+8;
 return {title,start:24+k*126,items:items.map(([label,detail,d,prog])=>{const it={label,detail,prog,run:t,done:t+d};t+=d+4;return it})}});
const stepDone=k=>STEPS[k].items.at(-1).done;
const done=(k,i)=>STEPS[k].items[i].done;

// Right-hand column: each integration lights up when the step that wires it finishes.
const MODEL={id:'model',name:'OLLAMA',sub:'llama3.2:3b, local',color:C.ok,icon:'doc'};
const P=Object.fromEntries(PARTS.map(p=>[p.id,p]));
const COLUMN=[[MODEL,done(0,2)],[P.sokosumi,done(2,3)],[P.blockfrost,done(3,0)],[P.masumi,done(3,1)],[P.x402,done(3,1)+8],[P.cardano,done(3,3)]];
const LIVE=stepDone(4)+14;

export function Wizard(){
 const f=useCurrentFrame();
 const cur=Math.max(0,STEPS.findLastIndex(s=>f>=s.start));
 const spin=['◐','◓','◑','◒'][Math.floor(f/4)%4];
 const s=STEPS[cur],win=pop(f,0,{damping:16});
 return <AbsoluteFill>
  {STEPS.flatMap((st,k)=>st.items.map((it,i)=><Sfx key={k+'-'+i} at={it.done} name="blip" volume={0.12}/>))}
  {STEPS.map((st,k)=><Sfx key={'s'+k} at={stepDone(k)+2} name="chime" volume={0.22}/>)}
  {COLUMN.map(([p,t])=><Sfx key={p.id} at={t} name="pop" volume={0.25}/>)}
  <Sfx at={LIVE} name="coin" volume={0.3}/>
  <div style={{position:'absolute',left:60,top:44,width:1240,height:780,transform:`scale(${0.9+0.1*win})`,opacity:win}}>
   <Box border="#374151" bg="#070b16" style={{inset:0}}>
    <div style={{height:48,background:'#1f2937',display:'flex',alignItems:'center',paddingLeft:22,gap:14}}>
     {[C.fail,C.warn,C.ok].map(c=><div key={c} style={{width:16,height:16,background:c}}/>)}
     <div style={{flex:1,textAlign:'center',fontFamily:MONO,fontSize:18,color:C.dim,marginRight:90}}>lokAl</div>
    </div>
    <div style={{position:'absolute',left:34,right:34,top:72,display:'flex',justifyContent:'space-between',fontFamily:MONO,fontSize:26}}>
     <span style={{color:C.accent,fontWeight:700}}>◆ <Brand/></span><span style={{color:C.dim}}>setup · step {cur+1}/5</span>
    </div>
    <div style={{position:'absolute',left:24,top:136,width:420,fontFamily:MONO,fontSize:23}}>
     {STEPS.map((st,k)=>{const ok=f>=stepDone(k),run=k===cur&&!ok;
      return <div key={k} style={{display:'flex',gap:16,padding:'14px 14px',marginBottom:6,background:k===cur?'#1a2148':'transparent',borderLeft:`6px solid ${k===cur?C.accent:'transparent'}`}}>
       <span style={{color:ok?C.ok:run?C.accent2:C.dim,width:24}}>{ok?'✔':run?spin:'○'}</span>
       <span style={{color:ok||k===cur?C.text:C.dim}}>{st.title}</span>
      </div>})}
    </div>
    <div style={{position:'absolute',left:464,top:136,bottom:70,width:3,background:C.line}}/>
    <div style={{position:'absolute',left:500,right:30,top:140,fontFamily:MONO}}>
     <div style={{fontFamily:PIXEL,fontSize:22,color:C.accent2,marginBottom:26}}>{s.title.toUpperCase()}</div>
     {s.items.map((it,i)=>{const st=f>=it.done?'ok':f>=it.run?'run':'todo';
      const pct=interpolate(f,[it.run,it.done],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});
      return <div key={i} style={{display:'flex',gap:16,marginBottom:18,opacity:st==='todo'?0.45:1}}>
       <span style={{fontSize:24,width:24,color:st==='ok'?C.ok:st==='run'?C.accent2:C.dim}}>{st==='ok'?'✔':st==='run'?spin:'○'}</span>
       <div>
        <div style={{fontSize:24,color:C.text,fontWeight:700}}>{it.label}</div>
        <div style={{fontSize:19,color:st==='ok'?'#9ca3af':C.accent2,marginTop:4}}>
         {st==='ok'?it.detail:st==='run'&&it.prog?<><span>{'█'.repeat(Math.round(pct*16))}</span><span style={{color:C.line}}>{'░'.repeat(16-Math.round(pct*16))}</span> {it.prog}</>:st==='run'?'working…':'waiting'}
        </div>
       </div>
      </div>})}
    </div>
    <div style={{position:'absolute',left:34,bottom:22,fontFamily:MONO,fontSize:18,color:C.dim}}>enter run · t test job · tab next · q quit</div>
   </Box>
   {f>=LIVE&&<div style={{position:'absolute',left:0,right:0,top:300,textAlign:'center',transform:`scale(${pop(f,LIVE)}) rotate(-4deg)`}}>
    <Box border={C.ok} bg="#052e16" bw={8} auto><div style={{padding:'24px 40px',fontFamily:PIXEL,fontSize:54,color:C.ok}}>YOU'RE LIVE!</div></Box>
   </div>}
  </div>
  {COLUMN.map(([p,t],i)=>{const lit=f>=t,s=lit?pop(f,t,{damping:9}):0;
   return <Badge key={p.id} part={p} lit={lit} checked={lit} w={500} h={108} style={{left:1360,top:52+i*128,transform:`scale(${0.94+0.06*s}) translateX(${(1-fade(f,6+i*5,16+i*5))*80}px)`,opacity:fade(f,6+i*5,16+i*5)}}/>})}
 </AbsoluteFill>;
}
