import {existsSync,mkdirSync,renameSync,copyFileSync} from 'node:fs';
import {join} from 'node:path';
import {which} from '../exec.mjs';
import * as sk from '../sokosumi.mjs';
import {readEnv,writeEnv} from '../config.mjs';
import * as mps from '../../pay/mps.mjs';
import * as db from '../../pay/db.mjs';
import * as reg from '../../pay/register.mjs';
import {wallet,requestTestAda} from '../../pay/wallet.mjs';
import {loadConfig,saveConfig} from '../config.mjs';
import {log} from '../events.mjs';
import {NETWORKS,networkOf,bfKeyOk,explorerTx} from '../network.mjs';
import * as cw from '../coworkers.mjs';
// Step 4: own payment service + selling wallet + registry entry. Every sub-step is idempotent.
export const id='pay',title='Get paid';
let lastPoll=0;
function bfItem(net,k){
 const input={key:net.bfKey,label:`Blockfrost project id for Cardano ${net.name.toUpperCase()} (starts with "${net.bfPrefix}")`,secret:true};
 const label=net.test?'Blockfrost key':`Blockfrost ${net.id}`;
 if(!k)return {label,status:'input',detail:`free key from blockfrost.io: create a project on Cardano ${net.id}`,input};
 if(!bfKeyOk(net,k))return {label,status:'input',detail:`this is a ${k.match(/^[a-z]+/)?.[0]??'wrong'} key: create a Cardano ${net.id} project and paste its id`,input};
 return {label,status:'ok',detail:`${net.id} key set`};
}
export async function status(){
 const env=readEnv();const net=networkOf(env);
 const [docker,native,m,w]=await Promise.all([which('docker'),db.nativeBin(),mps.status(),wallet()]);
 const kind=mps.dbInfo().kind;
 // While a registration is pending, refresh it from the registry at most every 20 s (the UI polls status()).
 let r=reg.status();
 if(r.registered&&!r.confirmed&&Date.now()-lastPoll>20000){lastPoll=Date.now();r=await reg.poll().catch(()=>r);}
 const funded=(w.balance?.ada??0)>=5;
 const items=[
  {label:'Network',status:net.test?'ok':'warn',detail:net.test?'Cardano preprod: test ADA and test USDM (press n for mainnet)':'Cardano MAINNET: real ADA and real USDM (press n for preprod)'},
  bfItem(NETWORKS.preprod,env.BLOCKFROST_API_KEY_PREPROD),
  ...(net.test?[]:[bfItem(net,env.BLOCKFROST_API_KEY_MAINNET)]),
  {label:'Author name',status:env.AGENT_AUTHOR?'ok':'todo',detail:env.AGENT_AUTHOR||'defaults to your Sokosumi Vendor name (public on the registry)'},
  {label:'Database',status:kind||docker||native?'ok':'action',detail:kind==='native'?`PostgreSQL in ${db.PGDATA}`:kind==='docker'?`Docker container ${db.DB_NAME}`:docker?'Docker found: Postgres runs in a container':native?`PostgreSQL found (${native}): runs a private copy, no Docker needed`:`needs ${db.installHint()}`,command:kind||docker||native?undefined:db.installHint()},
  {label:'Payment service',status:m.up?'ok':'todo',detail:m.up?m.url:m.installed?'installed, not running':m.prepared?'prepared; wallets are created once the Blockfrost key is set':'lokAl installs your own instance (Postgres in Docker)'},
  {label:'Selling wallet',status:w.address?(funded?'ok':'action'):'todo',detail:w.address?`${w.address.slice(0,20)}…${w.address.slice(-6)} · ${w.balance?`${w.balance.ada} ${net.coin}`:w.error??'balance unknown'}${!funded&&!net.test?' · send ≥ 5 ADA to it (lokal info)':''}`:'created by the payment service',command:w.address&&!funded?(w.faucet??w.explorer):undefined},
  // Mainnet buyers reach the agent through the registry's apiBaseUrl, which must be public.
  ...(net.test?[]:[{label:'Public URL',status:env.AGENT_PUBLIC_URL?'ok':'input',detail:env.AGENT_PUBLIC_URL||'https URL where buyers reach the agent API (port '+(env.AGENT_API_PORT||21950)+')',input:{key:'AGENT_PUBLIC_URL',label:'Public https URL of the agent API (e.g. https://agent.example.com)'}}]),
  {label:'Registry',status:r.confirmed?'ok':r.registered?'running':'todo',detail:r.confirmed?`agent ${r.agentIdentifier?.slice(0,16)}…`:r.registered?`state: ${r.state??'pending'}`:`registers your agent on Cardano ${net.id}`,tx:r.txHash},
  {label:'Paid tasks',status:env.PAID_TASKS_ENABLED==='true'?'ok':r.confirmed?'action':'todo',detail:env.PAID_TASKS_ENABLED==='true'?'enabled':r.confirmed?'registered: press enter to enable paid tasks':'enabled after registration confirms (a few minutes)'},
 ];
 const done=items.every(i=>i.status==='ok'||i.label==='Network');
 return {id,title,status:done?'ok':'todo',items,wallet:w,registration:r,mps:m,network:net.id,txUrl:r.txHash?explorerTx(net,r.txHash):null};
}
const ALLOWED=['BLOCKFROST_API_KEY_PREPROD','BLOCKFROST_API_KEY_MAINNET','AGENT_AUTHOR','AGENT_PUBLIC_URL','AGENT_API_HOST'];
export async function setValue(key,value){
 const v=value.trim();
 if(!ALLOWED.includes(key))throw new Error(`Unknown setting ${key}`);
 if(key==='BLOCKFROST_API_KEY_PREPROD'&&!bfKeyOk(NETWORKS.preprod,v))throw new Error('That is not a preprod key (it must start with "preprod").');
 if(key==='BLOCKFROST_API_KEY_MAINNET'&&!bfKeyOk(NETWORKS.mainnet,v))throw new Error('That is not a mainnet key (it must start with "mainnet").');
 if(key==='AGENT_PUBLIC_URL'&&!/^https?:\/\/[^\s/]+/.test(v))throw new Error('Enter a full URL, e.g. https://agent.example.com');
 if(key==='AGENT_API_HOST'&&!['127.0.0.1','0.0.0.0','::'].includes(v))throw new Error('AGENT_API_HOST is 127.0.0.1 (default, behind a reverse proxy) or 0.0.0.0 (reachable from outside)');
 writeEnv({[key]:key==='AGENT_PUBLIC_URL'?v.replace(/\/+$/,''):v});return status();
}
// Switching networks keeps each network's wallet and registration: the current state files are moved to
// docs/<network>/ and .local/<network>/, and the other network's (if any) are moved back.
const STATE=[['docs','payment-state.json'],['docs','registration-state.json'],['.local','mps-runtime.env']];
export async function setNetwork(target){
 const to=NETWORKS[target];if(!to)throw new Error('Network must be preprod or mainnet');
 const env=readEnv();const from=networkOf(env);if(from.id===to.id)return status();
 for(const c of cw.list()){
  for(const [d,f] of STATE){
   const cur=join(c.dir,d,f),arch=join(c.dir,d,from.id,f),back=join(c.dir,d,to.id,f);
   if(existsSync(cur)){mkdirSync(join(c.dir,d,from.id),{recursive:true,mode:0o700});renameSync(cur,arch);}
   if(existsSync(back))renameSync(back,cur);
  }
  const paid=existsSync(join(c.dir,'docs','registration-state.json'))&&reg.status(c.dir).complete;
  writeEnv({PAID_TASKS_ENABLED:paid?'true':'false',...(c.primary?{LOKAL_NETWORK:to.id}:{})},join(c.dir,'.env'));
 }
 log('pay',`Network switched to ${to.name}. Restart services to use it.`);
 return status();
}
// Runs as far as it can; stops (without error) at the next human action.
export async function run({startMps,restartMps}={}){
 let s=await status();const net=networkOf(readEnv());
 if(!s.mps.prepared)await mps.prepare(); // no secrets needed: runs while the user fetches a Blockfrost key
 s=await status();
 if(s.items.some(i=>i.status==='input'&&i.input?.key!=='AGENT_PUBLIC_URL'))return s;
 if(!readEnv().AGENT_AUTHOR){const v=await sk.vendor().catch(()=>null);writeEnv({AGENT_AUTHOR:v?.name??'lokal'});}
 let seeded=false;
 if(!s.mps.installed){await mps.seed();seeded=true;}
 if(seeded&&await mps.health()&&restartMps)await restartMps(); // a running service only sees new payment sources after a restart
 if(!(await mps.health())){if(startMps)await startMps();for(let i=0;i<60&&!(await mps.health());i++)await new Promise(r=>setTimeout(r,2000));}
 if(!(await mps.health()))throw new Error('Payment service did not come up; see the mps log');
 await mps.syncBlockfrostKey();
 const ps=await mps.recordPaymentState();
 s=await status();
 if(s.items.find(i=>i.label==='Selling wallet').status!=='ok'){
  if(!net.test)return s; // mainnet: the user funds the wallet with real ADA
  // Ask the dispenser once per address, then wait for the funds to land (about a minute on preprod).
  const cfg=loadConfig();
  if(cfg.faucetRequested!==ps.sellerAddress){const t=await requestTestAda(ps.sellerAddress);saveConfig({faucetRequested:ps.sellerAddress,faucetTx:t.txHash});log('pay',`Test ADA requested: ${t.url}`);}
  for(let i=0;i<40;i++){await new Promise(r=>setTimeout(r,6000));s=await status();if(s.items.find(i=>i.label==='Selling wallet').status==='ok')break;}
  if(s.items.find(i=>i.label==='Selling wallet').status!=='ok')return s;
 }
 if(!net.test&&!readEnv().AGENT_PUBLIC_URL)return s;
 const r=reg.status();
 if(!r.confirmed){await reg.register();s=await status();if(!s.registration.confirmed)return s;}
 if(reg.status().complete&&readEnv().PAID_TASKS_ENABLED!=='true')writeEnv({PAID_TASKS_ENABLED:'true'});
 return status();
}
// Paid jobs for an extra Coworker: its own registry entry on the shared selling wallet (an on-chain write).
export async function registerCoworker(cid){
 const c=cw.get(cid);if(!c)throw new Error(`No Coworker ${cid}`);
 if(c.primary)return run();
 if(!reg.status().complete)throw new Error('Finish setup step 4 for the main Coworker first (payment service, wallet, registry)');
 copyFileSync(join(cw.get('main').dir,'docs','payment-state.json'),join(c.dir,'docs','payment-state.json'));
 const r=await reg.register(c.dir);
 if(reg.status(c.dir).complete)writeEnv({PAID_TASKS_ENABLED:'true'},join(c.dir,'.env'));
 return r;
}
export const pollRegistration=(dir)=>reg.poll(dir);
