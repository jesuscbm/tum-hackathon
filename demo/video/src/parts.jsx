import React from 'react';
import {C,PIXEL,MONO} from './theme.js';
import {Box,Icon,Pixels} from './lib.jsx';

const CHECK=['........','.......#','......##','#....##.','##..##..','.####...','..##....'];

// One integration (Masumi, Sokosumi, ...) as a game item card. `lit` false = greyed out, waiting to be wired.
export function Badge({part,lit=true,checked=false,w=380,h=104,style}){
 const col=lit?part.color:C.dim;
 return <div style={{position:'absolute',width:w,height:h,...style}}>
  <Box border={col} bg={lit?C.panel:'#0e1328'} style={{inset:0}}>
   <div style={{position:'absolute',left:18,top:(h-12-48)/2,opacity:lit?1:0.5}}><Icon name={part.icon} unit={6} color={col}/></div>
   <div style={{position:'absolute',left:86,top:h/2-30,fontFamily:PIXEL,fontSize:22,color:lit?C.white:C.dim}}>{part.name}</div>
   <div style={{position:'absolute',left:86,top:h/2+4,fontFamily:MONO,fontSize:18,color:lit?C.text:C.dim,opacity:0.75}}>{part.sub}</div>
  </Box>
  {checked&&<div style={{position:'absolute',right:-14,top:-14,background:C.ok,padding:6,clipPath:'polygon(4px 0,calc(100% - 4px) 0,100% 4px,100% calc(100% - 4px),calc(100% - 4px) 100%,4px 100%,0 calc(100% - 4px),0 4px)'}}>
   <Pixels rows={CHECK} unit={4} palette={{'#':C.ink}}/>
  </div>}
 </div>;
}
