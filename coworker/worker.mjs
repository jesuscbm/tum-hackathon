import {execFileSync} from 'node:child_process';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {acquireWorkerLock} from './worker-lock.mjs';
import {answer,client} from './client.mjs';
import {reply} from './comments.mjs';
import {createPaidAdapter,isPaidReady} from './paid-task.mjs';
import {taskTarget,isTaskForTarget} from './task-target.mjs';
import {gate} from './lokal-gate.mjs';
import {networkOf} from '../core/network.mjs';
// lokal: paid Sokosumi Tasks use the Coworker runtime, which Sokosumi CLI 1.1.0 offers on preprod only.
// On mainnet, paid jobs come in through the MIP-003 agent API instead; Tasks here are answered free.
const paidTasks=process.env.PAID_TASKS_ENABLED==='true'&&networkOf().test;
// Paid stages that need no more work: skip them instead of calling Sokosumi for each on every poll.
const DONE=new Set(['settled','check-failed']);
let waitLogged=false;
const gated=gate(answer);
const target=taskTarget();
const id=target.coworkerId;
const releaseLock=acquireWorkerLock();
process.once('exit',releaseLock);
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{releaseLock();process.exit(0)});
function cli(args){return JSON.parse(execFileSync('sokosumi',['--preprod',...args,'--json'],{encoding:'utf8',timeout:30000,maxBuffer:4*1024*1024}));}
await client.health();
const paid=await createPaidAdapter({target,answer:gated,save:async(taskId,state)=>writeFileSync(`.local/${taskId}.json`,JSON.stringify(state),{mode:0o600})});
console.log('Continuous worker running',process.pid);
while(true){
 try{
 const tasks=cli(['tasks','list','--coworker-id',id,...target.taskArgs]).tasks;
 for(const t of tasks.filter(t=>isTaskForTarget(t,target))){
 try{
 const journal=`.local/${t.id}.json`,resultFile=`.local/${t.id}.txt`;
 let state=existsSync(journal)?JSON.parse(readFileSync(journal,'utf8')):{};
 if(t.status==='READY'&&!state.phase){writeFileSync(journal,JSON.stringify({phase:'starting'}),{mode:0o600});const started=cli(['runtime','start',t.id,...target.runtimeArgs,'--coworker-id',id]);state={phase:'started',input:started.description};writeFileSync(journal,JSON.stringify(state),{mode:0o600});}
 if(state.paid&&!paidTasks)continue;
 if(DONE.has(state.paid?.stage)){if(state.phase==='completed')await reply(t);continue;}
 // lokal: with paid Tasks on, never fall back to a free answer while the registration is not ready yet.
 if(state.phase==='started'&&!state.paid&&paidTasks&&!isPaidReady()){if(!waitLogged){console.log('Paid Tasks are on, but the registration is not confirmed yet: new Tasks wait');waitLogged=true;}continue;}
 if(state.paid||(state.phase==='started'&&paidTasks&&isPaidReady())){state=await paid.advance(t,state);if(state.phase==='completed')await reply(t);continue;}
 if(state.phase==='started'){
 writeFileSync(journal,JSON.stringify({...state,phase:'model-pending'}),{mode:0o600});
 const gatedResult=await gated(state.input,`.local/${t.id}-session.json`);const result=gatedResult.text;
 writeFileSync(resultFile,result,{mode:0o600});state={...state,check:gatedResult.check,resultHash:gatedResult.hash};state={...state,phase:'result-saved'};writeFileSync(journal,JSON.stringify(state),{mode:0o600});
 }
 if(state.phase==='result-saved'){
 writeFileSync(journal,JSON.stringify({...state,phase:'complete-pending'}),{mode:0o600});
 const completed=cli(['runtime','complete',t.id,...target.runtimeArgs,'--coworker-id',id,'--result-file',resultFile]);
 writeFileSync(journal,JSON.stringify({...state,phase:'completed',completion:completed}),{mode:0o600});console.log('Completed',t.id);
 }
 if(state.phase==='completed')await reply(t);
 }catch(e){console.error('Task blocked',t.id,e.message.slice(0,200))}
 }
 }catch(e){console.error('Polling read failed',e.message.slice(0,200))}
 await new Promise(r=>setTimeout(r,5000));
}
