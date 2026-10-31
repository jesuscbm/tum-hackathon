import React from 'react';
import {AbsoluteFill,useCurrentFrame,random,interpolate} from 'remotion';
import {C} from './theme.js';
import {W,H,SCENES,LINES,lineAt} from './script.mjs';
import {Box} from './lib.jsx';
import {Avatar} from './Avatar.jsx';

export function Backdrop(){
 const f=useCurrentFrame();
 return <AbsoluteFill style={{background:`radial-gradient(ellipse at 50% 35%,${C.bg2} 0%,${C.bg} 70%)`}}>
  <AbsoluteFill style={{backgroundImage:`linear-gradient(${C.line}22 2px,transparent 2px),linear-gradient(90deg,${C.line}22 2px,transparent 2px)`,backgroundSize:'80px 80px',backgroundPosition:`0 ${f*0.5%80}px`}}/>
  {Array.from({length:60},(_,i)=>{const s=random(`z${i}`)<0.3?6:3;
   return <div key={i} style={{position:'absolute',left:random(`x${i}`)*W,top:random(`y${i}`)*H,width:s,height:s,background:i%7?C.text:C.accent2,
    opacity:0.15+0.5*Math.abs(Math.sin(f/25+i*1.7))}}/>})}
 </AbsoluteFill>;
}

export const CRT=()=><AbsoluteFill style={{pointerEvents:'none',
 background:`repeating-linear-gradient(0deg,rgba(0,0,0,0.10) 0 2px,transparent 2px 4px),radial-gradient(ellipse at center,transparent 60%,rgba(0,0,0,0.55) 100%)`}}/>;

// Narrator portrait in the bottom-left corner between the intro and the outro (those show the avatar big).
// The frame glows while a voice-over line is playing.
const SHOW=[SCENES.intro[1],SCENES.outro[0]],U=3;
export function Narrator(){
 const f=useCurrentFrame();
 const op=Math.min(interpolate(f,[SHOW[0],SHOW[0]+15],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'}),interpolate(f,[SHOW[1],SHOW[1]+15],[1,0],{extrapolateLeft:'clamp',extrapolateRight:'clamp'}));
 if(op<=0)return null;
 const l=lineAt(f),last=[...LINES].reverse().find(x=>x.from<=f);
 return <div style={{position:'absolute',left:40,bottom:16,width:56*U+28,height:70*U+20,opacity:op,transform:`translateY(${(1-op)*30}px)`}}>
  <Box border={l?C.accent2:C.line} bg={C.bg2} bw={5} style={{inset:0}}>
   <div style={{position:'absolute',left:9,top:10}}><Avatar unit={U} mood={last?.mood} talking={!!l}/></div>
  </Box>
 </div>;
}
