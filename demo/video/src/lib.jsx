import React,{createContext,useContext} from 'react';
import {Html5Audio,Sequence,spring,staticFile,interpolate} from 'remotion';
import {C,PIXEL} from './theme.js';
import {FPS} from './script.mjs';

// Pixel sprite from strings: one char per pixel, '.' is transparent, everything else is looked up in `palette`.
// Runs of the same colour become one rect, so a 22×20 head is ~60 rects instead of 440.
export function Pixels({rows,palette,unit=8,style,children}){
 const w=Math.max(...rows.map(r=>r.length)),h=rows.length,rects=[];
 rows.forEach((r,y)=>{for(let x=0;x<r.length;){const ch=r[x];let e=x+1;while(e<r.length&&r[e]===ch)e++;
  if(ch!=='.'&&palette[ch])rects.push(<rect key={x+'.'+y} x={x} y={y} width={e-x} height={1.02} fill={palette[ch]}/>);x=e}});
 return <svg width={w*unit} height={h*unit} viewBox={`0 0 ${w} ${h}`} shapeRendering="crispEdges" style={{display:'block',overflow:'visible',...style}}>{rects}{children}</svg>;
}

const ICONS={
 lock:['..####..','.#....#.','.#....#.','########','#++++++#','#+++#++#','#++++++#','########'],
 shop:['########','#+#+#+#+','########','.#....#.','.#.##.#.','.#.##.#.','.#.##.#.','.######.'],
 flake:['...#....','.#.#.#..','..###...','#######.','..###...','.#.#.#..','...#....','........'],
 ada:['...##...','.#....#.','#..##..#','..#..#..','..#..#..','#..##..#','.#....#.','...##...'],
 check:['........','.......#','......##','#....##.','##..##..','.####...','..##....','........'],
 cross:['#......#','##....##','.##..##.','..####..','..####..','.##..##.','##....##','#......#'],
 coin:['..####..','.#++++#.','#++#+++#','#++#+++#','#++#+++#','#++#+++#','.#++++#.','..####..'],
 doc:['#####...','#+++##..','#+++++#.','#+###+#.','#+++++#.','#+###+#.','#+++++#.','#######.'],
 chip:['.#.##.#.','########','.#++++#.','##+##+##','##+##+##','.#++++#.','########','.#.##.#.'],
 wallet:['........','.######.','#++++++#','#+++++##','#++++#+#','#+++++##','#++++++#','.######.'],
};

export function Icon({name,unit=6,color=C.text,light}){
 if(name==='402')return <div style={{fontFamily:PIXEL,fontSize:unit*3.6,color,width:unit*8,height:unit*8,display:'flex',alignItems:'center',justifyContent:'center',letterSpacing:-unit*0.6}}>402</div>;
 return <Pixels rows={ICONS[name]} unit={unit} palette={{'#':color,'+':light??color+'55'}}/>;
}

// Notched-corner box: the cheapest way to make a div look like an 8-bit window.
const notch=c=>`polygon(${c}px 0,calc(100% - ${c}px) 0,calc(100% - ${c}px) ${c}px,100% ${c}px,100% calc(100% - ${c}px),calc(100% - ${c}px) calc(100% - ${c}px),calc(100% - ${c}px) 100%,${c}px 100%,${c}px calc(100% - ${c}px),0 calc(100% - ${c}px),0 ${c}px,${c}px ${c}px)`;
// `auto` sizes the box to its content (chips, stamps); otherwise place it with style (left/top/width/height or inset).
export function Box({border=C.text,bg=C.panel,bw=6,auto,style,inner,children}){
 return <div style={{position:auto?'relative':'absolute',display:auto?'inline-block':undefined,padding:auto?bw:undefined,background:border,clipPath:notch(bw),...style}}>
  <div style={{position:auto?'relative':'absolute',inset:auto?undefined:bw,background:bg,clipPath:notch(bw),...inner}}>{children}</div>
 </div>;
}

// The product name as shown on screen: lokAl, with the "Al" highlighted so it also reads as lok-AI.
export const Brand=({ai=C.accent2})=><>lok<span style={{color:ai}}>Al</span></>;

export const pop=(f,at,o={})=>spring({frame:f-at,fps:FPS,config:{damping:11,stiffness:180,...o}});
export const fade=(f,a,b)=>interpolate(f,[a,b],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});
export const typed=(text,f,a,b)=>text.slice(0,Math.round(interpolate(f,[a,b],[0,text.length],{extrapolateLeft:'clamp',extrapolateRight:'clamp'})));

export const SfxOn=createContext(true);
export function Sfx({at,name,volume=0.35}){
 if(!useContext(SfxOn))return null;
 return <Sequence from={at} durationInFrames={75} layout="none"><Html5Audio src={staticFile(`sfx/${name}.wav`)} volume={volume}/></Sequence>;
}
