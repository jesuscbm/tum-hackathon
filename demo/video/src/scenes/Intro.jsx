import React from 'react';
import {AbsoluteFill,useCurrentFrame,interpolate} from 'remotion';
import {C,PIXEL} from '../theme.js';
import {LINES,W,H} from '../script.mjs';
import {Icon,Sfx,pop} from '../lib.jsx';
import {Avatar} from '../Avatar.jsx';

const L=LINES[0],U=12;

export function Intro(){
 const f=useCurrentFrame();
 const rise=pop(f,8,{damping:16,stiffness:120}),coin=pop(f,150);
 return <AbsoluteFill>
  <Sfx at={8} name="pop"/><Sfx at={150} name="coin" volume={0.25}/>
  <div style={{position:'absolute',left:(W-56*U)/2,top:H-70*U,transform:`translateY(${(1-rise)*70*U}px)`}}>
   <Avatar unit={U} mood={L.mood} talking={f>=L.from&&f<L.to}/>
  </div>
  <div style={{position:'absolute',left:W/2+330,top:300,transform:`scale(${coin}) translateY(${Math.sin(f/6)*8}px)`,display:'flex',alignItems:'center',gap:14}}>
   <Icon name="coin" unit={9} color="#ca8a04" light="#fde047"/>
   <span style={{fontFamily:PIXEL,fontSize:48,color:C.warn}}>?</span>
  </div>
  <AbsoluteFill style={{background:'#000',opacity:interpolate(f,[0,24],[1,0],{extrapolateRight:'clamp'})}}/>
 </AbsoluteFill>;
}
