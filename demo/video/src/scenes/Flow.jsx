import React from 'react';
import {AbsoluteFill,useCurrentFrame,interpolate} from 'remotion';
import {C,PIXEL,MONO} from '../theme.js';
import {Box,Icon,Sfx,pop,fade} from '../lib.jsx';

export const NODES=[
 {title:'BUYER',sub:'hires you on Sokosumi',icon:'shop',color:C.pink},
 {title:'ESCROW',sub:'Masumi on Cardano',icon:'lock',color:C.accent},
 {title:'YOUR MODEL',sub:'llama3.2:3b, local',icon:'chip',color:C.ok},
 {title:'CHECK',sub:'invoice → JSON',icon:'check',color:C.accent2},
 {title:'PAID',sub:'result hash on-chain',icon:'wallet',color:C.warn},
];
export const NX=[210,585,960,1335,1710],NY=90,NW=310,NH=270;
const SHOW=[20,36,52,68,84],LOCK=150,DOC=[262,300],WORK=[300,352],OUT=[352,392];
const CHIPS=[['escrow locked',LOCK],['answered',WORK[1]],['check passed',null],['paid',null]];
const hop=(f,[a,b],x0,x1,y,h=90)=>{const t=interpolate(f,[a,b],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});return [x0+(x1-x0)*t,y-Math.sin(t*Math.PI)*h]};

export function Node({n,i,f,at}){
 const s=pop(f,at);
 return <div style={{position:'absolute',left:NX[i]-NW/2,top:NY,width:NW,height:NH,transform:`scale(${s})`}}>
  <Box border={n.color} bg={C.panel} style={{inset:0}}>
   <div style={{position:'absolute',top:28,width:'100%',display:'flex',justifyContent:'center'}}>
    <Icon name={n.icon} unit={11} color={n.color}/>
   </div>
   <div style={{position:'absolute',top:146,width:'100%',textAlign:'center',fontFamily:PIXEL,fontSize:22,color:C.white}}>{n.title}</div>
   <div style={{position:'absolute',top:190,width:'100%',textAlign:'center',fontFamily:MONO,fontSize:19,color:C.text,opacity:0.8}}>{n.sub}</div>
  </Box>
 </div>;
}

export const Arrows=({f,from=0,lit=[]})=><svg width="1920" height="1080" style={{position:'absolute'}}>
 {[0,1,2,3].map(i=>{const x0=NX[i]+NW/2+6,x1=NX[i+1]-NW/2-6,y=NY+NH/2,p=fade(f,from+SHOW[i+1]-6,from+SHOW[i+1]+6),c=lit[i]?NODES[i+1].color:C.line;
  return <g key={i} opacity={p}>
   {Array.from({length:5},(_,k)=><rect key={k} x={x0+k*10} y={y-4} width={6} height={8} fill={c}/>)}
   <polygon points={`${x1-14},${y-14} ${x1},${y} ${x1-14},${y+14}`} fill={c}/>
  </g>})}
</svg>;

export function Flow(){
 const f=useCurrentFrame();
 const [cx,cy]=f<LOCK?hop(f,[110,LOCK],NX[0],NX[1],NY-10,120):[NX[1]+Math.sin(f/3)*(f<LOCK+20?4:1),NY-10];
 const [dx,dy]=f<WORK[0]?hop(f,DOC,NX[0],NX[2],NY+NH+40,60):hop(f,OUT,NX[2],NX[3],NY+NH+40,60);
 const docVis=(f>=DOC[0]&&f<WORK[0])||(f>=OUT[0]&&f<=OUT[1]+20);
 const card=pop(f,96,{damping:16});
 return <AbsoluteFill>
  {SHOW.map((t,i)=><Sfx key={i} at={t} name="pop" volume={0.25}/>)}
  <Sfx at={110} name="jump" volume={0.25}/><Sfx at={LOCK} name="coin" volume={0.35}/><Sfx at={LOCK+2} name="stamp" volume={0.3}/>
  <Sfx at={DOC[0]} name="jump" volume={0.2}/><Sfx at={WORK[1]} name="chime" volume={0.25}/><Sfx at={OUT[0]} name="jump" volume={0.2}/>
  <Arrows f={f} lit={[f>=LOCK,f>=DOC[1],f>=OUT[1],false]}/>
  {NODES.map((n,i)=><Node key={i} n={n} i={i} f={f} at={SHOW[i]}/>)}
  {f>=110&&<div style={{position:'absolute',left:cx-30,top:cy-60}}><Icon name="coin" unit={7.5} color="#ca8a04" light="#fde047"/></div>}
  {f>=LOCK&&<div style={{position:'absolute',left:NX[1]+30,top:NY-74,fontFamily:PIXEL,fontSize:18,color:C.accent,transform:`scale(${pop(f,LOCK)})`}}>LOCKED</div>}
  {docVis&&<div style={{position:'absolute',left:dx-24,top:dy-24}}><Icon name="doc" unit={6} color={C.text}/></div>}
  {f>=WORK[0]&&f<WORK[1]&&<div style={{position:'absolute',left:NX[2]-40,top:NY+NH+20,fontFamily:PIXEL,fontSize:28,color:C.ok}}>{'.'.repeat(1+Math.floor(f/6)%3)}</div>}
  {f>=OUT[1]&&<div style={{position:'absolute',left:NX[3]+90,top:NY-20,fontFamily:PIXEL,fontSize:48,color:C.warn,opacity:f%16<10?1:0.3}}>?</div>}
  <div style={{position:'absolute',left:300,top:470,width:1320,height:310,transform:`scale(${card})`,opacity:card}}>
   <Box border={C.text} bg={C.bg2} style={{inset:0}}>
    <div style={{position:'absolute',left:36,top:28,fontFamily:MONO,fontSize:24,color:C.text}}>
     <span style={{fontFamily:PIXEL,fontSize:22,color:C.accent}}>JOB 7e8c1b0f</span>
     <span style={{color:C.dim}}>  ·  </span>invoice → JSON<span style={{color:C.dim}}>  ·  Cardano preprod</span>
    </div>
    <div style={{position:'absolute',left:36,top:90,display:'flex',gap:16}}>
     {CHIPS.map(([label,t],i)=>{const on=t!=null&&f>=t;
      return <React.Fragment key={label}>
       {i>0&&<span style={{fontFamily:PIXEL,fontSize:22,color:on?C.text:C.line,alignSelf:'center'}}>→</span>}
       <div style={{transform:`scale(${on?0.9+0.1*pop(f,t):1})`}}>
        <Box auto bw={4} border={on?C.ok:C.line} bg={on?'#052e16':C.bg}><div style={{padding:'12px 18px',fontFamily:MONO,fontSize:22,color:on?C.ok:C.dim,whiteSpace:'nowrap'}}>{on?'✔ ':''}{label}</div></Box>
       </div>
      </React.Fragment>})}
    </div>
    <div style={{position:'absolute',left:36,top:180,fontFamily:MONO,fontSize:21,lineHeight:1.7,color:C.dim,opacity:fade(f,LOCK,LOCK+10)}}>
     <div><span style={{color:C.accent}}>FundsLocked</span>   tx 3c9e5b7a0d1f…be42a71b   <span style={{color:C.accent2}}>↗ preprod.cardanoscan.io</span></div>
     {f>=WORK[1]&&<div><span style={{color:C.ok}}>answered</span>      by llama3.2:3b on this machine, digest sha256:a80c4f17…</div>}
    </div>
   </Box>
  </div>
 </AbsoluteFill>;
}
