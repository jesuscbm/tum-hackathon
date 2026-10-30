import {Box,Text} from 'ink';
import {html} from './html.mjs';
import {C} from './theme.mjs';
// Dashboard pieces: a small map of how lokAl's parts connect (a light per part: green = fine, red = broken,
// grey = not enabled; a link pulses while traffic passes) and machine load.
const light=(st,blink)=>st==='fail'?(blink?C.fail:'#7f1d1d'):st==='warn'?C.warn:st==='ok'?C.ok:C.card;
const W=12,E=6; // cell widths: node, link
function Part({id,label,st,blink}){
 return html`<${Box} width=${W} flexShrink=${0}><${Text}><${Text} color=${light(st[id],blink)}>● </${Text}><${Text} color=${st[id]==='off'?C.dim:C.text}>${label}</${Text}></${Text}></${Box}>`;
}
function Link({id,to,dir='▶',active,st,tick}){
 const len=E-2,on=active[id],bad=st[to]==='fail';
 let line=on?Array.from({length:len},(_,i)=>i===tick%len?'•':'─').join(''):'─'.repeat(len);
 if(dir==='◀')line=[...line].reverse().join('');
 return html`<${Box} width=${E} flexShrink=${0}><${Text} color=${bad?C.fail:on?C.accent2:C.card}>${dir==='◀'?'◀'+line:line+'▶'} </${Text}></${Box}>`;
}
export function Flow({health,active,tick}){
 const st=Object.fromEntries(health.map(h=>[h.id,h.status]));const blink=tick%4<2;
 const p=(id,label)=>html`<${Part} id=${id} label=${label} st=${st} blink=${blink}/>`;
 const l=(id,to,dir)=>html`<${Link} id=${id} to=${to} dir=${dir} active=${active} st=${st} tick=${tick}/>`;
 const bad=health.find(h=>h.status==='fail');
 return html`<${Box} flexDirection="column">
  <${Box}>${p('sokosumi','Sokosumi')}${l('tasks','worker')}${p('worker','Worker')}${l('ask','agent')}${p('agent','Agent')}${l('infer','model')}${p('model','Model')}</${Box}>
  <${Box}><${Box} width=${W+E}/><${Text} color=${st.mps==='fail'?C.fail:active.escrow?C.accent2:C.card}>│</${Text}><${Box} width=${W+E-1}/><${Text} color=${st.agent==='fail'?C.fail:active.pay?C.accent2:C.card}>▲</${Text}></${Box}>
  <${Box}><${Box} width=${W+E}/><${Text} color=${st.mps==='fail'?C.fail:active.escrow?C.accent2:C.card}>▼</${Text}><${Box} width=${W+E-1}/><${Text} color=${st.agent==='fail'?C.fail:active.pay?C.accent2:C.card}>│</${Text}></${Box}>
  <${Box}>${p('wallet','Wallet')}${l('chain','wallet','◀')}${p('mps','Payments')}${l('lock','mps','◀')}${p('api','Agent API')}${l('hire','api','◀')}${p('registry','Registry')}</${Box}>
  <${Box} marginTop=${1}>${bad?html`<${Text} color=${C.fail} wrap="truncate-end">✖ ${bad.fix}</${Text}>`:html`<${Text} color=${C.dim}>all running</${Text}>`}</${Box}>
 </${Box}>`;
}
const SPARK='▁▂▃▄▅▆▇█';
export const spark=(xs,n=24)=>xs.slice(-n).map(v=>v==null?' ':SPARK[Math.min(7,Math.max(0,Math.round(v/100*7)))]).join('');
export function Meter({label,pct,text,width=18}){
 const n=Math.max(0,Math.min(width,Math.round((pct??0)/100*width)));
 const color=pct>90?C.fail:pct>70?C.warn:C.ok;
 return html`<${Text}><${Text} color=${C.dim}>${label.padEnd(5)}</${Text}><${Text} color=${color}>${'█'.repeat(n)}</${Text}><${Text} color=${C.card}>${'░'.repeat(width-n)}</${Text}> <${Text} color=${C.text}>${text}</${Text}></${Text}>`;
}
const fmtMem=mb=>mb>=1024?`${(mb/1024).toFixed(1)}G`:`${mb}M`;
export function Resources({res,hist}){
 if(!res)return html`<${Text} color=${C.dim}>measuring…</${Text}>`;
 const procs=Object.entries(res.procs??{});
 return html`<${Box} flexDirection="column">
  <${Text}><${Text} color=${C.dim}>CPU  </${Text}><${Text} color=${C.accent2}>${spark(hist.cpu)}</${Text}> <${Text} color=${C.text}>${res.cpu.pct==null?'…':Math.round(res.cpu.pct)+'%'}</${Text}><${Text} color=${C.dim}> of ${res.cpu.cores} cores</${Text}></${Text}>
  <${Meter} label="RAM" pct=${res.ram.pct} text=${`${res.ram.usedGB}/${res.ram.totalGB} GB`}/>
  ${res.gpu?html`<${Meter} label="GPU" pct=${res.gpu.pct} text=${`${Math.round(res.gpu.pct)}% · ${res.gpu.tempC}°C`}/>`:null}
  ${res.gpu?html`<${Meter} label="VRAM" pct=${res.gpu.vramPct} text=${`${res.gpu.vramUsedGB}/${res.gpu.vramGB} GB`}/>`:html`<${Text} color=${C.dim}>GPU  none detected (CPU inference)</${Text}>`}
  <${Text} color=${C.dim} wrap="truncate-end">${procs.length?procs.map(([k,v])=>`${k} ${Math.round(v.cpu)}% ${fmtMem(v.memMB)}`).join(' · '):'no lokAl processes running'}</${Text}>
 </${Box}>`;
}
