import {useState,useEffect} from 'react';
import {Box,Text,useInput} from 'ink';
import {html} from './html.mjs';
import {C,ICON,COLOR} from './theme.mjs';
const FRAMES=['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏'];
export function Spinner({color=C.accent2}){
 const [i,set]=useState(0);useEffect(()=>{const t=setInterval(()=>set(x=>(x+1)%FRAMES.length),80);return ()=>clearInterval(t)},[]);
 return html`<${Text} color=${color}>${FRAMES[i]}</${Text}>`;
}
export function StatusIcon({status}){
 if(status==='running')return html`<${Spinner}/>`;
 return html`<${Text} color=${COLOR[status]??C.dim}>${ICON[status]??'○'}</${Text}>`;
}
export function ProgressBar({pct=0,width=36,label}){
 const n=Math.max(0,Math.min(width,Math.round(pct*width)));
 return html`<${Box} flexDirection="column">
  ${label?html`<${Text} color=${C.dim}>${label}</${Text}>`:null}
  <${Text}><${Text} color=${C.accent}>${'█'.repeat(n)}</${Text}><${Text} color=${C.card}>${'░'.repeat(width-n)}</${Text}> <${Text} color=${C.text}>${Math.round(pct*100)}%</${Text}></${Text}>
 </${Box}>`;
}
export function Badge({pass}){
 return pass?html`<${Text} backgroundColor=${C.ok} color="black" bold> ✔ CHECK PASSED </${Text}>`:html`<${Text} backgroundColor=${C.fail} color="black" bold> ✖ CHECK FAILED </${Text}>`;
}
export function Key({k,label}){return html`<${Text}><${Text} color=${C.accent} bold>${k}</${Text}><${Text} color=${C.dim}> ${label}   </${Text}></${Text}>`;}
export function Card({title,children,color=C.card,width,flexGrow}){
 return html`<${Box} borderStyle="round" borderColor=${color} flexDirection="column" paddingX=${1} width=${width} flexGrow=${flexGrow}>
  ${title?html`<${Text} color=${C.accent} bold>${title}</${Text}>`:null}
  ${children}
 </${Box}>`;
}
// Single-line text input. Secret values are masked.
export function TextInput({label,secret,onSubmit,onCancel}){
 const [v,set]=useState('');
 useInput((input,key)=>{
  if(key.return){if(v.trim())onSubmit(v.trim());return}
  if(key.escape){onCancel?.();return}
  if(key.backspace||key.delete){set(x=>x.slice(0,-1));return}
  if(input&&!key.ctrl&&!key.meta)set(x=>x+input.replace(/[\r\n]/g,''));
 });
 const shown=secret?'•'.repeat(v.length):v;
 return html`<${Box} flexDirection="column" marginTop=${1}>
  <${Text} color=${C.warn}>${label}</${Text}>
  <${Box} borderStyle="round" borderColor=${C.accent} paddingX=${1}><${Text}>${shown}<${Text} color=${C.accent}>▌</${Text}></${Text}></${Box}>
  <${Text} color=${C.dim}>enter to save · esc to cancel</${Text}>
 </${Box}>`;
}
