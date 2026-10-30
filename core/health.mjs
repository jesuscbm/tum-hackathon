import * as ollama from './runtime/ollama.mjs';
import * as services from './services.mjs';
import * as daemon from './daemon.mjs';
import * as mps from '../pay/mps.mjs';
import * as reg from '../pay/register.mjs';
import {wallet} from '../pay/wallet.mjs';
import {readEnv} from './config.mjs';
import {networkOf} from './network.mjs';
import * as cw from './coworkers.mjs';
import * as sk from './sokosumi.mjs';
// One entry per layer for the dashboard's health lights. Each check is cheap and never throws.
// status: ok | warn (partly working) | fail | off (not enabled).
const cache={};
async function cached(key,ms,f){const c=cache[key];if(c&&Date.now()-c.at<ms)return c.v;const v=await f().catch(()=>null);cache[key]={at:Date.now(),v};return v;}
async function modelHealth(env){
 if(!env.ZAI_BASE_URL)return {ok:false,detail:'no model configured',fix:'Run setup step 1.'};
 const base=env.ZAI_BASE_URL.replace(/\/$/,'');
 if(base.includes(':11434')){const v=await ollama.version();return v?{ok:true,detail:`Ollama ${v} · ${env.ZAI_MODEL}`}:{ok:false,detail:'Ollama not answering',fix:'Run setup step 1 again (it starts Ollama), or `ollama serve`.'};}
 // Cloud and other OpenAI-compatible endpoints: reachable + key accepted is all we can know.
 try{
  const r=await fetch(base+'/models',{headers:{authorization:`Bearer ${env.ZAI_API_KEY}`},signal:AbortSignal.timeout(5000)});
  if(r.status===401||r.status===403)return {ok:false,detail:`${new URL(base).host} rejected the API key`,fix:'Set a valid key in setup step 1 (b → API).'};
  return {ok:r.status<500,detail:`${new URL(base).host} · ${env.ZAI_MODEL}`,fix:'The model endpoint returns server errors.'};
 }catch{return {ok:false,detail:`${base} unreachable`,fix:'Check the endpoint URL in setup step 1, or start the model server.'}}
}
const uptime=ms=>{const s=Math.floor(ms/1000);return s<90?`${s}s`:s<5400?`${Math.round(s/60)}m`:`${(s/3600).toFixed(1)}h`;};
// Several Coworkers share one limb: ok when all run, warn when some do.
function group(svcs,kind,want){
 const xs=svcs.filter(s=>s.kind===kind&&want(s));
 if(!xs.length)return {status:'off',detail:'not enabled'};
 const up=xs.filter(s=>s.status==='running');
 const st=up.length===xs.length?'ok':up.length?'warn':'fail';
 const one=xs.length===1?xs[0]:null;
 const detail=one?(one.status==='running'?`running${one.startedAt?` ${uptime(Date.now()-one.startedAt)}`:''}${one.external?' (outside lokAl)':''}${one.restarts?` · ${one.restarts} restarts`:''}`:one.status):`${up.length}/${xs.length} running`;
 return {status:st,detail,pids:xs.map(s=>s.pid).filter(Boolean)};
}
export async function health(){
 const env=readEnv();const net=networkOf(env);
 const all=cw.list();const live=new Set(all.filter(c=>c.coworkerId).map(c=>c.id));const paidCw=new Set(all.filter(c=>c.paid).map(c=>c.id));
 const [svcs,d,model,user]=await Promise.all([services.list(),daemon.status(),cached('model',15000,()=>modelHealth(env)),cached('sk',60000,()=>sk.whoami())]);
 const paid=paidCw.size>0;
 const [mpsUp,w]=paid?await Promise.all([mps.health(),cached('wallet',30000,()=>wallet())]):[null,null];
 const r=reg.status();
 const part=(id,label,role,status,detail,fix,extra={})=>({id,label,role,status,detail,fix,...extra});
 const g=kind=>group(svcs,kind,s=>live.has(s.coworker??'main')&&(kind!=='api'||paidCw.has(s.coworker??'main')));
 const agent=g('agent'),worker=g('worker'),api=g('api');
 const ada=w?.balance?.ada;
 return [
  part('model','Model','thinks: answers every job',model?.ok?'ok':'fail',model?.detail??'unknown',model?.fix),
  part('agent','Agent','Eve: runs the prompt on the model',agent.status,agent.detail,'Agent stopped. Press r to restart services.',{pids:agent.pids}),
  part('worker','Worker','takes Sokosumi tasks, checks answers',worker.status,worker.detail,'Worker stopped. Press r to restart services.',{pids:worker.pids}),
  part('api','Agent API','MIP-003: paid jobs from the registry',api.status,api.detail,'Agent API stopped. Press r to restart services.',{pids:api.pids}),
  part('sokosumi','Sokosumi','marketplace where buyers hire you',user===null?'fail':'ok',user?user.email:'signed out','Signed out. Open setup step 3 and sign in.'),
  part('mps','Payments','Masumi payment service (escrow)',paid?(mpsUp?'ok':'fail'):'off',paid?(mpsUp?`up · ${net.name}`:'down'):'paid jobs not enabled','Payment service down. Press r, or open setup step 4.'),
  part('wallet','Wallet','selling wallet: receives the money',paid?(ada==null?'warn':ada>=1?'ok':'fail'):'off',paid?(ada==null?(w?.error??'balance unknown'):`${ada} ${net.coin}${w.balance.usdm?` · ${w.balance.usdm} USDM`:''}`):'—',net.test?'Selling wallet needs test ADA from the dispenser.':'Send a few ADA to the selling wallet (lokal info).'),
  part('registry','Registry','agent identity on Cardano',paid?(r.confirmed?'ok':r.registered?'warn':'fail'):'off',paid?(r.confirmed?`${r.agentIdentifier?.slice(0,12)}…`:r.state??'not registered'):'—','Registration not confirmed yet.'),
  part('daemon','lokald','keeps everything running',d.running?'ok':'fail',d.running?`pid ${d.pid} · up ${uptime(Date.now()-d.startedAt)}`:'not running','Background services are not running. Press r to start them.'),
 ];
}
