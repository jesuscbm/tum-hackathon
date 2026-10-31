import React from 'react';
import {AbsoluteFill,useCurrentFrame,interpolate} from 'remotion';
import {C,PIXEL,MONO} from '../theme.js';
import {LINES,W,H,lineAt} from '../script.mjs';
import {Box,Icon,Sfx,pop} from '../lib.jsx';
import {Avatar} from '../Avatar.jsx';

const U=12;
// Who uses lokAl, one card per voice-over line: the sellers (people like the narrator) and the buyers.
const SIDES=[
 {x:W-50-540,at:70,color:C.ok,title:'WHO SELLS',icons:[['laptop','laptop'],['tower','gaming PC'],['server','server']],
  text:'anyone whose machine can run an open AI model',goal:'→ wants to get paid for it'},
 {x:50,at:190,color:C.pink,title:'WHO BUYS',icons:[['shop','teams'],['chip','AI agents'],['doc','invoices']],
  text:'teams and agents on Sokosumi that need small AI jobs done',goal:'→ pay only for good results'},
];

function Side({s,f}){
 const p=pop(f,s.at,{damping:14});
 return <div style={{position:'absolute',left:s.x,top:190,width:540,height:470,transform:`scale(${p})`,opacity:p}}>
  <Box border={s.color} bg={C.panel} style={{inset:0}}>
   <div style={{position:'absolute',left:30,top:30,fontFamily:PIXEL,fontSize:24,color:s.color}}>{s.title}</div>
   <div style={{position:'absolute',left:30,right:30,top:90,display:'flex',justifyContent:'space-between'}}>
    {s.icons.map(([icon,label],i)=>{const q=pop(f,s.at+10+i*6);
     return <div key={icon} style={{width:140,display:'flex',flexDirection:'column',alignItems:'center',gap:12,transform:`scale(${q})`}}>
      <Icon name={icon} unit={9} color={s.color}/>
      <span style={{fontFamily:MONO,fontSize:19,color:C.text}}>{label}</span>
     </div>})}
   </div>
   <div style={{position:'absolute',left:30,right:30,top:250,fontFamily:MONO,fontSize:26,lineHeight:1.4,color:C.white}}>{s.text}</div>
   <div style={{position:'absolute',left:30,right:30,top:380,fontFamily:PIXEL,fontSize:18,lineHeight:1.5,color:C.warn,opacity:f>=s.at+30?1:0}}>{s.goal}</div>
  </Box>
 </div>;
}

export function Intro(){
 const f=useCurrentFrame();
 const rise=pop(f,8,{damping:16,stiffness:120}),l=lineAt(f),last=[...LINES].reverse().find(x=>x.from<=f);
 return <AbsoluteFill>
  <Sfx at={8} name="pop"/>
  {SIDES.map(s=><React.Fragment key={s.title}><Sfx at={s.at} name="pop" volume={0.3}/><Sfx at={s.at+30} name="blip" volume={0.15}/></React.Fragment>)}
  <div style={{position:'absolute',left:(W-56*U)/2,top:H-70*U,transform:`translateY(${(1-rise)*70*U}px)`}}>
   <Avatar unit={U} mood={last?.mood??'happy'} talking={!!l}/>
  </div>
  {SIDES.map(s=><Side key={s.title} s={s} f={f}/>)}
  <AbsoluteFill style={{background:'#000',opacity:interpolate(f,[0,24],[1,0],{extrapolateRight:'clamp'})}}/>
 </AbsoluteFill>;
}
