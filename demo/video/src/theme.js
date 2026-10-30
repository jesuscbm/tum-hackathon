import {loadFont as pixel} from '@remotion/google-fonts/PressStart2P';
import {loadFont as mono} from '@remotion/google-fonts/JetBrainsMono';

// Same palette as tui/theme.mjs, plus the backdrop and mascot colours.
export const C={accent:'#a78bfa',accent2:'#38bdf8',ok:'#4ade80',warn:'#facc15',fail:'#f87171',dim:'#6b7280',text:'#e5e7eb',
 bg:'#0b1020',bg2:'#111833',panel:'#141b36',line:'#2a3366',ink:'#1e1b4b',pink:'#f472b6',blue:'#60a5fa',white:'#f8fafc'};

export const PIXEL=pixel('normal',{weights:['400'],subsets:['latin']}).fontFamily;
export const MONO=mono('normal',{weights:['400','700'],subsets:['latin']}).fontFamily;

export const PARTS=[
 {id:'masumi',name:'MASUMI',sub:'agent payments',color:C.accent,icon:'lock'},
 {id:'sokosumi',name:'SOKOSUMI',sub:'agent marketplace',color:C.pink,icon:'shop'},
 {id:'x402',name:'x402',sub:'HTTP payments',color:C.warn,icon:'402'},
 {id:'blockfrost',name:'BLOCKFROST',sub:'Cardano API',color:C.accent2,icon:'flake'},
 {id:'cardano',name:'CARDANO',sub:'preprod chain',color:C.blue,icon:'ada'},
];
