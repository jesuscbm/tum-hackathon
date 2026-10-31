import React from 'react';
import {AbsoluteFill,useCurrentFrame,interpolate} from 'remotion';
import {C,PIXEL,MONO} from '../theme.js';
import {INSTALL} from '../script.mjs';
import {Box,Sfx,pop,fade,typed} from '../lib.jsx';

// Real installer output (install.sh), trimmed.
const OUT=[
 [150,[['◆ lok',C.accent],['Al ',C.accent2],['your local LLM, hired and paid on Cardano',C.dim]]],
 [162,[['◆ ',C.accent],['Downloading Node v24.22.1 (private copy, used only by lokAl)',C.text]]],
 [174,[['  ✔ ',C.ok],['Node v24.22.1 (sha256 verified)',C.text]]],
 [186,[['◆ ',C.accent],['Installing lokAl (main)',C.text]]],
 [198,[['  ✔ ',C.ok],['lokAl installed',C.text]]],
 [210,[['  ✔ ',C.ok],['Sokosumi CLI 1.0.4',C.text]]],
 [222,[['Done. ',C.ok],['Run: ',C.text],['lokAl',C.accent]]],
];
const T0=42,T1=140,K0=236,K1=250;

export function Command(){
 const f=useCurrentFrame();
 const menu=1-fade(f,26,34),win=pop(f,32),zoom=interpolate(f,[262,300],[1,1.35],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});
 const cursor=f%16<8?'█':' ';
 return <AbsoluteFill>
  <Sfx at={14} name="chime" volume={0.3}/><Sfx at={32} name="pop" volume={0.3}/>
  {Array.from({length:Math.floor((T1-T0)/3)},(_,i)=><Sfx key={i} at={T0+i*3} name="key" volume={0.12}/>)}
  {OUT.map(([t],i)=><Sfx key={'o'+i} at={t} name="blip" volume={0.1}/>)}
  {[0,1,2,3,4].map(i=><Sfx key={'k'+i} at={K0+i*3} name="key" volume={0.12}/>)}
  <Sfx at={T1+4} name="enter" volume={0.25}/><Sfx at={K1+6} name="enter" volume={0.25}/>
  {/* same place and size as the GAME OVER countdown, so the crossfade morphs one into the other */}
  {menu>0&&<div style={{opacity:menu,position:'absolute',top:540,width:'100%',textAlign:'center',fontFamily:PIXEL}}>
   <div style={{fontSize:40,color:C.warn}}>CONTINUE?<span style={{opacity:0}}> 9</span></div>
   <div style={{fontSize:36,marginTop:44,color:C.text}}><span style={{color:C.ok,opacity:f>=14&&f%6<3?0.3:1}}>▶ YES</span><span style={{marginLeft:120,color:C.dim}}>NO</span></div>
  </div>}
  <div style={{position:'absolute',left:170,top:70,width:1580,height:620,transform:`scale(${win*zoom})`,transformOrigin:'50% 40%'}}>
   <Box border="#374151" bg="#070b16" style={{inset:0}}>
    <div style={{height:52,background:'#1f2937',display:'flex',alignItems:'center',paddingLeft:22,gap:14}}>
     {[C.fail,C.warn,C.ok].map(c=><div key={c} style={{width:18,height:18,background:c}}/>)}
     <div style={{flex:1,textAlign:'center',fontFamily:MONO,fontSize:20,color:C.dim,marginRight:100}}>~ — zsh</div>
    </div>
    <div style={{padding:'26px 34px',fontFamily:MONO,fontSize:25,lineHeight:1.55,color:C.text,whiteSpace:'pre'}}>
     <div><span style={{color:C.ok}}>$ </span>{typed(INSTALL,f,T0,T1)}{f<T1+4&&cursor}</div>
     {OUT.map(([t,parts],i)=>f>=t&&<div key={i}>{parts.map(([s,c],j)=><span key={j} style={{color:c}}>{s}</span>)}</div>)}
     {f>=230&&<div><span style={{color:C.ok}}>$ </span><span style={{color:C.accent,fontWeight:700}}>{typed('lokAl',f,K0,K1)}</span>{cursor}</div>}
    </div>
   </Box>
  </div>
  <div style={{position:'absolute',left:170,top:716,width:1580,textAlign:'center',fontFamily:PIXEL,fontSize:24,color:C.accent2,opacity:fade(f,150,165)*(1-fade(f,262,272))}}>
   just one command
  </div>
 </AbsoluteFill>;
}
