import {readEnv,loadConfig} from './config.mjs';
import {HOME,LOGS,COWORKER_DIR} from './paths.mjs';
import {networkOf,explorerTx,explorerAddress,explorerToken} from './network.mjs';
import * as cw from './coworkers.mjs';
import * as reg from '../pay/register.mjs';
import * as mps from '../pay/mps.mjs';
import {wallet} from '../pay/wallet.mjs';
import * as sk from './sokosumi.mjs';
import * as daemon from './daemon.mjs';
import {loadTemplate} from '../templates/index.mjs';
import {promptHash} from '../provenance.mjs';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
// Everything a user may need to copy somewhere: IDs, addresses, links, where files live. No secrets.
export async function info({online=true}={}){
 const env=readEnv(),cfg=loadConfig(),net=networkOf(env);
 const [w,m,d,user,v]=await Promise.all([wallet(),mps.status(),daemon.status(),online?sk.whoami().catch(()=>null):null,online?sk.vendor().catch(()=>null):null]);
 const coworkers=cw.list().map(c=>{
  const r=reg.status(c.dir);let ph=null;
  try{ph=promptHash(readFileSync(join(c.dir,'agent','instructions.md'),'utf8'))}catch{}
  let tname=null;try{tname=c.template?loadTemplate(c.template).name:null}catch{}
  return {id:c.id,name:c.name,dir:c.dir,sokosumiCoworkerId:c.coworkerId,template:c.template,templateName:tname,promptHash:ph,paid:c.paid,
   ports:c.ports,agentApi:r.apiBaseUrl??`http://127.0.0.1:${c.ports.api}`,
   registry:r.registered?{state:r.state,agentIdentifier:r.agentIdentifier,agentUrl:r.agentIdentifier?explorerToken(net,r.agentIdentifier):null,txHash:r.txHash,txUrl:r.txHash?explorerTx(net,r.txHash):null}:null};
 });
 return {
  network:{id:net.id,name:net.name,explorer:net.explorer},
  model:{backend:cfg.backend?.kind??'ollama',model:env.ZAI_MODEL||cfg.model||null,endpoint:env.ZAI_BASE_URL||null,weightsDigest:env.LOKAL_MODEL_DIGEST||null},
  sokosumi:{web:net.test?'https://preprod.sokosumi.com':'https://sokosumi.com',account:user?.email??null,vendor:v?{id:v.id,name:v.name,slug:v.slug}:cfg.vendorId?{id:cfg.vendorId}:null,
   workspace:env.SOKOSUMI_ORGANIZATION_SLUG?{slug:env.SOKOSUMI_ORGANIZATION_SLUG,id:env.SOKOSUMI_ORGANIZATION_ID}:'personal'},
  payments:{service:m.url,up:m.up,sellingWallet:w.address?{address:w.address,url:explorerAddress(net,w.address),ada:w.balance?.ada??null,usdm:w.balance?.usdm??null}:null,
   faucet:net.faucet,paymentSourceId:m.payment?.sourceId??null,walletId:m.payment?.walletId??null},
  coworkers,
  daemon:d.running?{pid:d.pid,since:new Date(d.startedAt).toISOString(),socket:daemon.SOCK()}:null,
  paths:{home:HOME,coworker:COWORKER_DIR,extraCoworkers:cw.EXTRA_DIR(),templates:join(HOME,'templates'),logs:LOGS,config:join(HOME,'config.json')},
 };
}
// Plain-text rendering for `lokal info` (also what the UI's Info view shows).
export function infoLines(i){
 const L=[];const kv=(k,v)=>L.push(`  ${k.padEnd(18)} ${v??'—'}`);
 L.push(`Network: ${i.network.name}`);
 L.push('','Model');kv('backend',i.model.backend);kv('model',i.model.model);kv('endpoint',i.model.endpoint);kv('weights digest',i.model.weightsDigest??'unverified');
 L.push('','Sokosumi');kv('web',i.sokosumi.web);kv('account',i.sokosumi.account);kv('vendor',i.sokosumi.vendor?`${i.sokosumi.vendor.name??''} ${i.sokosumi.vendor.id}`.trim():null);kv('workspace',typeof i.sokosumi.workspace==='string'?i.sokosumi.workspace:`${i.sokosumi.workspace.slug} (${i.sokosumi.workspace.id})`);
 L.push('','Payments');kv('payment service',`${i.payments.service} ${i.payments.up?'(up)':'(down)'}`);
 if(i.payments.sellingWallet){kv('selling wallet',i.payments.sellingWallet.address);kv('balance',`${i.payments.sellingWallet.ada??'?'} ADA · ${i.payments.sellingWallet.usdm??'?'} USDM`);kv('explorer',i.payments.sellingWallet.url);}
 else kv('selling wallet','not created yet (setup step 4)');
 if(i.payments.faucet)kv('test ADA',i.payments.faucet);
 for(const c of i.coworkers){
  L.push('',`Coworker ${c.name}${c.id==='main'?' (main)':''}`);
  kv('Sokosumi ID',c.sokosumiCoworkerId);kv('job',c.templateName?`${c.templateName} (${c.template})`:c.template);kv('prompt hash',c.promptHash);kv('paid jobs',c.paid?'enabled':'off');kv('agent API',c.agentApi);
  if(c.registry){kv('agent id',c.registry.agentIdentifier??c.registry.state);if(c.registry.agentUrl)kv('agent on-chain',c.registry.agentUrl);if(c.registry.txUrl)kv('registration tx',c.registry.txUrl);}
  kv('folder',c.dir);
 }
 L.push('','Background');kv('lokald',i.daemon?`pid ${i.daemon.pid} since ${i.daemon.since}`:'not running');
 L.push('','Files');for(const [k,v] of Object.entries(i.paths))kv(k,v);
 return L;
}
