import React from 'react';
import {useCurrentFrame,random} from 'remotion';
import {Pixels} from './lib.jsx';
import {ROWS,PALETTE} from './avatar-sprite.mjs';

// The narrator: a pixel portrait (generated from a photo by scripts/avatar.mjs) with hand-drawn glasses, eyes and
// mouth on top, since those are what make it read as a face at 56×70. Coordinates are sprite pixels.
const EYES=[20,34],EYE_Y=28,MOUTH_X=26,MOUTH_Y=41;
const K={rim:'#1f1a24',glint:'#e6fff4',lash:'#2a1c14',pupil:'#1a120d',white:'#efe4d2',lid:'#916248',skin:'#a97450',
 lip:'#9c4f42',lipDark:'#6e2f2a',inner:'#2b0f12',teeth:'#f1e8da',sweat:'#7dd3fc'};
const r=(x,y,w,h,fill,o)=><rect key={`${x},${y},${w},${h},${fill}`} x={x} y={y} width={w} height={h} fill={fill} opacity={o}/>;

// Round wire frames: a lens is an octagon outline (2px corner steps), plus the bridge and the temples.
const lens=(x0,x1,y0,y1)=>[r(x0+2,y0,x1-x0-3,1,K.rim),r(x0+2,y1,x1-x0-3,1,K.rim),r(x0,y0+2,1,y1-y0-3,K.rim),r(x1,y0+2,1,y1-y0-3,K.rim),
 ...[[x0+1,y0+1],[x1-1,y0+1],[x0+1,y1-1],[x1-1,y1-1]].map(([x,y])=>r(x,y,1,1,K.rim)),
 r(x0+2,y0+2,2,1,K.glint,0.55),r(x0+2,y0+3,1,1,K.glint,0.55)];
const GLASSES=[...lens(14,25,24,33),...lens(30,41,24,33),r(26,26,4,1,K.rim),r(9,26,5,1,K.rim),r(42,26,3,1,K.rim)];

function eye(cx,state){
 const y=EYE_Y;
 if(state==='closed')return [r(cx-2,y-1,4,3,K.lid),r(cx-2,y,4,1,K.lash)];
 return [r(cx-2,y-1,4,1,K.lash),r(cx-2,y,4,2,K.white),r(cx-1,y,2,2,K.pupil)];
}

// Mouth shapes: [half width, inner rows, teeth]. `rest` draws nothing, so the photo's own smile shows.
const SHAPES={small:[2,1,0],open:[3,2,1],wide:[4,2,1],o:[1,2,0]};
function mouth(shape){
 const x=MOUTH_X,y=MOUTH_Y,cover=r(x-7,y,15,2,K.skin);
 if(shape==='rest')return [];
 if(shape==='flat')return [cover,r(x-4,y+1,9,1,K.lipDark)];
 const [w,h,teeth]=SHAPES[shape];
 return [cover,r(x-w,y,2*w+1,1,K.lip),r(x-w,y+1,2*w+1,h,K.inner),r(x-w-1,y+1,1,1,K.lipDark),r(x+w+1,y+1,1,1,K.lipDark),
  teeth?r(x-w+1,y+1,2*w-1,1,K.teeth):null,r(x-w+1,y+h+1,2*w-1,1,K.lip)].filter(Boolean);
}
const TALK=['open','small','wide','small','o','open','flat','small','wide','open'];

export function Avatar({unit=6,mood='normal',talking=false,seed=0,style}){
 const f=useCurrentFrame()+seed;
 const blink=f%96<4,wink=mood==='wink'&&f%70>=20&&f%70<34;
 // Pauses every ~25 frames read as word gaps, so the mouth doesn't flap like a metronome.
 const shape=!talking?'rest':random(`p${Math.floor(f/25)}`)<0.18&&f%25>18?'flat':TALK[Math.floor(random(`m${Math.floor(f/3)}`)*TALK.length)];
 const bob=talking?Math.round(Math.sin(f/4)*0.6):0;
 const sweat=(f%30)/30;
 return <div style={{transform:`translateY(${bob*unit}px)`,...style}}>
  <Pixels rows={ROWS} palette={PALETTE} unit={unit}>
   {eye(EYES[0],blink?'closed':'open')}{eye(EYES[1],blink||wink?'closed':'open')}
   {GLASSES}
   {mouth(shape)}
   {mood==='stressed'&&<g opacity={1-sweat}>{r(46,12+sweat*5,1,1,K.sweat)}{r(45,13+sweat*5,3,2,K.sweat)}{r(46,15+sweat*5,1,1,K.sweat)}</g>}
  </Pixels>
 </div>;
}
