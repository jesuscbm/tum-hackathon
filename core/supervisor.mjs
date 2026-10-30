import {spawn} from 'node:child_process';
import {existsSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {COWORKER_DIR} from './paths.mjs';
import {readEnv} from './config.mjs';
import {bus,log} from './events.mjs';
import * as mps from '../pay/mps.mjs';
// Keeps the coworker processes alive. Never starts a second copy of something already running.
const ENVF=['--env-file-if-exists=.env'];
const SERVICES={
 agent:{label:'Agent (Eve)',cmd:()=>({cmd:process.execPath,args:[...ENVF,'start.mjs'],cwd:COWORKER_DIR}),probe:async()=>{const u=readEnv().EVE_URL||'http://127.0.0.1:21949';try{await fetch(u,{signal:AbortSignal.timeout(1500)});return true}catch{return false}}},
 worker:{label:'Worker',needs:['agent'],cmd:()=>({cmd:process.execPath,args:[...ENVF,'worker.mjs'],cwd:COWORKER_DIR}),probe:async()=>{const f=join(COWORKER_DIR,'.local','worker.lock');if(!existsSync(f))return false;try{process.kill(Number(readFileSync(f,'utf8')),0);return true}catch{return false}}},
 api:{label:'Agent API (MIP-003)',paidOnly:true,cmd:()=>({cmd:process.execPath,args:[...ENVF,'--env-file-if-exists=.local/mps-runtime.env','agent-api.mjs'],cwd:COWORKER_DIR}),probe:async()=>{try{return (await fetch(`http://127.0.0.1:${readEnv().AGENT_API_PORT||21950}/availability`,{signal:AbortSignal.timeout(1500)})).ok}catch{return false}}},
 mps:{label:'Payment service',optional:true,cmd:()=>mps.command(),probe:()=>mps.health()},
};
const state=Object.fromEntries(Object.keys(SERVICES).map(k=>[k,{id:k,label:SERVICES[k].label,status:'stopped',pid:null,restarts:0,external:false}]));
const children={};let stopping=false;
const emit=()=>bus.emit('services',services());
export const services=()=>Object.values(state).map(s=>({...s}));
function set(id,patch){Object.assign(state[id],patch);emit();}
export async function refresh(){
 for(const [id,svc] of Object.entries(SERVICES)){
  if(children[id])continue;
  const up=await svc.probe().catch(()=>false);
  set(id,up?{status:'running',external:true}:{status:'stopped',external:false});
 }
 return services();
}
export async function start(id){
 const svc=SERVICES[id];if(children[id])return;
 if(await svc.probe().catch(()=>false)){set(id,{status:'running',external:true});log(id,'Already running outside lokal; leaving it alone');return;}
 const {cmd,args,cwd,env}=svc.cmd();
 if(!existsSync(cwd))throw new Error(`${svc.label}: ${cwd} not found`);
 set(id,{status:'starting',external:false});
 const child=spawn(cmd,args,{cwd,stdio:['ignore','pipe','pipe'],env:{...process.env,...(env??{})}});
 children[id]=child;set(id,{pid:child.pid});
 const pipe=d=>{for(const l of String(d).split('\n'))if(l.trim()){log(id,l);if(state[id].status==='starting')set(id,{status:'running'});}};
 child.stdout.on('data',pipe);child.stderr.on('data',pipe);
 setTimeout(()=>{if(children[id]===child&&state[id].status==='starting')set(id,{status:'running'})},3000);
 child.on('exit',code=>{
  delete children[id];
  if(stopping){set(id,{status:'stopped',pid:null});return;}
  const r=state[id].restarts+1;
  set(id,{status:r>5?'failed':'restarting',pid:null,restarts:r,lastExit:code});
  log(id,`exited with code ${code}`,'error');
  if(r<=5)setTimeout(()=>start(id).catch(e=>log(id,e.message,'error')),Math.min(30000,1000*2**r));
 });
}
export async function startAll({paid=readEnv().PAID_TASKS_ENABLED==='true'}={}){
 stopping=false;
 if(paid&&mps.status&&(await mps.status()).installed)await start('mps');
 await start('agent');
 await new Promise(r=>setTimeout(r,4000));
 await start('worker');
 if(paid)await start('api');
}
export async function stopAll(){
 stopping=true;
 for(const [id,c] of Object.entries(children)){c.kill('SIGTERM');set(id,{status:'stopping'});}
 await new Promise(r=>setTimeout(r,1500));
 for(const c of Object.values(children))try{c.kill('SIGKILL')}catch{}
}
export async function restart(id){if(children[id]){stopping=true;children[id].kill('SIGTERM');await new Promise(r=>setTimeout(r,1500));stopping=false;}state[id].restarts=0;await start(id);}
