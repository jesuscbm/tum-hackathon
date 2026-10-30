import {spawn} from 'node:child_process';
import {existsSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {bus,log} from './events.mjs';
import * as cw from './coworkers.mjs';
import * as mps from '../pay/mps.mjs';
// Keeps the coworker processes alive. Never starts a second copy of something already running.
// Service ids: agent, worker, api (main Coworker), agent@<id>, worker@<id>, api@<id> (extra ones), mps (shared).
const ENVF=['--env-file-if-exists=.env'];
const KINDS={
 agent:{label:'Agent (Eve)',cmd:c=>({cmd:process.execPath,args:[...ENVF,'start.mjs']}),probe:async c=>{try{await fetch(c.env.EVE_URL||`http://127.0.0.1:${c.ports.eve}`,{signal:AbortSignal.timeout(1500)});return true}catch{return false}}},
 worker:{label:'Worker',cmd:c=>({cmd:process.execPath,args:[...ENVF,'worker.mjs']}),probe:async c=>{const f=join(c.dir,'.local','worker.lock');if(!existsSync(f))return false;try{process.kill(Number(readFileSync(f,'utf8')),0);return true}catch{return false}}},
 api:{label:'Agent API (MIP-003)',paidOnly:true,cmd:c=>({cmd:process.execPath,args:[...ENVF,'--env-file-if-exists=.local/mps-runtime.env','agent-api.mjs']}),probe:async c=>{try{return (await fetch(`http://127.0.0.1:${c.ports.api}/availability`,{signal:AbortSignal.timeout(1500)})).ok}catch{return false}}},
};
const MPS={label:'Payment service',preStart:async()=>{await mps.ensureDb();await mps.clearStaleLocks();await mps.skipContractHistory()},cmd:()=>mps.command(),probe:()=>mps.health()};
export const serviceId=(kind,c)=>c.primary?kind:`${kind}@${c.id}`;
function resolve(id){
 if(id==='mps')return {...MPS,id,kind:'mps',coworker:null};
 const [kind,cid='main']=id.split('@');const c=cw.get(cid);const k=KINDS[kind];
 if(!k||!c)return null;
 return {id,kind,coworker:c.id,label:c.primary?k.label:`${k.label} · ${c.name}`,paidOnly:k.paidOnly,probe:()=>k.probe(c),cmd:async()=>({...k.cmd(c),cwd:c.dir,env:cw.sharedEnv(c)})};
}
const known=()=>['mps',...cw.list().flatMap(c=>Object.keys(KINDS).map(k=>serviceId(k,c)))];
const state={};
const entry=id=>{const r=resolve(id);return state[id]??={id,kind:r?.kind??id,coworker:r?.coworker??null,label:r?.label??id,status:'stopped',pid:null,restarts:0,external:false,startedAt:null}};
const children={};let stopping=false;const stoppingOne=new Set();
// Children run in their own process group; signal the group so grandchildren (pnpm → tsx → node) stop too.
const killTree=(c,sig)=>{try{process.kill(-c.pid,sig)}catch{try{c.kill(sig)}catch{}}};
process.once('exit',()=>{for(const c of Object.values(children))killTree(c,'SIGTERM')});
const emit=()=>bus.emit('services',services());
export const services=()=>{const ids=known();for(const id of ids)entry(id);return Object.values(state).filter(s=>children[s.id]||ids.includes(s.id)).map(s=>({...s}))};
function set(id,patch){Object.assign(entry(id),patch);emit();}
export async function refresh(){
 for(const id of known()){
  if(children[id])continue;
  const r=resolve(id);const up=await r.probe().catch(()=>false);
  set(id,up?{status:'running',external:true}:{status:'stopped',external:false,pid:null});
 }
 return services();
}
// In-flight starts: a second start() of the same service while the first is still probing must not spawn twice.
const pending=new Map();
export function start(id){
 if(children[id])return Promise.resolve();
 if(!pending.has(id))pending.set(id,spawnService(id).finally(()=>pending.delete(id)));
 return pending.get(id);
}
async function spawnService(id){
 const svc=resolve(id);if(!svc)throw new Error(`Unknown service ${id}`);
 if(await svc.probe().catch(()=>false)){set(id,{status:'running',external:true});log(id,'Already running outside lokAl; leaving it alone');return;}
 await svc.preStart?.();
 const {cmd,args,cwd,env}=await svc.cmd();
 if(!existsSync(cwd))throw new Error(`${svc.label}: ${cwd} not found`);
 set(id,{status:'starting',external:false,label:svc.label});
 const child=spawn(cmd,args,{cwd,stdio:['ignore','pipe','pipe'],env:{...process.env,...(env??{})},detached:true});
 children[id]=child;set(id,{pid:child.pid,startedAt:Date.now()});
 // The payment service logs a heartbeat every second; keep it in the log file, out of the UI.
 const pipe=d=>{for(const l of String(d).split('\n'))if(l.trim()){log(id,l,id==='mps'&&!/error|warn|fail/i.test(l)?'debug':'info');if(state[id].status==='starting')set(id,{status:'running'});}};
 child.stdout.on('data',pipe);child.stderr.on('data',pipe);
 child.on('error',e=>log(id,e.message,'error'));
 setTimeout(()=>{if(children[id]===child&&state[id].status==='starting')set(id,{status:'running'})},3000);
 child.on('exit',code=>{
  delete children[id];
  if(stopping||stoppingOne.has(id)){stoppingOne.delete(id);set(id,{status:'stopped',pid:null,startedAt:null});return;}
  const r=state[id].restarts+1;
  set(id,{status:r>5?'failed':'restarting',pid:null,startedAt:null,restarts:r,lastExit:code});
  log(id,`exited with code ${code}`,'error');
  if(r<=5)setTimeout(()=>{if(!stopping&&resolve(id))start(id).catch(e=>log(id,e.message,'error'))},Math.min(30000,1000*2**r));
 });
}
// One startAll at a time (lokald's own start and a UI request can overlap).
let starting=null;
export function startAll(){return starting??=startAllNow().finally(()=>{starting=null})}
async function startAllNow(){
 stopping=false;
 const all=cw.list();
 if(all.some(c=>c.paid)&&(await mps.status()).installed)await start('mps').catch(e=>log('mps',e.message,'error'));
 for(const c of all)if(c.coworkerId)await start(serviceId('agent',c)).catch(e=>log(serviceId('agent',c),e.message,'error'));
 await new Promise(r=>setTimeout(r,4000));
 for(const c of all){
  if(!c.coworkerId){log('supervisor',`${c.name}: no Sokosumi Coworker yet, not starting it`);continue;}
  await start(serviceId('worker',c)).catch(e=>log(serviceId('worker',c),e.message,'error'));
  if(c.paid)await start(serviceId('api',c)).catch(e=>log(serviceId('api',c),e.message,'error'));
 }
}
async function stopIds(ids){
 for(const id of ids)if(children[id]){stoppingOne.add(id);killTree(children[id],'SIGTERM');set(id,{status:'stopping'});}
 for(let i=0;i<40&&ids.some(id=>children[id]);i++)await new Promise(r=>setTimeout(r,250));
 for(const id of ids)if(children[id])killTree(children[id],'SIGKILL');
}
export async function stopAll(){stopping=true;await stopIds(Object.keys(children));}
// Stops one Coworker's processes (before removing it) and forgets them.
export async function stopCoworker(cid){
 const ids=Object.keys(state).filter(id=>state[id].coworker===cid);
 await stopIds(ids);for(const id of ids)delete state[id];emit();
}
export async function restart(id){if(children[id])await stopIds([id]);entry(id).restarts=0;await start(id);}
