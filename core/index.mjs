import {bus,log,recentLogs,ingest} from './events.mjs';
import {readEnv,writeEnv,ENV_FILE} from './config.mjs';
import {existsSync} from 'node:fs';
import * as machine from './steps/machine.mjs';
import * as job from './steps/job.mjs';
import * as sokosumi from './steps/sokosumi.mjs';
import * as pay from './steps/pay.mjs';
import * as live from './steps/live.mjs';
import * as services from './services.mjs';
import * as daemon from './daemon.mjs';
import * as cw from './coworkers.mjs';
import {listJobs,earnings} from './jobs.mjs';
import {health} from './health.mjs';
import {resources} from './resources.mjs';
import {info} from './info.mjs';
import {setupHeadless} from './vault.mjs';
import {networkOf} from './network.mjs';
import {wallet,exportMnemonic} from '../pay/wallet.mjs';
import {streamChat} from './backends/openai.mjs';
import {loadTemplate,listTemplates} from '../templates/index.mjs';
import {check} from '../checks/index.mjs';
import {verifyResult} from '../provenance.mjs';
// The only interface the TUI uses. Mirrors core/mock.mjs.
export const STEPS=[machine,job,sokosumi,pay,live];
const running=new Set(),errors={};
// Values a user may pass as environment variables instead of typing them in the UI (CI, servers).
// After a job change the running agent and worker still hold the old prompt and check: restart the ones lokald runs.
async function applyJob(cid='main',kinds=['agent','worker']){
 if(!(await daemon.status()).running)return;
 const ids=kinds.map(k=>cid==='main'?k:`${k}@${cid}`);
 const up=(await services.list()).filter(s=>ids.includes(s.id)&&s.status==='running'&&!s.external).map(s=>s.id);
 for(const id of up)await services.restart(id);
 if(up.length)log('job',`Restarted ${up.join(', ')} so ${cid==='main'?'they use':`${cid} uses`} the new job`);
}
const PASSTHROUGH=['BLOCKFROST_API_KEY_PREPROD','BLOCKFROST_API_KEY_MAINNET','AGENT_AUTHOR','AGENT_PUBLIC_URL'];
export function createCore(){
 const {headless,vault}=setupHeadless();
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
 // Wraps a one-off action so its error lands in the step's status like runStep's.
 const guarded=(id,f)=>async(...a)=>{delete errors[id];try{return await f(...a)}catch(e){errors[id]=e.message;log(id,e.message,'error');throw e}};
 return {
  mock:false,bus,recentLogs,headless,vault,
  steps:STEPS.map(({id,title})=>({id,title})),
  status,statusAll:()=>Promise.all(STEPS.map(s=>status(s.id))),
  runStep,
  // step 1: model backends
  chooseModel:machine.chooseModel,useExternal:guarded('machine',machine.useExternal),useLlamacpp:guarded('machine',machine.useLlamacpp),useOllama:machine.useOllama,
  // step 2: jobs and prompts
  async selectTemplate(id){const s=await job.select(id);await applyJob();return s},
  async createTemplate(t){const s=await job.createCustom(t);await applyJob();return s},
  async importPrompt(f){const s=await job.importPrompt(f);await applyJob();return s},
  async setPrice(v,cid='main'){const c=cw.get(cid);if(!c)throw new Error(`No Coworker ${cid}`);const p=job.setPrice(v,c.dir);await applyJob(cid,['worker','api']);return p},
  templates:()=>listTemplates().map(({prompt,samples,...t})=>t),
  // step 3: Sokosumi (browser, or API key / sign-in link when headless)
  login:sokosumi.login,loginWithKey:sokosumi.loginWithKey,useWorkspace:sokosumi.useWorkspace,
  // step 4: payments
  setValue:pay.setValue,setNetwork:pay.setNetwork,network:()=>networkOf(readEnv()).id,
  runPay:()=>runStep('pay',{startMps:()=>services.start('mps'),restartMps:()=>services.restart('mps')}),
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
  jobs:listJobs,earnings,wallet,health,info,exportWallet:exportMnemonic,
  async resources(){return resources(await services.list().catch(()=>[]))},
  // background services (lokald)
  services:services.list,startServices:services.startAll,stopServices:services.stopAll,restartService:services.restart,
  daemon:daemon.status,stopDaemon:daemon.shutdown,
  // Live events from lokald onto this process's bus (logs, service changes). Returns a stop function.
  async attach(){
   const d=await daemon.status();
   if(d.running)for(const e of await daemon.call('/logs?n=200').catch(()=>[]))ingest(e);
   return daemon.subscribe(e=>{if(e.type==='log')ingest(e.data);else bus.emit(e.type,e.data)});
  },
  // Coworkers: several prompts/jobs served side by side
  coworkers:()=>cw.list().map(({env,...c})=>c),
  async addCoworker(opts){const c=await cw.add(opts);if(c.coworkerId&&(await daemon.status()).running)await services.startAll();const {env,...rest}=c;return rest;},
  async removeCoworker(id,opts){await services.stopCoworker(id);return cw.remove(id,opts).map(({env,...c})=>c);},
  async setCoworkerTemplate(id,t){if(id==='main')await job.select(t);else cw.setTemplate(id,t);await applyJob(id);const {env,...c}=cw.get(id);return c;},
  registerCoworkerOnSokosumi:cw.registerOnSokosumi,registerCoworkerPaid:pay.registerCoworker,
  verify:verifyResult,
  env:readEnv,
 };
}
