import React from 'react';
import {AbsoluteFill,useCurrentFrame,OffthreadVideo,staticFile} from 'remotion';
import {C,PIXEL,MONO} from '../theme.js';
import {FPS} from '../script.mjs';
import {Box,pop} from '../lib.jsx';

// 60 s slot for the real screen recording. Without `src` it shows a placeholder in the same style.
// With a file in public/ (e.g. --props='{"demo":"live-demo.mp4"}') it plays that, sound included.
const VW=1536,VH=864;
export function LiveDemo({src}){
 const f=useCurrentFrame(),s=pop(f,0,{damping:18});
 const sec=Math.floor(f/FPS),tc=`0:${String(sec).padStart(2,'0')} / 1:00`;
 return <AbsoluteFill>
  <div style={{position:'absolute',left:300,top:58,width:VW+12,height:VH+44+12,transform:`scale(${0.96+0.04*s})`}}>
   <Box border="#374151" bg="#070b16" style={{inset:0}}>
    <div style={{height:44,background:'#1f2937',display:'flex',alignItems:'center',paddingLeft:20,gap:12}}>
     {[C.fail,C.warn,C.ok].map(c=><div key={c} style={{width:14,height:14,background:c}}/>)}
     <div style={{flex:1,textAlign:'center',fontFamily:MONO,fontSize:18,color:C.dim,marginRight:80}}>lokAl · live demo · Cardano preprod</div>
    </div>
    <div style={{position:'absolute',left:0,top:44,width:VW,height:VH}}>
     {src?<OffthreadVideo src={staticFile(src)} style={{width:'100%',height:'100%',objectFit:'contain'}}/>:<>
      <div style={{position:'absolute',left:28,top:24,fontFamily:PIXEL,fontSize:20,color:C.fail,opacity:f%30<18?1:0.25}}>● REC</div>
      <div style={{position:'absolute',top:300,width:'100%',textAlign:'center',fontFamily:PIXEL,fontSize:64,color:C.accent}}>LIVE DEMO</div>
      <div style={{position:'absolute',top:410,width:'100%',textAlign:'center',fontFamily:MONO,fontSize:26,color:C.text}}>60 s screen recording goes here</div>
      <div style={{position:'absolute',top:460,width:'100%',textAlign:'center',fontFamily:MONO,fontSize:20,color:C.dim}}>public/live-demo.mp4 · npm run render -- --props='{'{'}"demo":"live-demo.mp4"{'}'}'</div>
      <div style={{position:'absolute',right:28,bottom:22,fontFamily:MONO,fontSize:20,color:C.dim}}>{tc}</div>
      <div style={{position:'absolute',left:0,bottom:0,height:6,width:`${f/(60*FPS)*100}%`,background:C.accent}}/>
     </>}
    </div>
   </Box>
  </div>
 </AbsoluteFill>;
}
