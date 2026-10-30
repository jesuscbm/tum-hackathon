import {which} from '../exec.mjs';
import * as sk from '../sokosumi.mjs';
import {readEnv,writeEnv} from '../config.mjs';
import * as mps from '../../pay/mps.mjs';
import * as reg from '../../pay/register.mjs';
import {wallet,requestTestAda} from '../../pay/wallet.mjs';
import {loadConfig,saveConfig} from '../config.mjs';
import {log} from '../events.mjs';
// Step 4: own payment service + selling wallet + registry entry. Every sub-step is idempotent.
export const id='pay',title='Get paid';
let lastPoll=0;
// Blockfrost project ids carry their network as a prefix; a mainnet key silently breaks every preprod call.
const bfOk=k=>!!k&&k.startsWith('preprod');
const BF_INPUT={key:'BLOCKFROST_API_KEY_PREPROD',label:'Blockfrost project id for Cardano PREPROD (starts with "preprod")',secret:true};
function bfItem(k){
 if(!k)return {label:'Blockfrost key',status:'input',detail:'free key from blockfrost.io: create a project on Cardano preprod',input:BF_INPUT};
 if(!bfOk(k))return {label:'Blockfrost key',status:'input',detail:`this is a ${k.match(/^[a-z]+/)?.[0]??'non-preprod'} key: create a Cardano preprod project and paste its id`,input:BF_INPUT};
 return {label:'Blockfrost key',status:'ok',detail:'preprod key set'};
}
export async function status(){
 const env=readEnv();
 const [docker,m,w]=await Promise.all([which('docker'),mps.status(),wallet()]);
 // While a registration is pending, refresh it from the registry at most every 20 s (the UI polls status()).
 let r=reg.status();
 if(r.registered&&!r.confirmed&&Date.now()-lastPoll>20000){lastPoll=Date.now();r=await reg.poll().catch(()=>r);}
 const funded=(w.balance?.ada??0)>=5;
 const items=[
  bfItem(env.BLOCKFROST_API_KEY_PREPROD),
  {label:'Author name',status:env.AGENT_AUTHOR?'ok':'todo',detail:env.AGENT_AUTHOR||'defaults to your Sokosumi Vendor name (public on the registry)'},
  {label:'Docker',status:docker?'ok':'action',detail:docker?'found':'needed for the payment database',command:docker?undefined:'https://docs.docker.com/get-docker/'},
  {label:'Payment service',status:m.up?'ok':'todo',detail:m.up?m.url:m.installed?'installed, not running':m.prepared?'prepared; wallets are created once the Blockfrost key is set':'lokAl installs your own instance (Postgres in Docker)'},
  {label:'Selling wallet',status:w.address?(funded?'ok':'action'):'todo',detail:w.address?`${w.address.slice(0,20)}…${w.address.slice(-6)} · ${w.balance?`${w.balance.ada} tADA`:w.error??'balance unknown'}`:'created by the payment service',command:w.address&&!funded?w.faucet:undefined},
  {label:'Registry',status:r.confirmed?'ok':r.registered?'running':'todo',detail:r.confirmed?`agent ${r.agentIdentifier?.slice(0,16)}…`:r.registered?`state: ${r.state??'pending'}`:'registers your agent on Cardano preprod',tx:r.txHash},
  {label:'Paid tasks',status:env.PAID_TASKS_ENABLED==='true'?'ok':r.confirmed?'action':'todo',detail:env.PAID_TASKS_ENABLED==='true'?'enabled':r.confirmed?'registered: press enter to enable paid tasks':'enabled after registration confirms (a few minutes on preprod)'},
 ];
 const done=items.every(i=>i.status==='ok');
 return {id,title,status:done?'ok':'todo',items,wallet:w,registration:r,mps:m};
}
export async function setValue(key,value){const v=value.trim();if(key==='BLOCKFROST_API_KEY_PREPROD'&&!bfOk(v))throw new Error('That is not a preprod key (it must start with "preprod").');writeEnv({[key]:v});return status();}
// Runs as far as it can; stops (without error) at the next human action.
export async function run({startMps}={}){
 let s=await status();
 if(!s.mps.prepared)await mps.prepare(); // no secrets needed: runs while the user fetches a Blockfrost key
 s=await status();
 if(s.items.some(i=>i.status==='input'))return s;
 if(!readEnv().AGENT_AUTHOR){const v=await sk.vendor().catch(()=>null);writeEnv({AGENT_AUTHOR:v?.name??'lokal'});}
 if(!s.mps.installed)await mps.seed();
 if(!(await mps.health())){if(startMps)await startMps();for(let i=0;i<60&&!(await mps.health());i++)await new Promise(r=>setTimeout(r,2000));}
 if(!(await mps.health()))throw new Error('Payment service did not come up; see the mps log');
 await mps.syncBlockfrostKey();
 const ps=await mps.recordPaymentState();
 s=await status();
 if(s.items.find(i=>i.label==='Selling wallet').status!=='ok'){
  // Ask the dispenser once per address, then wait for the funds to land (about a minute on preprod).
  const cfg=loadConfig();
  if(cfg.faucetRequested!==ps.sellerAddress){const t=await requestTestAda(ps.sellerAddress);saveConfig({faucetRequested:ps.sellerAddress,faucetTx:t.txHash});log('pay',`Test ADA requested: ${t.url}`);}
  for(let i=0;i<40;i++){await new Promise(r=>setTimeout(r,6000));s=await status();if(s.items.find(i=>i.label==='Selling wallet').status==='ok')break;}
  if(s.items.find(i=>i.label==='Selling wallet').status!=='ok')return s;
 }
 const r=reg.status();
 if(!r.confirmed){await reg.register();s=await status();if(!s.registration.confirmed)return s;}
 if(reg.status().complete&&readEnv().PAID_TASKS_ENABLED!=='true')writeEnv({PAID_TASKS_ENABLED:'true'});
 return status();
}
export const pollRegistration=()=>reg.poll();
