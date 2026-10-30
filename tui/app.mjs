import {useState,useEffect,useRef,useCallback} from 'react';
import {Box,Text,useInput,useApp,useStdin,useStdout,render} from 'ink';
import {spawn,spawnSync} from 'node:child_process';
import {writeFileSync,readFileSync,mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import QRCode from 'qrcode';
import {html} from './html.mjs';
import {C,COLOR,link,short} from './theme.mjs';
import {StatusIcon,ProgressBar,Badge,Key,Card,TextInput,Spinner} from './components.mjs';
import {Flow,Resources} from './vitals.mjs';
import {CHECK_TYPES} from '../checks/index.mjs';
import {loadTemplate,orderedSamples} from '../templates/index.mjs';
import {infoLines} from '../core/info.mjs';

const VIEWS={w:'wizard',d:'dashboard',c:'coworkers',i:'info',l:'logs'};

function Header({statuses,view,core,net,daemon}){
 const done=statuses.filter(s=>s?.status==='ok').length;
 return html`<${Box} justifyContent="space-between" paddingX=${1}>
  <${Text}><${Text} color=${C.accent} bold>◆ lokAl</${Text}><${Text} color=${C.dim}>  your LLM, hired and paid on Cardano</${Text}>${core.mock?html`<${Text} color=${C.warn}>  [mock]</${Text}>`:null}${core.headless?html`<${Text} color=${C.dim}>  [ssh]</${Text}>`:null}</${Text}>
  <${Text}>
   <${Text} color=${net==='mainnet'?C.fail:C.accent2} bold=${net==='mainnet'}>${net==='mainnet'?' MAINNET ':'preprod'}</${Text}>
   <${Text} color=${daemon?.running?C.ok:C.dim}>  ● lokald${daemon?.running?'':' off'}</${Text}>
   <${Text} color=${C.dim}>  ${view==='wizard'?`setup ${done}/5`:view}</${Text}>
  </${Text}>
 </${Box}>`;
}
function Tabs({view}){
 return html`<${Box} paddingX=${1}>${Object.entries(VIEWS).map(([k,v])=>html`<${Text} key=${k}><${Text} color=${v===view?C.accent:C.dim} bold=${v===view}>${k} ${v}</${Text}><${Text} color=${C.card}>  │  </${Text}></${Text}>`)}<${Text} color=${C.dim}>q quit</${Text}></${Box}>`;
}
function Rail({steps,statuses,sel}){
 return html`<${Box} flexDirection="column" width=${31} flexShrink=${0} paddingX=${1} borderStyle="round" borderColor=${C.card}>
  ${steps.map((s,i)=>{const st=statuses[i]?.status??'todo';const active=i===sel;
   return html`<${Box} key=${s.id}>
    <${Text} color=${active?C.accent:C.dim}>${active?'▶ ':'  '}</${Text}>
    <${StatusIcon} status=${st}/>
    <${Text} color=${active?C.text:st==='ok'?C.ok:C.dim} bold=${active}> ${i+1}. ${s.title}</${Text}>
   </${Box}>`;})}
 </${Box}>`;
}
function Items({items=[]}){
 return html`<${Box} flexDirection="column" marginTop=${1}>
  ${items.map(i=>html`<${Box} key=${i.label}>
   <${Box} width=${3} flexShrink=${0}><${StatusIcon} status=${i.status}/></${Box}>
   <${Box} width=${22} flexShrink=${0}><${Text} color=${C.text}>${i.label}</${Text}></${Box}>
   <${Box} flexShrink=${1}><${Text} color=${i.status==='ok'||COLOR[i.status]===C.dim?C.dim:COLOR[i.status]} wrap="truncate-end">${i.detail}</${Text}></${Box}>
  </${Box}>`)}
 </${Box}>`;
}
function Hints({keys}){return html`<${Box} marginTop=${1} flexWrap="wrap">${keys.map(([k,l])=>html`<${Key} key=${k} k=${k} label=${l}/>`)}</${Box}>`;}

// ---------- step panels ----------
function MachinePanel({s}){
 const rec=s.recommendation;
 return html`<${Box} flexDirection="column">
  <${Text} color=${C.dim}>A local model (lokAl installs Ollama, no sudo), any Ollama model, or any OpenAI-compatible API.</${Text}>
  <${Items} items=${s.items}/>
  ${s.backend==='ollama'&&rec?html`<${Box} marginTop=${1} flexDirection="column">
   <${Text} color=${C.dim}>Models (m to switch; b for any other model or an API):</${Text}>
   ${rec.options.map(o=>html`<${Text} key=${o.id} color=${o.id===s.model?C.accent:o.fits?C.text:C.dim} wrap="truncate-end">${o.id===s.model?' ● ':' ○ '}${o.name.padEnd(14)} ${String(o.sizeGB).padStart(4)} GB  ${o.fits?`${o.gpu?'GPU · ':''}${o.note}`:'too big for this machine'}</${Text}>`)}
  </${Box}>`:null}
  <${Hints} keys=${[['enter',s.status==='ok'?'re-run checks':'set it all up'],...(s.backend==='ollama'?[['m','next model']]:[]),['b','model source: local / tag / API / llama.cpp']]}/>
 </${Box}>`;
}
function JobPanel({s,ui}){
 const ts=s.templates??[];const n=ts.length+1;const t=ts[ui.tpl%n];
 const custom=ui.tpl%n===ts.length;
 const sample=t?.samples?.[ui.sample%Math.max(t.samples.length,1)];
 return html`<${Box} flexDirection="column">
  <${Text} color=${C.dim}>A job = a system prompt + a check. lokAl only asks to be paid when the check passes.</${Text}>
  <${Box} marginTop=${1} flexWrap="wrap">
   ${ts.map((x,i)=>html`<${Box} key=${x.id} borderStyle="round" borderColor=${i===ui.tpl%n?C.accent:C.card} paddingX=${1} marginRight=${1}>
    <${Text} color=${x.id===s.active?C.ok:C.text}>${x.id===s.active?'✔ ':''}${x.name}${x.custom?' ✎':''}</${Text}></${Box}>`)}
   <${Box} borderStyle="round" borderColor=${custom?C.accent:C.card} paddingX=${1}><${Text}>+ Your prompt</${Text}></${Box}>
  </${Box}>
  ${custom?html`<${Box} flexDirection="column"><${Text} color=${C.dim}>enter: write a prompt in $EDITOR · f: import a Markdown file (.md with front matter: name, check, price)</${Text}>
   <${Text} color=${C.dim}>Tip: .md files in ~/.local/share/lokal/templates/ show up here as jobs.</${Text}></${Box}>`:t?html`<${Box} flexDirection="column">
   <${Text} color=${C.dim} wrap="wrap">${t.description||'(no description)'}</${Text}>
   <${Text} color=${C.dim} wrap="truncate-end">prompt: <${Text} color=${C.text}>${t.preview}</${Text}></${Text}>
   <${Text}>check: <${Text} color=${t.check?.type==='none'?C.warn:C.ok}>${t.check?.type}</${Text}>${t.price?html`<${Text} color=${C.dim}>   price: ${t.price.display}</${Text}>`:null}</${Text}>
   ${sample?html`<${Text}>sample input (s for the next of ${t.samples.length}): <${Text} color=${C.accent2}>${sample.name}</${Text}> <${Text} color=${C.dim}>should ${sample.expect} the check</${Text}></${Text}>`:html`<${Text} color=${C.dim}>no sample inputs: t asks you for one</${Text}>`}
  </${Box}>`:null}
  ${ui.mode==='pickCheck'?html`<${Box} marginTop=${1} flexDirection="column"><${Text} color=${C.warn}>Pick a check for your prompt (←/→, enter):</${Text}>
   <${Box}>${CHECK_TYPES.map((c,i)=>html`<${Text} key=${c.type} color=${i===ui.check%CHECK_TYPES.length?C.accent:C.dim}> ${i===ui.check%CHECK_TYPES.length?'●':'○'} ${c.label} </${Text}>`)}</${Box}>
   <${Text} color=${C.dim}>${CHECK_TYPES[ui.check%CHECK_TYPES.length].description}</${Text}></${Box}>`:null}
  ${ui.tryState?html`<${Card} title=${ui.tryState.done?`Model answer · ${ui.tryState.seconds}s`:'Model is answering…'}>
   <${Text} color=${C.dim} wrap="truncate-end">in: ${String(ui.tryState.input??'').replace(/\s+/g,' ').slice(0,200)}</${Text}>
   <${Text} color=${C.text} wrap="truncate-end">${(ui.tryState.text||'').replace(/\s+/g,' ').slice(-600)}</${Text}>
   ${ui.tryState.done?html`<${Box} marginTop=${1}><${Badge} pass=${ui.tryState.check.pass}/><${Text} color=${C.dim}> ${ui.tryState.check.reasons.slice(0,2).join('; ')}</${Text}></${Box}>`:html`<${Spinner}/>`}
  </${Card}>`:null}
  <${Items} items=${s.items}/>
  <${Hints} keys=${[['←/→','template'],['enter',custom?'write prompt':'use this job'],...(custom?[['f','import .md file']]:[...(t?.samples?.length?[['s','next sample'],['t','try sample']]:[['t','try it']]),['y','try your own input']])]}/>
 </${Box}>`;
}
function SokosumiPanel({s}){
 const signedOut=s.items?.find(i=>i.label==='Account'&&i.status!=='ok');
 return html`<${Box} flexDirection="column">
  <${Text} color=${C.dim}>Sokosumi is the marketplace where buyers hire your agent. lokAl reuses what you already have.</${Text}>
  <${Items} items=${s.items}/>
  ${signedOut&&!s.headless?html`<${Box} marginTop=${1}><${Text} color=${C.warn}>One human step: press enter and sign in in the browser window that opens.</${Text}></${Box}>`:null}
  ${signedOut&&s.headless?html`<${Box} marginTop=${1} flexDirection="column">
   <${Text} color=${C.warn}>No browser here. Either:</${Text}>
   <${Text}>  <${Text} color=${C.accent} bold>enter</${Text}>  paste an API key from <${Text} color=${C.accent2}>${link('https://preprod.sokosumi.com/connections')}</${Text}> (open it on your laptop)</${Text}>
   <${Text}>  <${Text} color=${C.accent} bold>b</${Text}>      get a sign-in link to open on your laptop (needs an SSH tunnel)</${Text}>
  </${Box}>`:null}
  ${signedOut&&s.signIn?html`<${Card} title="Sign in from your laptop" color=${C.accent}>
   <${Text}>1. In a terminal on your laptop: <${Text} color=${C.accent2}>${s.signIn.tunnel}</${Text}></${Text}>
   <${Text}>2. Click or copy this link (it opens on your laptop):</${Text}>
   <${Text} color=${C.accent2} wrap="wrap">${link(s.signIn.url)}</${Text}>
   <${Text} color=${C.dim} wrap="wrap">Also in ~/.local/share/lokal/logs/lokal.log, or run \`lokal sokosumi --preprod auth login\` for it on one line. lokAl notices the sign-in on its own.</${Text}>
  </${Card}>`:null}
  <${Hints} keys=${[['enter',s.status==='ok'?'re-check':signedOut&&s.headless?'paste API key':'connect'],...(signedOut&&s.headless?[['b','sign-in link']]:[]),...(s.organizations?.length?[['o','use organization Workspace'],['p','personal']]:[])]}/>
 </${Box}>`;
}
function PayPanel({s,ui,qr}){
 const w=s.wallet;const need=s.items?.find(i=>i.status==='input');
 const reg=s.items?.find(i=>i.label==='Registry');const main=s.network==='mainnet';
 return html`<${Box} flexDirection="column">
  <${Text} color=${C.dim}>Your own Masumi payment service and selling wallet. Buyers pay into escrow on Cardano ${main?'MAINNET':'preprod'}.</${Text}>
  <${Items} items=${s.items}/>
  ${reg?.tx&&s.txUrl?html`<${Text} color=${C.dim}>registration tx: <${Text} color=${C.accent2}>${link(s.txUrl,short(reg.tx))}</${Text}></${Text}>`:null}
  ${w?.address&&ui.qr&&qr?html`<${Box} marginTop=${1}><${Text}>${qr}</${Text}><${Box} flexDirection="column" marginLeft=${2}><${Text} color=${C.text}>Selling wallet</${Text}><${Text} color=${C.dim} wrap="wrap">${w.address}</${Text}>${w.faucet?html`<${Text} color=${C.accent2}>${link(w.faucet,'Get test ADA → '+w.faucet)}</${Text}>`:html`<${Text} color=${C.warn}>Send ADA here to pay for registration and fees.</${Text}>`}</${Box}></${Box}>`:null}
  <${Hints} keys=${[...(need?[['enter',`enter ${need.label.toLowerCase()}`]]:[['enter','continue setup']]),['n',main?'back to preprod':'mainnet'],...(w?.address?[...(w.faucet?[['f','faucet']]:[]),['v','wallet QR code']]:[])]}/>
 </${Box}>`;
}
function LivePanel({s}){
 return html`<${Box} flexDirection="column">
  <${Text} color=${C.dim}>lokald (the background service) keeps the agent, worker and agent API running and restarts them if they crash.</${Text}>
  <${Text} color=${C.dim}>Quit this screen or drop the SSH session any time: type lokal to come back.</${Text}>
  <${Items} items=${s.items}/>
  <${Hints} keys=${[['enter','start services'],['t','send yourself a test job'],['d','dashboard']]}/>
 </${Box}>`;
}

// ---------- dashboard ----------
function Dashboard({jobs,earn,health,sel,res,hist,active,tick,rows,net}){
 const j=jobs[sel];
 return html`<${Box} flexDirection="column">
  <${Box}>
   <${Card} title=${`Health · ${net}`} width=${74}><${Flow} health=${health} active=${active} tick=${tick}/></${Card}>
   <${Card} title="Earned" flexGrow=${1}>
    <${Text} color=${C.ok} bold>${earn.usdm} USDM</${Text}><${Text} color=${C.dim}>${earn.paidJobs} paid of ${earn.jobs} jobs</${Text}>
    <${Text}> </${Text}><${Text} color=${C.dim}>check pass rate <${Text} color=${C.accent2} bold>${earn.passRate==null?'—':Math.round(earn.passRate*100)+'%'}</${Text}></${Text}><${Text} color=${C.dim}>failed = not charged</${Text}>
   </${Card}>
  </${Box}>
  <${Card} title="Machine"><${Resources} res=${res} hist=${hist}/></${Card}>
  <${Box}>
   <${Card} title="Jobs" width=${44}>
    ${jobs.length?jobs.slice(0,rows).map((x,i)=>html`<${Box} key=${x.id}><${Text} color=${i===sel?C.accent:C.dim}>${i===sel?'▶ ':'  '}</${Text}><${StatusIcon} status=${x.status==='paid'||x.status==='completed'||x.status==='result on-chain'?'ok':x.status==='withheld'?'fail':'running'}/><${Text} color=${i===sel?C.text:C.dim} wrap="truncate-end"> ${x.id.slice(0,8)} ${(x.status??'').slice(0,15).padEnd(15)} ${x.source==='api'?'api ':x.paid?'paid':'free'}${x.coworker!=='main'?` ${x.coworker}`:''}</${Text}></${Box}>`):html`<${Text} color=${C.dim}>No jobs yet. Press t to send yourself one.</${Text}>`}
   </${Card}>
   ${j?html`<${Card} title=${`Job ${j.id.slice(0,8)}${j.coworker!=='main'?` · ${j.coworker}`:''}`} flexGrow=${1}>
    <${Text}>status: <${Text} color=${j.status==='withheld'?C.fail:j.status==='paid'?C.ok:C.accent2}>${j.status}</${Text}>${j.onChainState?html`<${Text} color=${C.dim}>  on-chain: ${j.onChainState}</${Text}>`:null}</${Text}>
    ${j.check?html`<${Box}><${Badge} pass=${j.check.pass}/><${Text} color=${C.dim} wrap="truncate-end"> ${j.check.pass?'':(j.check.reasons??[]).slice(0,1).join('')}</${Text}></${Box}>`:null}
    ${j.status==='withheld'?html`<${Text} color=${C.warn}>Result withheld: the buyer is not charged and can reclaim the escrow.</${Text}>`:null}
    ${j.model?html`<${Text} color=${C.dim}>model: <${Text} color=${C.text}>${j.model}</${Text}>  weights: ${j.digest?short(j.digest,14):'unverified'}</${Text}>`:null}
    ${j.resultHash?html`<${Text} color=${C.dim}>result hash: ${short(j.resultHash,12)}</${Text}>`:null}
    ${(j.txs??[]).map(t=>html`<${Text} key=${t.hash+t.label} color=${C.dim}>${t.label.padEnd(16)} <${Text} color=${C.accent2}>${link(t.url,short(t.hash))}</${Text}></${Text}>`)}
    ${j.input?html`<${Text} color=${C.dim} wrap="truncate-end">in:  ${String(j.input).replace(/\s+/g,' ').slice(0,200)}</${Text}>`:null}
    ${j.output?html`<${Text} color=${C.text} wrap="truncate-end">out: ${String(j.output).replace(/\s+/g,' ').slice(0,200)}</${Text}>`:null}
   </${Card}>`:null}
  </${Box}>
  <${Hints} keys=${[['↑/↓','job'],['t','test job'],['r','restart services'],['x','stop services']]}/>
 </${Box}>`;
}

function CoworkersView({cws,sel,svcs}){
 const dot=id=>{const s=svcs.find(x=>x.id===id);return html`<${Text} color=${s?.status==='running'?C.ok:s?.status==='failed'?C.fail:C.card}>●</${Text}>`;};
 const sid=(k,c)=>c.primary?k:`${k}@${c.id}`;
 return html`<${Card} title="Coworkers: one prompt each, side by side" flexGrow=${1}>
  <${Text} color=${C.dim}>Each Coworker is its own agent on Sokosumi with its own job. They share the model, the payment service and the wallet.</${Text}>
  <${Box} marginTop=${1} flexDirection="column">
   ${cws.map((c,i)=>html`<${Box} key=${c.id}>
    <${Text} color=${i===sel?C.accent:C.dim}>${i===sel?'▶ ':'  '}</${Text}>
    <${Box} width=${18} flexShrink=${0}><${Text} color=${i===sel?C.text:C.dim} bold=${i===sel}>${c.name}${c.primary?' (main)':''}</${Text}></${Box}>
    <${Box} width=${20} flexShrink=${0}><${Text} color=${C.dim} wrap="truncate-end">${c.template??'no job'}</${Text}></${Box}>
    <${Box} width=${16} flexShrink=${0}><${Text} color=${c.coworkerId?C.dim:C.warn} wrap="truncate-end">${c.coworkerId?c.coworkerId.slice(0,13):'not registered'}</${Text}></${Box}>
    <${Box} width=${8} flexShrink=${0}><${Text} color=${c.paid?C.ok:C.dim}>${c.paid?'paid':'free'}</${Text}></${Box}>
    <${Text}>${dot(sid('agent',c))}<${Text} color=${C.dim}> agent  </${Text}>${dot(sid('worker',c))}<${Text} color=${C.dim}> worker  </${Text}>${c.paid?html`${dot(sid('api',c))}<${Text} color=${C.dim}> api</${Text}>`:null}</${Text}>
   </${Box}>`)}
  </${Box}>
  <${Hints} keys=${[['↑/↓','select'],['a','add'],['enter','change job'],['t','test task'],['p','enable paid jobs'],['x','remove']]}/>
 </${Card}>`;
}
function InfoView({info,scroll,rows,qr}){
 if(!info)return html`<${Card} title="Your data" flexGrow=${1}><${Text} color=${C.dim}><${Spinner}/> collecting…</${Text}></${Card}>`;
 const lines=[...infoLines(info),'','Secrets stay on this machine. The wallet recovery phrase: lokal wallet export'];
 return html`<${Card} title="Your data (copy anything from here; lokal info --json prints it too)" flexGrow=${1}>
  <${Box}>
   <${Box} flexDirection="column" flexGrow=${1}>${lines.slice(scroll,scroll+rows).map((l,i)=>html`<${Text} key=${i} color=${/^\S/.test(l)?C.accent:C.text} wrap="truncate-end">${/^https?:/.test(l.trim().split(/\s+/).at(-1)??'')?l.replace(/(https?:\/\/\S+)/,u=>link(u)):l||' '}</${Text}>`)}</${Box}>
   ${qr?html`<${Box} flexDirection="column" marginLeft=${2}><${Text}>${qr}</${Text}><${Text} color=${C.dim}>selling wallet</${Text}></${Box}>`:null}
  </${Box}>
  <${Hints} keys=${[['↑/↓','scroll'],...(info.payments?.sellingWallet?[['v','wallet QR']]:[])]}/>
 </${Card}>`;
}
function Logs({core,rows=30}){
 const logs=core.recentLogs(rows*4).filter(l=>l.level!=='debug').slice(-rows);
 return html`<${Card} title=${`Logs (last ${rows})`} flexGrow=${1}>${logs.map((l,i)=>html`<${Text} key=${i} wrap="truncate-end"><${Text} color=${l.level==='error'?C.fail:C.accent2}>${l.source.padEnd(12)}</${Text}><${Text} color=${C.dim}>${l.line}</${Text}></${Text}>`)}</${Card}>`;
}
// Bottom sheet for forms, pickers and confirmations; it owns the keyboard while open.
function Dialog({ui,onField,onCancel}){
 const d=ui.dialog;if(!d)return null;
 if(d.kind==='form'){const f=d.fields[d.i];return html`<${Card} title=${d.title} color=${C.accent}>
  ${d.note?html`<${Text} color=${C.dim} wrap="wrap">${d.note}</${Text}>`:null}
  <${TextInput} key=${f.key} label=${`${f.label}${d.fields.length>1?`  (${d.i+1}/${d.fields.length})`:''}`} secret=${f.secret} initial=${f.initial??''} allowEmpty=${f.allowEmpty} onSubmit=${onField} onCancel=${onCancel}/>
 </${Card}>`;}
 if(d.kind==='pick')return html`<${Card} title=${d.title} color=${C.accent}>
  ${d.items.map((it,i)=>html`<${Text} key=${it.id} color=${i===d.i?C.accent:C.text} wrap="truncate-end">${i===d.i?'▶ ':'  '}${it.label}${it.hint?html`<${Text} color=${C.dim}>  ${it.hint}</${Text}>`:null}</${Text}>`)}
  <${Text} color=${C.dim}>↑/↓ choose · enter select · esc cancel</${Text}>
 </${Card}>`;
 if(d.kind==='confirm')return html`<${Card} title=${d.title??'Confirm'} color=${C.warn}>
  <${Text} wrap="wrap">${d.text}</${Text}>
  <${Box} marginTop=${1}>${Object.entries(d.keys).map(([k,[label]])=>html`<${Key} key=${k} k=${k} label=${label}/>`)}<${Key} k="esc" label="cancel"/></${Box}>
 </${Card}>`;
 return null;
}

// ---------- app ----------
export function App({core}){
 const {exit}=useApp();const {setRawMode}=useStdin();const {stdout}=useStdout();
 // Full window: track the terminal size; one row short so Ink doesn't fall back to clearing every frame.
 const [size,setSize]=useState({w:stdout.columns||100,h:stdout.rows||30});
 useEffect(()=>{const on=()=>setSize({w:stdout.columns,h:stdout.rows});stdout.on('resize',on);return ()=>{stdout.off('resize',on)}},[]);
 const [view,setView]=useState('wizard');
 const [sel,setSel]=useState(0);
 const [statuses,setStatuses]=useState([]);
 const [prog,setProg]=useState(null);
 const [last,setLast]=useState(null);
 const [ui,setUi]=useState({tpl:0,sample:0,check:2,mode:null,qr:false,tryState:null,dialog:null});
 const [jobs,setJobs]=useState([]);const [jsel,setJsel]=useState(0);
 const [health,setHealth]=useState([]);const [qr,setQr]=useState(null);
 const [res,setRes]=useState(null);const hist=useRef({cpu:[]});const act=useRef({});
 const [tick,setTick]=useState(0);
 const [info,setInfo]=useState(null);const [iscroll,setIscroll]=useState(0);const [infoQr,setInfoQr]=useState(null);
 const [cws,setCws]=useState([]);const [csel,setCsel]=useState(0);const [svcs,setSvcs]=useState([]);
 const [daemon,setDaemon]=useState(null);const [net,setNet]=useState(core.network?.()??'preprod');
 const [msg,setMsg]=useState(null);
 const busy=useRef(false);
 const steps=core.steps;
 const refresh=useCallback(async(which)=>{
  if(which!==undefined){const s=await core.status(steps[which].id);setStatuses(a=>{const b=[...a];b[which]=s;return b});return}
  setStatuses(await core.statusAll());
 },[core]);
 const flash=m=>{setMsg(m);setTimeout(()=>setMsg(x=>x===m?null:x),6000)};
 useEffect(()=>{refresh();
  const kind=src=>String(src).split('@')[0];
  const onLog=e=>{if(e.level!=='debug')setLast(e);act.current[kind(e.source)]=Date.now()};
  const onProg=e=>setProg(e.pct>=1?null:e);const onStep=()=>refresh();
  const onJob=()=>{for(const k of ['worker','agent','mps'])act.current[k]=Date.now()};
  core.bus.on('log',onLog);core.bus.on('progress',onProg);core.bus.on('step',onStep);core.bus.on('job',onJob);
  return ()=>{core.bus.off('log',onLog);core.bus.off('progress',onProg);core.bus.off('step',onStep);core.bus.off('job',onJob)}},[]);
 // lokald state and network for the header
 useEffect(()=>{const t=async()=>{setDaemon(await core.daemon());setNet(core.network?.()??'preprod')};t();const i=setInterval(t,5000);return ()=>clearInterval(i)},[]);
 // first not-done step is where we start
 useEffect(()=>{if(statuses.length&&!busy.current){busy.current=true;const i=statuses.findIndex(s=>s.status!=='ok');setSel(i<0?4:i);if(i<0)setView('dashboard')}},[statuses.length]);
 useEffect(()=>{const t=setInterval(()=>{if(view==='wizard'&&!ui.dialog)refresh(sel)},4000);return ()=>clearInterval(t)},[view,sel,ui.dialog]);
 useEffect(()=>{if(view!=='dashboard')return;
  const tick=async()=>{setJobs(core.jobs());setHealth(await core.health())};tick();const t=setInterval(tick,3000);
  const rt=async()=>{const r=await core.resources();hist.current.cpu=[...hist.current.cpu,r.cpu.pct].slice(-60);setRes(r)};rt();const t2=setInterval(rt,2000);
  const anim=setInterval(()=>setTick(x=>x+1),200);
  const onJob=()=>setJobs(core.jobs());core.bus.on('job',onJob);
  return ()=>{clearInterval(t);clearInterval(t2);clearInterval(anim);core.bus.off('job',onJob)}},[view]);
 useEffect(()=>{if(view!=='coworkers')return;const t=async()=>{setCws(core.coworkers());setSvcs(await core.services().catch(()=>[]))};t();const i=setInterval(t,3000);return ()=>clearInterval(i)},[view]);
 useEffect(()=>{if(view!=='info')return;setInfo(null);core.info().then(setInfo,e=>flash('✖ '+e.message))},[view]);
 useEffect(()=>{const a=info?.payments?.sellingWallet?.address;if(a&&ui.qr)QRCode.toString(a,{type:'utf8',errorCorrectionLevel:'L'}).then(setInfoQr).catch(()=>{});else setInfoQr(null)},[info,ui.qr]);
 const s=statuses[sel]??{items:[]};
 useEffect(()=>{const a=s.wallet?.address;if(a)QRCode.toString(a,{type:'utf8',errorCorrectionLevel:'L'}).then(setQr).catch(()=>{})},[s.wallet?.address]);
 const runStep=async id=>{const r=await core.runStep(id);if(r?.error)flash('✖ '+r.error);await refresh();};
 const attempt=async(f,ok)=>{try{const r=await f();if(ok)flash(typeof ok==='function'?ok(r):ok);return r}catch(e){flash('✖ '+e.message)}finally{refresh()}};
 // dialogs
 const close=()=>setUi(u=>({...u,dialog:null}));
 const form=(title,fields,onDone,note)=>setUi(u=>({...u,dialog:{kind:'form',title,fields,i:0,values:{},onDone,note}}));
 const pick=(title,items,onPick,i=0)=>setUi(u=>({...u,dialog:{kind:'pick',title,items,i,onPick}}));
 const confirm=(text,keys,title)=>setUi(u=>({...u,dialog:{kind:'confirm',text,keys,title}}));
 const onField=v=>{const d=ui.dialog;const values={...d.values,[d.fields[d.i].key]:v};
  if(d.i+1<d.fields.length){setUi(u=>({...u,dialog:{...d,i:d.i+1,values}}));return}
  close();d.onDone(values);};

 // Runs the template's own prompt + check on the model. Input: the chosen sample, or text you type.
 async function tryIt(own){
  const t=s.templates?.[ui.tpl%(s.templates.length+1)];if(!t)return;
  const full=loadTemplate(t.id);const sample=orderedSamples(full)[ui.sample%Math.max(full.samples.length,1)];
  if(own===undefined&&!sample){form(`Try ${t.name}`,[{key:'v',label:'Input for the model (what a buyer would send)'}],v=>tryIt(v.v),'Runs your prompt and its check on the model right now. Nothing is sent to Sokosumi.');return}
  const input=own??sample.text;
  setUi(u=>({...u,tryState:{text:'',done:false,input}}));
  const onTry=e=>setUi(u=>({...u,tryState:{...u.tryState,text:e.text}}));
  core.bus.on('try',onTry);
  try{const r=await core.tryIt(t.id,input);setUi(u=>({...u,tryState:{text:r.output,done:true,check:r.check,seconds:r.seconds,input}}));refresh(sel);}
  catch(e){setUi(u=>({...u,tryState:null}));flash('✖ '+e.message);}
  finally{core.bus.off('try',onTry);}
 }
 function editPrompt(){
  const dir=mkdtempSync(join(tmpdir(),'lokal-'));const f=join(dir,'prompt.md');
  writeFileSync(f,'You are a helpful agent. Describe the job, the exact output format, and the limits here.\n');
  setRawMode(false);spawnSync(process.env.VISUAL||process.env.EDITOR||'nano',[f],{stdio:'inherit'});setRawMode(true);
  const prompt=readFileSync(f,'utf8');setUi(u=>({...u,mode:'pickCheck',customPrompt:prompt}));
 }
 function modelSource(){
  pick('Where does the model run?',[
   {id:'ollama',label:'Local Ollama',hint:'lokAl installs it; pick from the list with m'},
   {id:'tag',label:'Any Ollama model',hint:'a tag like qwen2.5:32b or hf.co/…:Q4_K_M'},
   {id:'api',label:'OpenAI-compatible API',hint:'cloud key, vLLM, LM Studio, Ollama on a GPU box'},
   {id:'llamacpp',label:'llama.cpp server',hint:'a llama-server you already run'}],
  it=>{
   if(it.id==='ollama')attempt(()=>core.useOllama(),'✔ Local Ollama. Press enter to set it up.');
   if(it.id==='tag')form('Ollama model',[{key:'tag',label:'Model tag (as in `ollama pull …`)'}],v=>attempt(async()=>{await core.chooseModel(v.tag);const r=await core.runStep('machine');if(r?.error)throw new Error(r.error)},`✔ ${v.tag} is ready`));
   if(it.id==='api')pick('Which endpoint?',[...(s.presets??[]).map(p=>({...p,label:p.name,hint:p.baseURL})),{id:'other',label:'Other URL',hint:'any OpenAI-compatible /v1 endpoint'}],p=>form(`${p.name??'Custom'} endpoint`,[
     {key:'url',label:'Base URL',initial:p.baseURL??'https://'},{key:'key',label:'API key',secret:true,allowEmpty:true},{key:'model',label:'Model name (empty: the first one the endpoint lists)',initial:p.model??'',allowEmpty:true}],
     v=>attempt(()=>core.useExternal({baseURL:v.url,apiKey:v.key,model:v.model}),'✔ Endpoint answered. Restart services (r on the dashboard) to use it.'),
     'The key is stored in coworker/.env (mode 600) and never logged. Results from remote models are marked "weights unverified".'));
   if(it.id==='llamacpp')form('llama.cpp',[{key:'url',label:'llama-server URL',initial:'http://127.0.0.1:8080'}],v=>attempt(()=>core.useLlamacpp({baseURL:v.url}),'✔ llama.cpp server answered'));
  });
 }
 function templatePicker(title,onPick,current){
  const ts=core.templates();
  pick(title,ts.map(t=>({id:t.id,label:t.name,hint:`${t.check?.type??'none'}${t.custom?' · custom':''}`})),it=>onPick(it.id),Math.max(0,ts.findIndex(t=>t.id===current)));
 }
 function addCoworker(){
  form('New Coworker',[{key:'name',label:'Name (e.g. Contract summary)'}],v=>templatePicker(`Job for ${v.name}`,tpl=>confirm(`Create the Sokosumi Coworker "${v.name}" doing ${tpl}? This registers it on Sokosumi under your Vendor.`,{
   y:['create',()=>attempt(async()=>{const c=await core.addCoworker({name:v.name,template:tpl});setCws(core.coworkers());return c},c=>`✔ ${c.name} created${c.coworkerId?' and registered':' (not on Sokosumi yet)'}. ${daemon?.running?'Its services are starting.':'Start services with enter in step 5.'}`)]})));
 }

 useInput(async(input,key)=>{
  const d=ui.dialog;
  if(d?.kind==='form')return; // TextInput owns the keyboard
  if(d?.kind==='pick'){
   const move=k=>setUi(u=>u.dialog?.kind==='pick'?{...u,dialog:{...u.dialog,i:(u.dialog.i+k+u.dialog.items.length)%u.dialog.items.length}}:u);
   if(key.upArrow||key.leftArrow)move(-1);
   if(key.downArrow||key.rightArrow||key.tab)move(1);
   if(key.escape)close();
   if(key.return){close();d.onPick(d.items[d.i]);}
   return;
  }
  if(d?.kind==='confirm'){
   if(key.escape||input==='n'){close();return}
   const h=d.keys[input];if(h){close();h[1]();}
   return;
  }
  if(ui.mode==='pickCheck'){
   if(key.leftArrow)setUi(u=>({...u,check:(u.check+CHECK_TYPES.length-1)%CHECK_TYPES.length}));
   if(key.rightArrow)setUi(u=>({...u,check:(u.check+1)%CHECK_TYPES.length}));
   if(key.escape)setUi(u=>({...u,mode:null}));
   if(key.return){const type=CHECK_TYPES[ui.check%CHECK_TYPES.length].type;const cfg=type==='regex'?{type,pattern:'.+'}:type==='length'?{type,min:1,max:4000}:type==='schema'?{type,schema:{type:'object'}}:{type};
    try{await core.createTemplate({id:`custom-${Date.now().toString(36)}`,name:'Custom prompt',prompt:ui.customPrompt,check:cfg});flash('✔ Custom job saved and selected');}catch(e){flash('✖ '+e.message)}
    setUi(u=>({...u,mode:null}));refresh();}
   return;
  }
  if(input==='q'||(key.ctrl&&input==='c')){exit();return}
  if(key.ctrl||key.meta)return;
  if(VIEWS[input]){setView(VIEWS[input]);setUi(u=>({...u,qr:false}));return}
  if(view==='dashboard'){
   if(key.upArrow)setJsel(i=>Math.max(0,i-1));
   if(key.downArrow)setJsel(i=>Math.min(Math.max(jobs.length-1,0),i+1));
   if(input==='t')attempt(()=>core.sendTestJob(0),r=>`✔ Test task ${String(r?.id??'').slice(0,8)} sent. Watch it appear here.`);
   if(input==='r'){flash('Restarting services…');attempt(()=>core.restartService(),'✔ Services restarted');}
   if(input==='x')confirm('Stop every service (agent, worker, agent API, payment service)? Buyers cannot hire you while they are stopped.',{y:['stop',()=>attempt(()=>core.stopDaemon(),'Services stopped. r starts them again.')]});
   return;
  }
  if(view==='info'){
   if(key.upArrow)setIscroll(i=>Math.max(0,i-1));
   if(key.downArrow)setIscroll(i=>i+1);
   if(input==='v')setUi(u=>({...u,qr:!u.qr}));
   return;
  }
  if(view==='coworkers'){
   const c=cws[csel];
   if(key.upArrow)setCsel(i=>Math.max(0,i-1));
   if(key.downArrow)setCsel(i=>Math.min(cws.length-1,i+1));
   if(input==='a')addCoworker();
   if(c&&key.return)templatePicker(`New job for ${c.name}`,tpl=>attempt(async()=>{await core.setCoworkerTemplate(c.id,tpl);setCws(core.coworkers())},`✔ ${c.name} now does ${tpl}`),c.template);
   if(c&&input==='t')attempt(()=>core.sendTestJob(0,c),r=>`✔ Test task ${String(r?.id??'').slice(0,8)} sent to ${c.name}`);
   if(c&&input==='p'&&!c.paid)confirm(`Register ${c.name} on the Masumi registry (${net}) so it can take paid jobs? This is an on-chain transaction from the selling wallet.`,{y:['register',()=>attempt(()=>core.registerCoworkerPaid(c.id),'✔ Registration submitted. It confirms in a few minutes.')]});
   if(c&&input==='x'){if(c.primary)flash('The main Coworker belongs to the setup wizard; it cannot be removed.');
    else confirm(`Remove ${c.name}? Its processes stop and its folder is deleted. Its Sokosumi record stays unless you retire it (Sokosumi has no delete).`,{y:['remove',()=>attempt(async()=>{await core.removeCoworker(c.id);setCws(core.coworkers());setCsel(0)},`Removed ${c.name}`)],r:['remove + retire on Sokosumi',()=>attempt(async()=>{await core.removeCoworker(c.id,{retire:true});setCws(core.coworkers());setCsel(0)},`Removed and retired ${c.name}`)]});}
   return;
  }
  if(view!=='wizard')return;
  if(key.upArrow||(key.shift&&key.tab)){setSel(i=>(i+4)%5);setUi(u=>({...u,tryState:null,qr:false}));return}
  if(key.downArrow||key.tab){setSel(i=>(i+1)%5);setUi(u=>({...u,tryState:null,qr:false}));return}
  const id=steps[sel].id;
  if(id==='machine'){
   if(input==='m'&&s.recommendation&&s.backend==='ollama'){const opts=s.recommendation.options.filter(o=>o.fits);const i=opts.findIndex(o=>o.id===s.model);await core.chooseModel(opts[(i+1)%opts.length].id);refresh(sel)}
   if(input==='b')modelSource();
   if(key.return)runStep(id);
  }
  if(id==='job'){
   const n=(s.templates?.length??0)+1;const custom=ui.tpl%n===n-1;
   if(key.leftArrow)setUi(u=>({...u,tpl:(u.tpl+n-1)%n,sample:0,tryState:null}));
   if(key.rightArrow)setUi(u=>({...u,tpl:(u.tpl+1)%n,sample:0,tryState:null}));
   if(input==='s')setUi(u=>({...u,sample:u.sample+1,tryState:null}));
   if(input==='t'&&!custom)tryIt();
   if(input==='y'&&!custom)form('Try it',[{key:'v',label:'Input for the model (what a buyer would send)'}],v=>tryIt(v.v),'Runs this prompt and its check on the model right now. Nothing is sent to Sokosumi.');
   if(input==='f'&&custom)form('Import a Markdown prompt',[{key:'path',label:'Path to the .md file'}],v=>attempt(()=>core.importPrompt(resolve(v.path.replace(/^~(?=\/)/,process.env.HOME??'~'))),'✔ Imported and selected'),
    'Front matter between --- lines: name, description, check (none|json|schema|regex|length|invoice), pattern / min / max / schema, price. The rest is the prompt.');
   if(key.return){if(custom)editPrompt();else{await core.selectTemplate(s.templates[ui.tpl%n].id);flash(daemon?.running?'✔ Job selected; the agent and worker were restarted with it.':'✔ Job selected. The agent uses it from its next start.');refresh(sel)}}
  }
  if(id==='sokosumi'){
   const signedOut=s.items?.find(i=>i.label==='Account'&&i.status!=='ok');
   if(key.return){if(signedOut&&s.headless)form('Sokosumi sign-in',[{key:'k',label:'Sokosumi API key',secret:true}],v=>attempt(()=>core.loginWithKey(v.k),'✔ Signed in. Press enter to create your Vendor and Coworker.'),'Create the key on your laptop: https://preprod.sokosumi.com/connections → API keys. It starts with soko_preprod_.');else runStep(id);}
   if(input==='b'&&signedOut){core.login();flash('Getting a sign-in link…');setTimeout(()=>refresh(sel),1500);}
   if(input==='o')attempt(()=>core.useOrganization(),r=>r.pending?`Waiting for a Workspace admin to approve (${r.access})`:`✔ Using ${r.org.name}. Press r on the dashboard to restart services.`);
   if(input==='p'){core.usePersonal();flash('Back to the Personal Workspace');refresh(sel)}
  }
  if(id==='pay'){
   const need=s.items?.find(i=>i.status==='input');
   if(key.return){if(need)form(need.label,[{key:'v',label:need.input.label,secret:need.input.secret}],v=>attempt(()=>core.setValue(need.input.key,v.v),'✔ Saved. Press enter to continue.'));else core.runPay().then(r=>{if(r?.error)flash('✖ '+r.error);refresh(sel)})}
   if(input==='n'){
    if(s.network==='mainnet')confirm('Switch back to preprod? Your mainnet wallet and registration are kept for later.',{y:['switch',()=>attempt(async()=>{await core.setNetwork('preprod');setNet('preprod')},'✔ Preprod. Restart services to apply.')]});
    else form('Switch to MAINNET',[{key:'c',label:'Type "mainnet" to use real ADA and real USDM'}],v=>{if(v.c!=='mainnet'){flash('Staying on preprod');return}attempt(async()=>{await core.setNetwork('mainnet');setNet('mainnet')},'✔ Mainnet. Add a mainnet Blockfrost key, fund the wallet, set a public URL, then enter.')},
     'Mainnet registration and every payment use real money. Sokosumi Tasks stay on preprod (its runtime is preprod-only); paid mainnet jobs come through the MIP-003 agent API, which needs a public URL. Your preprod wallet and registration are kept.');
   }
   if(input==='f'&&s.wallet?.faucet){if(core.headless)flash(`Open on your laptop: ${s.wallet.faucet}`);else{try{spawn(process.platform==='darwin'?'open':'xdg-open',[s.wallet.faucet],{detached:true,stdio:'ignore'}).on('error',()=>{}).unref()}catch{}flash('Opened the dispenser. Paste your wallet address there.')}}
   if(input==='v')setUi(u=>({...u,qr:!u.qr}));
  }
  if(id==='live'){
   if(key.return)runStep(id);
   if(input==='t')attempt(()=>core.sendTestJob(ui.sample),r=>`✔ Test task ${String(r?.id??'').slice(0,8)} sent`);
  }
 });

 const recent=(k,ms=8000)=>Date.now()-(act.current[k]??0)<ms;
 const active={tasks:recent('worker'),ask:recent('agent')||recent('worker',4000),infer:(res?.procs?.model?.cpu??0)>20||recent('agent'),
  escrow:recent('mps')&&recent('worker'),chain:recent('registry')||recent('pay')||recent('mps',3000),hire:recent('api'),lock:recent('api'),pay:recent('api')};
 const Panel={machine:MachinePanel,job:JobPanel,sokosumi:SokosumiPanel,pay:PayPanel,live:LivePanel}[steps[sel]?.id];
 const bodyRows=Math.max(5,size.h-9-(ui.dialog?8:0));
 return html`<${Box} flexDirection="column" width=${size.w} height=${Math.max(10,size.h-1)}>
  <${Header} statuses=${statuses} view=${view} core=${core} net=${net} daemon=${daemon}/>
  <${Tabs} view=${view}/>
  ${view==='wizard'?html`<${Box} flexGrow=${1}>
   <${Rail} steps=${steps} statuses=${statuses} sel=${sel}/>
   <${Box} flexDirection="column" flexGrow=${1} borderStyle="round" borderColor=${C.accent} paddingX=${1}>
    <${Text} bold color=${C.text}>${sel+1}. ${steps[sel].title}  ${s.status==='running'?html`<${Spinner}/>`:null}</${Text}>
    ${s.error?html`<${Text} color=${C.fail}>${s.error}</${Text}>`:null}
    ${statuses.length?html`<${Panel} s=${s} ui=${ui} qr=${qr}/>`:html`<${Text} color=${C.dim}><${Spinner}/> checking your machine…</${Text}>`}
   </${Box}>
  </${Box}>`
  :view==='dashboard'?html`<${Box} flexGrow=${1} flexDirection="column"><${Dashboard} jobs=${jobs} earn=${core.earnings(jobs)} health=${health} sel=${jsel} res=${res} hist=${hist.current} active=${active} tick=${tick} rows=${Math.max(3,size.h-26)} net=${net}/></${Box}>`
  :view==='coworkers'?html`<${CoworkersView} cws=${cws} sel=${csel} svcs=${svcs}/>`
  :view==='info'?html`<${InfoView} info=${info} scroll=${iscroll} rows=${bodyRows-3} qr=${ui.qr?infoQr:null}/>`
  :html`<${Logs} core=${core} rows=${bodyRows}/>`}
  <${Dialog} ui=${ui} onField=${onField} onCancel=${close}/>
  ${prog?html`<${Box} paddingX=${1}><${ProgressBar} pct=${prog.pct??0} label=${prog.label}/></${Box}>`:null}
  ${msg?html`<${Box} paddingX=${1}><${Text} color=${msg.startsWith('✖')?C.fail:C.ok} wrap="truncate-end">${msg}</${Text}></${Box}>`:null}
  <${Box} paddingX=${1}><${Text} color=${C.dim} wrap="truncate-end">${last?`[${last.source}] ${last.line}`:' '}</${Text}></${Box}>
 </${Box}>`;
}

// Alternate screen buffer: the UI owns the whole window and the shell comes back untouched on exit.
export function start(core){
 const tty=process.stdout.isTTY;
 const leave=()=>{if(tty)process.stdout.write('\u001b[?1049l\u001b[?25h')};
 if(tty)process.stdout.write('\u001b[?1049h\u001b[H');
 process.once('exit',leave);
 const app=render(html`<${App} core=${core}/>`,{exitOnCtrlC:false});
 // Resolves after the goodbye note, so the caller can exit right after.
 app.finished=app.waitUntilExit().then(async()=>{leave();
  const d=await core.daemon().catch(()=>({}));
  if(d.running)console.log(`lokAl services keep running in the background (lokald, pid ${d.pid}).\n  lokal        reopen this screen\n  lokal info   your wallet, agent and Coworker ids\n  lokal down   stop everything`);
 },leave);
 return app;
}
