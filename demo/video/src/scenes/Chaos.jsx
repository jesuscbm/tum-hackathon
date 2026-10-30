import React from 'react';
import {AbsoluteFill,useCurrentFrame,random} from 'remotion';
import {C,PIXEL,MONO,PARTS} from '../theme.js';
import {Box,Pixels,Sfx,pop,fade} from '../lib.jsx';
import {Badge} from '../parts.jsx';

const SPOTS=[[250,150],[1430,120],[780,300],[300,520],[1380,500]],SHOW=[18,44,70,96,122];
const CHIPS=['seed phrase?','API key?','Postgres','Docker','selling wallet','test ADA','runtime key','Vendor','Coworker','registry','dispenser','receipt?'];
const TANGLE=[[0,2],[1,2],[2,3],[3,4],[0,4],[1,3],[0,1],[2,4]];
// "N hours later" time card, drawn in the video's own pixel style.
const LATER=336,TITLE='20 HOURS LATER...',HUES=[C.warn,'#fb923c',C.pink,C.accent2];
const CLOCK=['....#####....','..##.....##..','.#.........#.','.#.........#.','#...........#','#...........#','#...........#','#...........#','#...........#','.#.........#.','.#.........#.','..##.....##..','....#####....'];

export function Chaos(){
 const f=useCurrentFrame();
 const panic=fade(f,120,300);
 const at=i=>{const [x,y]=SPOTS[i],j=(4+panic*14);
  return [x+Math.sin(f/23+i*2)*20+(random(`jx${i}-${f>>1}`)-0.5)*j,y+Math.cos(f/19+i*3)*16+(random(`jy${i}-${f>>1}`)-0.5)*j]};
 const shake=f>=262&&f<272?(random(`k${f}`)-0.5)*24:0;
 const over=fade(f,330,350);
 return <AbsoluteFill style={{transform:`translate(${shake}px,${shake*0.6}px)`}}>
  {SHOW.map((t,i)=><Sfx key={i} at={t} name="pop" volume={0.3}/>)}
  {CHIPS.map((_,i)=><Sfx key={i} at={140+i*9} name="blip" volume={0.12}/>)}
  <Sfx at={262} name="stamp" volume={0.5}/><Sfx at={LATER+14} name="later" volume={0.4}/>
  {[0,4,8,12].map(t=><Sfx key={'t'+t} at={LATER+t} name="key" volume={0.15}/>)}
  <svg width="1920" height="1080" style={{position:'absolute'}}>
   {TANGLE.map(([a,b],i)=>{const t=Math.max(SHOW[a],SHOW[b])+10;if(f<t)return null;const [x1,y1]=at(a),[x2,y2]=at(b);
    return <line key={i} x1={x1+190} y1={y1+52} x2={x2+190} y2={y2+52} stroke={C.fail} strokeOpacity={0.55} strokeWidth={6} strokeDasharray="12 12" strokeDashoffset={-f*2}/>})}
  </svg>
  {PARTS.map((p,i)=>{const s=pop(f,SHOW[i]);const [x,y]=at(i);
   return <Badge key={p.id} part={p} style={{left:x,top:y,transform:`scale(${s}) rotate(${Math.sin(f/30+i)*(3+panic*5)}deg)`}}/>})}
  {CHIPS.map((c,i)=>{const s=pop(f,140+i*9);if(s<=0.01)return null;
   const x=120+random(`cx${i}`)*1500,y=60+random(`cy${i}`)*700,r=(random(`cr${i}`)-0.5)*14+Math.sin(f/10+i)*3*panic;
   return <div key={c} style={{position:'absolute',left:x,top:y,transform:`scale(${s}) rotate(${r}deg)`}}>
    <Box border={c.endsWith('?')?C.fail:C.line} bg={C.bg2} bw={4} auto>
     <div style={{padding:'10px 18px',fontFamily:MONO,fontSize:22,color:c.endsWith('?')?C.fail:C.text,whiteSpace:'nowrap'}}>{c}</div>
    </Box>
   </div>})}
  {f>=262&&<div style={{position:'absolute',left:0,right:0,top:330,display:'flex',justifyContent:'center',opacity:1-fade(f,330,345),transform:`scale(${2.6-1.6*pop(f,262,{damping:14,stiffness:260})}) rotate(-6deg)`}}>
   <Box border={C.fail} bg="#2a0f17" bw={8} auto>
    <div style={{padding:'26px 44px',fontFamily:PIXEL,fontSize:58,color:C.fail}}>12+ MANUAL STEPS</div>
   </Box>
  </div>}
  {over>0&&<AbsoluteFill style={{background:`rgba(11,16,32,${over*0.93})`}}>
   {Array.from({length:14},(_,i)=>{const t=f-LATER-random(`bt${i}`)*40,y=1080-t*(4+random(`bv${i}`)*4),s=2+Math.round(random(`bs${i}`)*3);
    return t>0&&<div key={i} style={{position:'absolute',left:80+random(`bx${i}`)*1760+Math.sin(t/9+i)*14,top:y,opacity:0.5}}>
     <Pixels unit={s*2} rows={['.##.','#..#','#..#','.##.']} palette={{'#':C.accent2}}/></div>})}
   <div style={{position:'absolute',left:960-52,top:110,transform:`scale(${pop(f,LATER)})`}}>
    <Pixels unit={8} rows={CLOCK} palette={{'#':C.text}}>
     <rect x={6} y={2} width={1} height={4.5} fill={C.warn} transform={`rotate(${(f-LATER)*36} 6.5 6.5)`}/>
     <rect x={6} y={3.5} width={1} height={3} fill={C.text} transform={`rotate(${(f-LATER)*3} 6.5 6.5)`}/>
    </Pixels>
   </div>
   <div style={{position:'absolute',top:270,width:'100%',display:'flex',justifyContent:'center',fontFamily:PIXEL,fontSize:92}}>
    {[...TITLE].map((ch,i)=>{const s=pop(f,LATER+14+i*2,{damping:9});
     return <span key={i} style={{display:'inline-block',whiteSpace:'pre',color:HUES[i%HUES.length],opacity:s>0.02?1:0,
      transform:`translateY(${(1-s)*-80+Math.sin(f/5+i)*6}px) rotate(${Math.sin(f/7+i*1.3)*5}deg)`,textShadow:`6px 6px 0 ${C.ink},-2px -2px 0 ${C.ink}`}}>{ch}</span>})}
   </div>
   <div style={{position:'absolute',top:420,width:'100%',textAlign:'center',fontFamily:PIXEL,fontSize:24,color:C.text,opacity:fade(f,384,396),letterSpacing:2}}>
    COFFEES <span style={{color:C.warn}}>6</span>   ·   STEPS DONE <span style={{color:C.warn}}>9/12</span>   ·   tADA EARNED <span style={{color:C.fail}}>0</span>
   </div>
   {f>=400&&<div style={{position:'absolute',top:540,width:'100%',textAlign:'center',fontFamily:PIXEL,fontSize:40,color:C.warn,opacity:f%20<14?1:0.3}}>CONTINUE? {9-Math.floor((f-400)/25)}</div>}
  </AbsoluteFill>}
 </AbsoluteFill>;
}
