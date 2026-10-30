import {bus,log,recentLogs} from './events.mjs';
import {readEnv,writeEnv,ENV_FILE} from './config.mjs';
import {existsSync} from 'node:fs';
import * as machine from './steps/machine.mjs';
import * as job from './steps/job.mjs';
import * as sokosumi from './steps/sokosumi.mjs';
import * as pay from './steps/pay.mjs';
import * as live from './steps/live.mjs';
import * as sup from './supervisor.mjs';
import {listJobs,earnings} from './jobs.mjs';
import {health} from './health.mjs';
import {wallet} from '../pay/wallet.mjs';
import {streamChat} from './backends/openai.mjs';
import {loadTemplate} from '../templates/index.mjs';
import {check} from '../checks/index.mjs';
import {verifyResult} from '../provenance.mjs';
// The only interface the TUI uses. Mirrors core/mock.mjs.
export const STEPS=[machine,job,sokosumi,pay,live];
const running=new Set(),errors={};
// Values a user may pass as environment variables instead of typing them in the UI (CI, servers).
const PASSTHROUGH=['BLOCKFROST_API_KEY_PREPROD','AGENT_AUTHOR'];
export function createCore(){
 // Nobody edits coworker/.env by hand: create it from .env.example and fill it from the wizard.
 const env=existsSync(ENV_FILE())?readEnv():{};
 const fromProcess=Object.fromEntries(PASSTHROUGH.filter(k=>process.env[k]&&!env[k]).map(k=>[k,process.env[k]]));
 if(!existsSync(ENV_FILE())||Object.keys(fromProcess).length)writeEnv(fromProcess);
 async function status(id){const m=STEPS.find(s=>s.id===id);try{const s=await m.status();return running.has(id)?{...s,status:'running'}:errors[id]&&s.status!=='ok'?{...s,status:'fail',error:errors[id]}:s}catch(e){return {id,title:m.title,status:'fail',items:[],error:e.message}}}
 async function runStep(id,opts){
  const m=STEPS.find(s=>s.id===id);if(running.has(id))return;
  running.add(id);delete errors[id];bus.emit('step',{id,status:'running'});
  try{const s=await m.run(opts);running.delete(id);bus.emit('step',{id,status:s.status});return s}
  catch(e){running.delete(id);errors[id]=e.message;log(id,e.message,'error');bus.emit('step',{id,status:'fail',error:e.message});return {id,status:'fail',error:e.message}}
 }
 return {
  mock:false,bus,recentLogs,
  steps:STEPS.map(({id,title})=>({id,title})),
  status,statusAll:()=>Promise.all(STEPS.map(s=>status(s.id))),
  runStep,
  chooseModel:machine.chooseModel,useExternal:machine.useExternal,
  selectTemplate:job.select,createTemplate:job.createCustom,
  login:sokosumi.login,useOrganization:sokosumi.useOrganization,usePersonal:sokosumi.usePersonal,
  setValue:pay.setValue,
  runPay:()=>runStep('pay',{startMps:()=>sup.start('mps')}),
  sendTestJob:live.sendTestJob,
  // Try a template on the model directly (bypasses Sokosumi). Streams deltas as 'try' events.
  async tryIt(templateId,input){
   const t=loadTemplate(templateId);const env=readEnv();
   let out='';const t0=Date.now();
   for await(const d of streamChat({baseURL:env.ZAI_BASE_URL,apiKey:env.ZAI_API_KEY,model:env.ZAI_MODEL,system:t.prompt,user:input,json:t.check?.type!=='none'&&t.check?.type!=='regex'&&t.check?.type!=='length'})){out+=d;bus.emit('try',{delta:d,text:out});}
   const verdict=check(t.check??{type:'none'},input,out);
   job.recordTry(templateId,t.samples.find(s=>s.text===input)?.name??'your input',verdict.pass);
   return {output:out,check:verdict,seconds:+((Date.now()-t0)/1000).toFixed(1)};
  },
  jobs:listJobs,earnings,wallet,health,
  services:sup.services,startServices:sup.startAll,stopServices:sup.stopAll,restartService:sup.restart,
  verify:verifyResult,
  env:readEnv,
 };
}
