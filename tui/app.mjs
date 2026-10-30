import {useState,useEffect,useRef,useCallback} from 'react';
import {Box,Text,useInput,useApp,useStdin,useStdout,render} from 'ink';
import {spawn,spawnSync} from 'node:child_process';
import {writeFileSync,readFileSync,mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import QRCode from 'qrcode';
import {html} from './html.mjs';
import {C,COLOR,link,short} from './theme.mjs';
import {StatusIcon,ProgressBar,Badge,Key,Card,TextInput,Spinner} from './components.mjs';
import {CHECK_TYPES} from '../checks/index.mjs';
import {loadTemplate,orderedSamples} from '../templates/index.mjs';

const openUrl=url=>{try{spawn(process.platform==='darwin'?'open':'xdg-open',[url],{detached:true,stdio:'ignore'}).on('error',()=>{}).unref()}catch{}};

function Header({statuses,view,mock}){
 const done=statuses.filter(s=>s?.status==='ok').length;
 return html`<${Box} justifyContent="space-between" paddingX=${1}>
  <${Text}><${Text} color=${C.accent} bold>◆ lokAl</${Text}><${Text} color=${C.dim}>  your local LLM, hired and paid on Cardano</${Text}>${mock?html`<${Text} color=${C.warn}>  [mock]</${Text}>`:null}</${Text}>
  <${Text} color=${C.dim}>${view==='wizard'?`setup ${done}/5`:view}</${Text}>
 </${Box}>`;
}

function Rail({steps,statuses,sel}){
 return html`<${Box} flexDirection="column" width=${31} flexShrink=${0} paddingX=${1} borderStyle="round" borderColor=${C.card}>
  ${steps.map((s,i)=>{const st=statuses[i]?.status??'todo';const active=i===sel;
   return html`<${Box} key=${s.id} marginY=${0}>
    <${Text} color=${active?C.accent:C.dim}>${active?'▶ ':'  '}</${Text}>
    <${StatusIcon} status=${st}/>
    <${Text} color=${active?C.text:st==='ok'?C.ok:C.dim} bold=${active}> ${i+1}. ${s.title}</${Text}>
   </${Box}>`;})}
 </${Box}>`;
}

function Items({items=[]}){
 return html`<${Box} flexDirection="column" marginTop=${1}>
  ${items.map(i=>html`<${Box} key=${i.label}>
   <${Box} width=${3}><${StatusIcon} status=${i.status}/></${Box}>
   <${Box} width=${22} flexShrink=${0}><${Text} color=${C.text}>${i.label}</${Text}></${Box}>
   <${Box} flexShrink=${1}><${Text} color=${COLOR[i.status]===C.dim?C.dim:i.status==='ok'?C.dim:COLOR[i.status]} wrap="truncate-end">${i.detail}</${Text}></${Box}>
  </${Box}>`)}
 </${Box}>`;
}

function Hints({keys}){return html`<${Box} marginTop=${1} flexWrap="wrap">${keys.map(([k,l])=>html`<${Key} key=${k} k=${k} label=${l}/>`)}</${Box}>`;}

// ---------- step panels ----------
function MachinePanel({s,ui}){
 const rec=s.recommendation;
 return html`<${Box} flexDirection="column">
  <${Text} color=${C.dim}>lokAl finds or installs a model runtime (no sudo) and picks a model that fits your hardware.</${Text}>
  <${Items} items=${s.items}/>
  ${rec?html`<${Box} marginTop=${1} flexDirection="column">
   <${Text} color=${C.dim}>Models (m to switch):</${Text}>
   ${rec.options.map(o=>html`<${Text} key=${o.id} color=${o.id===s.model?C.accent:o.fits?C.text:C.dim}>${o.id===s.model?' ● ':' ○ '}${o.name.padEnd(14)} ${String(o.sizeGB).padStart(4)} GB  ${o.fits?o.note:'too big for this machine'}</${Text}>`)}
  </${Box}>`:null}
  <${Hints} keys=${[['enter',s.status==='ok'?'re-run checks':'set it all up'],['m','switch model']]}/>
 </${Box}>`;
}

function JobPanel({s,ui}){
 const ts=s.templates??[];const t=ts[ui.tpl%Math.max(ts.length+1,1)];
 const custom=ui.tpl%(ts.length+1)===ts.length;
 const sample=t?.samples?.[ui.sample%Math.max(t.samples.length,1)];
 return html`<${Box} flexDirection="column">
  <${Text} color=${C.dim}>A job = a system prompt + a check. lokAl only asks to be paid when the check passes.</${Text}>
  <${Box} marginTop=${1}>
   ${ts.map((x,i)=>html`<${Box} key=${x.id} borderStyle="round" borderColor=${i===ui.tpl%(ts.length+1)?C.accent:C.card} paddingX=${1} marginRight=${1}>
    <${Text} color=${x.id===s.active?C.ok:C.text}>${x.id===s.active?'✔ ':''}${x.name}</${Text}></${Box}>`)}
   <${Box} borderStyle="round" borderColor=${custom?C.accent:C.card} paddingX=${1}><${Text}>+ Custom prompt</${Text}></${Box}>
  </${Box}>
  ${custom?html`<${Text} color=${C.dim}>Write your own system prompt in $EDITOR, then choose its check.</${Text}>`:t?html`<${Box} flexDirection="column">
   <${Text} color=${C.dim} wrap="wrap">${t.description}</${Text}>
   <${Text}>check: <${Text} color=${t.check?.type==='none'?C.warn:C.ok}>${t.check?.type}</${Text}>${t.price?html`<${Text} color=${C.dim}>   price: ${t.price.display}</${Text}>`:null}</${Text}>
   ${sample?html`<${Text}>sample (s): <${Text} color=${C.accent2}>${sample.name}</${Text}> <${Text} color=${C.dim}>expected to ${sample.expect}</${Text}></${Text}>`:null}
  </${Box}>`:null}
  ${ui.mode==='pickCheck'?html`<${Box} marginTop=${1} flexDirection="column"><${Text} color=${C.warn}>Pick a check for your prompt (←/→, enter):</${Text}>
   <${Box}>${CHECK_TYPES.map((c,i)=>html`<${Text} key=${c.type} color=${i===ui.check%CHECK_TYPES.length?C.accent:C.dim}> ${i===ui.check%CHECK_TYPES.length?'●':'○'} ${c.label} </${Text}>`)}</${Box}>
   <${Text} color=${C.dim}>${CHECK_TYPES[ui.check%CHECK_TYPES.length].description}</${Text}></${Box}>`:null}
  ${ui.tryState?html`<${Card} title=${ui.tryState.done?`Model answer · ${ui.tryState.seconds}s`:'Model is answering…'}>
   <${Text} color=${C.text} wrap="truncate-end">${(ui.tryState.text||'').replace(/\s+/g,' ').slice(-600)}</${Text}>
   ${ui.tryState.done?html`<${Box} marginTop=${1}><${Badge} pass=${ui.tryState.check.pass}/><${Text} color=${C.dim}> ${ui.tryState.check.reasons.slice(0,2).join('; ')}</${Text}></${Box}>`:html`<${Spinner}/>`}
  </${Card}>`:null}
  <${Items} items=${s.items}/>
  <${Hints} keys=${[['←/→','template'],['enter',custom?'write prompt':'use this job'],['s','next sample'],['t','try it']]}/>
 </${Box}>`;
}

function SokosumiPanel({s}){
 const action=s.items?.find(i=>i.command);
 return html`<${Box} flexDirection="column">
  <${Text} color=${C.dim}>Sokosumi is the marketplace where buyers hire your agent. lokAl reuses what you already have.</${Text}>
  <${Items} items=${s.items}/>
  ${action?html`<${Box} marginTop=${1}><${Text} color=${C.warn}>One human step: press enter and sign in in the browser window that opens.</${Text}></${Box}>`:null}
  <${Hints} keys=${[['enter',s.status==='ok'?'re-check':'connect'],...(s.organizations?.length?[['o','use organization Workspace'],['p','personal']]:[])]}/>
 </${Box}>`;
}

function PayPanel({s,ui,qr}){
 const w=s.wallet;const need=s.items?.find(i=>i.status==='input');const reg=s.items?.find(i=>i.label==='Registry');
 return html`<${Box} flexDirection="column">
  <${Text} color=${C.dim}>Your own Masumi payment service and selling wallet. Buyers pay into escrow on Cardano preprod.</${Text}>
  <${Items} items=${s.items}/>
  ${reg?.tx?html`<${Text} color=${C.dim}>registration tx: <${Text} color=${C.accent2}>${link(`https://preprod.cardanoscan.io/transaction/${reg.tx}`,short(reg.tx))}</${Text}></${Text}>`:null}
  ${w?.address&&ui.qr&&qr?html`<${Box} marginTop=${1}><${Text}>${qr}</${Text}><${Box} flexDirection="column" marginLeft=${2}><${Text} color=${C.text}>Selling wallet</${Text}><${Text} color=${C.dim} wrap="wrap">${w.address}</${Text}><${Text} color=${C.accent2}>${link(w.faucet,'Get test ADA → '+w.faucet)}</${Text}></${Box}></${Box}>`:null}
  ${ui.mode==='input'&&need?html`<${TextInput} label=${need.input.label} secret=${need.input.secret} onSubmit=${ui.onInput} onCancel=${ui.onCancel}/>`:null}
  <${Hints} keys=${[...(need?[['enter',`enter ${need.label.toLowerCase()}`]]:[['enter','continue setup']]),...(w?.address?[['f','open faucet'],['c','QR code']]:[])]}/>
 </${Box}>`;
}

function LivePanel({s}){
 return html`<${Box} flexDirection="column">
  <${Text} color=${C.dim}>lokAl keeps the agent, the worker and the agent API running, and restarts them if they crash.</${Text}>
  <${Items} items=${s.items}/>
  <${Hints} keys=${[['enter','start services'],['t','send yourself a test job'],['d','dashboard']]}/>
 </${Box}>`;
}

// ---------- dashboard ----------
function Dashboard({jobs,earn,health,sel}){
 const j=jobs[sel];
 return html`<${Box} flexDirection="column">
  <${Box}>
   <${Card} title="Earned"><${Text} color=${C.ok} bold>${earn.usdm} USDM</${Text}><${Text} color=${C.dim}>${earn.paidJobs} paid of ${earn.jobs}</${Text}></${Card}>
   <${Card} title="Check pass rate"><${Text} color=${C.accent2} bold>${earn.passRate==null?'—':Math.round(earn.passRate*100)+'%'}</${Text}><${Text} color=${C.dim}>failed = not charged</${Text}></${Card}>
   <${Card} title="Health" flexGrow=${1}><${Box} flexWrap="wrap">${health.map(h=>html`<${Text} key=${h.id}><${Text} color=${COLOR[h.status]}>● </${Text}><${Text} color=${C.text}>${h.label}   </${Text}></${Text}>`)}</${Box}>
    ${health.filter(h=>h.status==='fail').slice(0,1).map(h=>html`<${Text} key="fix" color=${C.warn}>${h.fix}</${Text}>`)}</${Card}>
  </${Box}>
  <${Box}>
   <${Card} title="Jobs" width=${40}>
    ${jobs.length?jobs.slice(0,12).map((x,i)=>html`<${Box} key=${x.id}><${Text} color=${i===sel?C.accent:C.dim}>${i===sel?'▶ ':'  '}</${Text}><${StatusIcon} status=${x.status==='paid'||x.status==='completed'?'ok':x.status==='withheld'?'fail':'running'}/><${Text} color=${i===sel?C.text:C.dim}> ${x.id.slice(0,8)} ${(x.status??'').slice(0,16).padEnd(16)} ${x.paid?'paid':'free'}</${Text}></${Box}>`):html`<${Text} color=${C.dim}>No jobs yet. Press t to send yourself one.</${Text}>`}
   </${Card}>
   ${j?html`<${Card} title=${`Job ${j.id.slice(0,8)}`} flexGrow=${1}>
    <${Text}>status: <${Text} color=${j.status==='withheld'?C.fail:j.status==='paid'?C.ok:C.accent2}>${j.status}</${Text}>${j.onChainState?html`<${Text} color=${C.dim}>  on-chain: ${j.onChainState}</${Text}>`:null}</${Text}>
    ${j.check?html`<${Box}><${Badge} pass=${j.check.pass}/><${Text} color=${C.dim}> ${j.check.pass?'':(j.check.reasons??[]).slice(0,1).join('')}</${Text}></${Box}>`:null}
    ${j.status==='withheld'?html`<${Text} color=${C.warn}>Result withheld: the buyer is not charged and can reclaim the escrow.</${Text}>`:null}
    ${j.model?html`<${Text} color=${C.dim}>model: <${Text} color=${C.text}>${j.model}</${Text}>  weights: ${j.digest?short(j.digest,14):'unverified'}</${Text}>`:null}
    ${j.resultHash?html`<${Text} color=${C.dim}>result hash: ${short(j.resultHash,12)}</${Text}>`:null}
    ${(j.txs??[]).map(t=>html`<${Text} key=${t.hash+t.label} color=${C.dim}>${t.label.padEnd(16)} <${Text} color=${C.accent2}>${link(t.url,short(t.hash))}</${Text}></${Text}>`)}
    ${j.input?html`<${Text} color=${C.dim} wrap="truncate-end">in:  ${String(j.input).replace(/\s+/g,' ').slice(0,200)}</${Text}>`:null}
    ${j.output?html`<${Text} color=${C.text} wrap="truncate-end">out: ${String(j.output).replace(/\s+/g,' ').slice(0,200)}</${Text}>`:null}
   </${Card}>`:null}
  </${Box}>
  <${Hints} keys=${[['↑/↓','job'],['t','test job'],['r','restart services'],['w','setup'],['l','logs'],['q','quit']]}/>
 </${Box}>`;
}

function Logs({core,rows=30}){
 const logs=core.recentLogs(rows*4).filter(l=>l.level!=='debug').slice(-rows);
 return html`<${Card} title=${`Logs (last ${rows})`} flexGrow=${1}>${logs.map((l,i)=>html`<${Text} key=${i} wrap="truncate-end"><${Text} color=${l.level==='error'?C.fail:C.accent2}>${l.source.padEnd(9)}</${Text}><${Text} color=${C.dim}>${l.line}</${Text}></${Text}>`)}<${Hints} keys=${[['w','setup'],['d','dashboard'],['q','quit']]}/></${Card}>`;
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
 const [ui,setUi]=useState({tpl:0,sample:0,check:2,mode:null,qr:false,tryState:null});
 const [jobs,setJobs]=useState([]);const [jsel,setJsel]=useState(0);
 const [health,setHealth]=useState([]);const [qr,setQr]=useState(null);
 const [msg,setMsg]=useState(null);
 const busy=useRef(false);
 const steps=core.steps;
 const refresh=useCallback(async(which)=>{
  if(which!==undefined){const s=await core.status(steps[which].id);setStatuses(a=>{const b=[...a];b[which]=s;return b});return}
  setStatuses(await core.statusAll());
 },[core]);
 useEffect(()=>{refresh().then(()=>{});const onLog=e=>{if(e.level!=='debug')setLast(e)};const onProg=e=>setProg(e.pct>=1?null:e);const onStep=()=>refresh();
  core.bus.on('log',onLog);core.bus.on('progress',onProg);core.bus.on('step',onStep);
  return ()=>{core.bus.off('log',onLog);core.bus.off('progress',onProg);core.bus.off('step',onStep)}},[]);
 // first not-done step is where we start
 useEffect(()=>{if(statuses.length&&!busy.current){busy.current=true;const i=statuses.findIndex(s=>s.status!=='ok');setSel(i<0?4:i);if(i<0)setView('dashboard')}},[statuses.length]);
 useEffect(()=>{const t=setInterval(()=>{if(view==='wizard')refresh(sel)},4000);return ()=>clearInterval(t)},[view,sel]);
 useEffect(()=>{if(view!=='dashboard')return;const tick=async()=>{setJobs(core.jobs());setHealth(await core.health())};tick();const t=setInterval(tick,3000);const onJob=()=>setJobs(core.jobs());core.bus.on('job',onJob);return ()=>{clearInterval(t);core.bus.off('job',onJob)}},[view]);
 const s=statuses[sel]??{items:[]};
 useEffect(()=>{const a=s.wallet?.address;if(a)QRCode.toString(a,{type:'utf8',errorCorrectionLevel:'L'}).then(setQr).catch(()=>{})},[s.wallet?.address]);
 const flash=m=>{setMsg(m);setTimeout(()=>setMsg(null),5000)};
 const runStep=async id=>{const r=await core.runStep(id);if(r?.error)flash('✖ '+r.error);await refresh();};

 async function tryIt(){
  const t=s.templates?.[ui.tpl%(s.templates.length+1)];if(!t)return;
  const full=loadTemplate(t.id);const sample=orderedSamples(full)[ui.sample%Math.max(full.samples.length,1)];
  const input=sample?.text??'Hello! What can you do?';
  setUi(u=>({...u,tryState:{text:'',done:false}}));
  const onTry=e=>setUi(u=>({...u,tryState:{...u.tryState,text:e.text}}));
  core.bus.on('try',onTry);
  try{const r=await core.tryIt(t.id,input);setUi(u=>({...u,tryState:{text:r.output,done:true,check:r.check,seconds:r.seconds}}));refresh(sel);}
  catch(e){setUi(u=>({...u,tryState:null}));flash('✖ '+e.message);}
  finally{core.bus.off('try',onTry);}
 }
 function editPrompt(){
  const dir=mkdtempSync(join(tmpdir(),'lokal-'));const f=join(dir,'prompt.md');
  writeFileSync(f,'You are a helpful agent. Describe the job, the exact output format, and the limits here.\n');
  setRawMode(false);spawnSync(process.env.VISUAL||process.env.EDITOR||'nano',[f],{stdio:'inherit'});setRawMode(true);
  const prompt=readFileSync(f,'utf8');setUi(u=>({...u,mode:'pickCheck',customPrompt:prompt}));
 }

 useInput(async(input,key)=>{
  if(ui.mode==='input')return; // TextInput owns the keyboard
  if(ui.mode==='pickCheck'){
   if(key.leftArrow)setUi(u=>({...u,check:(u.check+CHECK_TYPES.length-1)%CHECK_TYPES.length}));
   if(key.rightArrow)setUi(u=>({...u,check:(u.check+1)%CHECK_TYPES.length}));
   if(key.escape)setUi(u=>({...u,mode:null}));
   if(key.return){const type=CHECK_TYPES[ui.check%CHECK_TYPES.length].type;const cfg=type==='regex'?{type,pattern:'.+'}:type==='length'?{type,min:1,max:4000}:type==='schema'?{type,schema:{type:'object'}}:{type};
    try{await core.createTemplate({id:`custom-${Date.now().toString(36)}`,name:'Custom prompt',prompt:ui.customPrompt,check:cfg});flash('✔ Custom job saved and selected');}catch(e){flash('✖ '+e.message)}
    setUi(u=>({...u,mode:null}));refresh();}
   return;
  }
  if(input==='q'||(key.ctrl&&input==='c')){await core.stopServices?.();exit();return}
  if(key.ctrl||key.meta)return;
  if(input==='d'){setView('dashboard');return}
  if(input==='w'){setView('wizard');return}
  if(input==='l'){setView('logs');return}
  if(view==='dashboard'){
   if(key.upArrow)setJsel(i=>Math.max(0,i-1));
   if(key.downArrow)setJsel(i=>Math.min(Math.max(jobs.length-1,0),i+1));
   if(input==='t'){try{const r=await core.sendTestJob(0);flash(`✔ Test task ${String(r?.id??'').slice(0,8)} sent. Watch it appear here.`)}catch(e){flash('✖ '+e.message)}}
   if(input==='r'){await core.stopServices();await core.startServices();flash('Services restarted')}
   return;
  }
  if(view!=='wizard')return;
  if(key.upArrow||(key.shift&&key.tab)){setSel(i=>(i+4)%5);setUi(u=>({...u,tryState:null}));return}
  if(key.downArrow||key.tab){setSel(i=>(i+1)%5);setUi(u=>({...u,tryState:null}));return}
  const id=steps[sel].id;
  if(id==='machine'){
   if(input==='m'&&s.recommendation){const opts=s.recommendation.options.filter(o=>o.fits);const i=opts.findIndex(o=>o.id===s.model);await core.chooseModel(opts[(i+1)%opts.length].id);refresh(sel)}
   if(key.return)runStep(id);
  }
  if(id==='job'){
   const n=(s.templates?.length??0)+1;
   if(key.leftArrow)setUi(u=>({...u,tpl:(u.tpl+n-1)%n,sample:0,tryState:null}));
   if(key.rightArrow)setUi(u=>({...u,tpl:(u.tpl+1)%n,sample:0,tryState:null}));
   if(input==='s')setUi(u=>({...u,sample:u.sample+1,tryState:null}));
   if(input==='t')tryIt();
   if(key.return){if(ui.tpl%n===n-1)editPrompt();else{await core.selectTemplate(s.templates[ui.tpl%n].id);flash('✔ Job selected. The agent now uses this prompt and check.');refresh(sel)}}
  }
  if(id==='sokosumi'&&key.return)runStep(id);
  if(id==='sokosumi'&&input==='o'){try{const r=await core.useOrganization();flash(r.pending?`Waiting for a Workspace admin to approve (${r.access})`:`✔ Using ${r.org.name}. Press r on the dashboard to restart services.`)}catch(e){flash('✖ '+e.message)}refresh(sel)}
  if(id==='sokosumi'&&input==='p'){core.usePersonal();flash('Back to the Personal Workspace');refresh(sel)}
  if(id==='pay'){
   const need=s.items?.find(i=>i.status==='input');
   if(key.return){if(need)setUi(u=>({...u,mode:'input',onInput:async v=>{try{await core.setValue(need.input.key,v);flash('✔ Saved. Press enter to continue.')}catch(e){flash('✖ '+e.message)}setUi(x=>({...x,mode:null}));refresh(sel)},onCancel:()=>setUi(x=>({...x,mode:null}))}));else core.runPay().then(r=>{if(r?.error)flash('✖ '+r.error);refresh(sel)})}
   if(input==='f'&&s.wallet?.faucet){openUrl(s.wallet.faucet);flash('Opened the dispenser. Paste your wallet address there.')}
   if(input==='c')setUi(u=>({...u,qr:!u.qr}));
  }
  if(id==='live'){
   if(key.return)runStep(id);
   if(input==='t'){try{const r=await core.sendTestJob(ui.sample);flash(`✔ Test task ${String(r?.id??'').slice(0,8)} sent`);}catch(e){flash('✖ '+e.message)}}
  }
 });

 const Panel={machine:MachinePanel,job:JobPanel,sokosumi:SokosumiPanel,pay:PayPanel,live:LivePanel}[steps[sel]?.id];
 return html`<${Box} flexDirection="column" width=${size.w} height=${Math.max(10,size.h-1)}>
  <${Header} statuses=${statuses} view=${view} mock=${core.mock}/>
  ${view==='wizard'?html`<${Box} flexGrow=${1}>
   <${Rail} steps=${steps} statuses=${statuses} sel=${sel}/>
   <${Box} flexDirection="column" flexGrow=${1} borderStyle="round" borderColor=${C.accent} paddingX=${1}>
    <${Text} bold color=${C.text}>${sel+1}. ${steps[sel].title}  ${s.status==='running'?html`<${Spinner}/>`:null}</${Text}>
    ${s.error?html`<${Text} color=${C.fail}>${s.error}</${Text}>`:null}
    ${statuses.length?html`<${Panel} s=${s} ui=${ui} qr=${qr}/>`:html`<${Text} color=${C.dim}><${Spinner}/> checking your machine…</${Text}>`}
   </${Box}>
  </${Box}>`:view==='dashboard'?html`<${Box} flexGrow=${1} flexDirection="column"><${Dashboard} jobs=${jobs} earn=${core.earnings(jobs)} health=${health} sel=${jsel}/></${Box}>`:html`<${Logs} core=${core} rows=${Math.max(5,size.h-9)}/>`}
  ${prog?html`<${Box} paddingX=${1}><${ProgressBar} pct=${prog.pct??0} label=${prog.label}/></${Box}>`:null}
  ${msg?html`<${Box} paddingX=${1}><${Text} color=${msg.startsWith('✖')?C.fail:C.ok}>${msg}</${Text}></${Box}>`:null}
  <${Box} paddingX=${1}><${Text} color=${C.dim} wrap="truncate-end">${last?`[${last.source}] ${last.line}`:' '}</${Text}></${Box}>
  <${Box} paddingX=${1}><${Text} color=${C.dim}>↑/↓ steps · d dashboard · l logs · q quit</${Text}></${Box}>
 </${Box}>`;
}

// Alternate screen buffer: the UI owns the whole window and the shell comes back untouched on exit.
export function start(core){
 const tty=process.stdout.isTTY;
 const leave=()=>{if(tty)process.stdout.write('\u001b[?1049l\u001b[?25h')};
 if(tty)process.stdout.write('\u001b[?1049h\u001b[H');
 process.once('exit',leave);
 const app=render(html`<${App} core=${core}/>`,{exitOnCtrlC:false});
 app.waitUntilExit().then(leave,leave);
 return app;
}
