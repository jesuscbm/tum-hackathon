import * as ollama from './runtime/ollama.mjs';
import * as sup from './supervisor.mjs';
import * as mps from '../pay/mps.mjs';
import * as reg from '../pay/register.mjs';
import {wallet} from '../pay/wallet.mjs';
import {readEnv} from './config.mjs';
import * as sk from './sokosumi.mjs';
// One dot per layer for the dashboard. Each check is cheap and never throws.
let skCache={at:0,ok:null};
export async function health(){
 const env=readEnv();
 const svc=Object.fromEntries((await sup.refresh()).map(s=>[s.id,s]));
 const modelOk=env.ZAI_BASE_URL?.includes(':11434')?!!(await ollama.version()):await fetch(env.ZAI_BASE_URL+'/models',{headers:{authorization:`Bearer ${env.ZAI_API_KEY}`},signal:AbortSignal.timeout(3000)}).then(r=>r.ok,()=>false);
 if(Date.now()-skCache.at>60000){skCache={at:Date.now(),ok:!!(await sk.whoami().catch(()=>null))};}
 const paid=env.PAID_TASKS_ENABLED==='true';
 const w=paid?await wallet():null;const r=reg.status();
 const dot=(id,label,ok,fix)=>({id,label,status:ok===null?'off':ok?'ok':'fail',fix});
 return [
  dot('model','Model',modelOk,'Model server is down. Run step 1 again or `ollama serve`.'),
  dot('agent','Agent',svc.agent.status==='running','Agent stopped. Press r to restart services.'),
  dot('worker','Worker',svc.worker.status==='running','Worker stopped. Press r to restart services.'),
  dot('sokosumi','Sokosumi',skCache.ok,'Signed out. Run `sokosumi --preprod auth login`.'),
  dot('mps','Payments',paid?await mps.health():null,'Payment service down. Open step 4.'),
  dot('wallet','Wallet',paid?(w?.balance?.ada??0)>=1:null,'Selling wallet needs test ADA from the dispenser.'),
  dot('registry','Registry',paid?r.confirmed:null,'Registration not confirmed yet.'),
 ];
}
