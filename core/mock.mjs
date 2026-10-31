import {EventEmitter} from 'node:events';
import {listTemplates,loadTemplate,orderedSamples,parsePrice} from '../templates/index.mjs';
import {check} from '../checks/index.mjs';
import {verifyResult} from '../provenance.mjs';
import {API_PRESETS} from './steps/machine.mjs';
// Fake core with the same interface as core/index.mjs, for UI work and offline demos (LOKAL_MOCK=1).
export function createMockCore(){
 const bus=new EventEmitter();const logs=[];
 const log=(source,line)=>{const e={type:'log',source,line,at:Date.now()};logs.push(e);bus.emit('log',e)};
 const st={machine:0,job:null,sokosumi:false,pay:0,live:false,jobs:[],net:'preprod',daemon:null,model:'llama3.2:3b',backend:'ollama',
  coworkers:[{id:'main',name:'main',primary:true,template:null,coworkerId:null,paid:false,ports:{eve:21949,api:21950},dir:'~/.local/share/lokal/app/coworker'}]};
 const headless=!!(process.env.SSH_CONNECTION||process.env.LOKAL_HEADLESS==='1');
 const sleep=ms=>new Promise(r=>setTimeout(r,ms));
 async function prog(id,label,ms=1500){for(let i=0;i<=20;i++){bus.emit('progress',{id,label,pct:i/20});await sleep(ms/20)}}
 const it=(label,ok,detail,extra={})=>({label,status:ok===true?'ok':ok===false?'todo':ok,detail,...extra});
 const W='addr_test1qz8f0demo9xw3l7n6k0yq2c5m4p8r7s6t5u4v3w2x1y0z9a8b7c6d5e4f3g2h1j0k9l8m7n6p5q4r3s2t1u0v9w8x7y6';
 const statusOf={
  machine:()=>({id:'machine',title:'Your machine & model',status:st.machine>=3?'ok':'todo',model:st.model,backend:st.backend,presets:API_PRESETS,
   recommendation:{model:{id:'llama3.2:3b'},reason:'15.3 GB RAM, CPU inference',options:JSON.parse('[{"id":"llama3.2:1b","name":"Llama 3.2 1B","sizeGB":1.3,"fits":true,"note":"tiny machines"},{"id":"llama3.2:3b","name":"Llama 3.2 3B","sizeGB":2,"fits":true,"note":"best default for laptops without a GPU"},{"id":"qwen2.5:3b","name":"Qwen 2.5 3B","sizeGB":1.9,"fits":true,"note":"strong at structured JSON"},{"id":"qwen2.5:7b","name":"Qwen 2.5 7B","sizeGB":4.7,"fits":false,"note":"any 8 GB GPU"},{"id":"qwen2.5:32b","name":"Qwen 2.5 32B","sizeGB":20,"fits":false,"note":"24 GB GPUs"}]')},items:st.backend==='api'?[
   it('Hardware','ok','Intel Core i5-10210U · 8 cores · 15.3 GB RAM · no GPU, CPU inference'),it('Endpoint','ok',st.api),it(`Model ${st.model}`,'ok','answered in 0.8s · weights unverified (remote)')]:[
   it('Hardware','ok','Intel Core i5-10210U · 8 cores · 15.3 GB RAM · no GPU, CPU inference'),
   it('Ollama runtime',st.machine>=1,st.machine>=1?'~/.local/share/lokal/ollama · v0.40.13':'not installed: lokAl installs it for you (no sudo)'),
   it(`Model ${st.model}`,st.machine>=2,st.machine>=2?'sha256:a80c4f17acd5…':'Llama 3.2 3B recommended for 15.3 GB RAM, CPU inference (~2 GB)'),
   it('Test prompt',st.machine>=3,st.machine>=3?'answered in 2.1s':'not run yet')]}),
  job:()=>({id:'job',title:'Pick a job',status:st.job?'ok':'todo',active:st.job,price:st.price?{...parsePrice(st.price),own:true}:parsePrice(1),templates:listTemplates().sort((a,b)=>(a.check?.type==='none')-(b.check?.type==='none')).map(({prompt,samples,...m})=>({...m,preview:prompt.trim().split('\n').find(l=>l.trim())?.slice(0,140)??'',samples:orderedSamples({samples}).map(s=>({name:s.name,expect:s.expect}))})),items:[
   it('Template',!!st.job,st.job?loadTemplate(st.job).name:'none selected'),it('Check',!!st.job,st.job?loadTemplate(st.job).check.type:'—'),
   it('Price','ok',st.price?`${st.price} per job (your price)`:"1 USDM per job (the job's default) · press p to change"),it('Tried it',!!st.tried,st.tried??'try a sample before going live')]}),
  sokosumi:()=>({id:'sokosumi',title:'Connect Sokosumi',status:st.sokosumi?'ok':'todo',headless,signIn:st.signIn&&!st.sokosumi?{url:'https://api.preprod.sokosumi.com/auth/oauth2/authorize?client_id=demo&redirect_uri=http%3A%2F%2F127.0.0.1%3A53682%2Foauth%2Fcallback',tunnel:'ssh -N -L 53682:127.0.0.1:53682 you@server'}:null,items:[
   it('Sokosumi CLI','ok','v1.1.0'),st.sokosumi?it('Account','ok','you@example.com'):headless?it('Account','input','no browser on this machine: paste a Sokosumi API key, or press b for a sign-in link',{input:{key:'SOKOSUMI_API_KEY',label:'Sokosumi API key (starts with soko_preprod_)',secret:true}}):it('Account','action','sign in once in your browser',{command:'sokosumi --preprod auth login'}),
   it('Vendor',st.sokosumi,st.sokosumi?'you (lokal-you)':'lokAl creates one for you'),it('Coworker',st.sokosumi,st.sokosumi?'llama3.2:3b via lokal':'lokAl registers a private Coworker'),
   it('Runtime key',st.sokosumi,st.sokosumi?'stored in the CLI vault':'imported straight into the CLI vault'),it('Workspace','ok',st.workspace?'Example Org (organization) · press w to change':'Personal Workspace (private testing) · press w to use Example Org')],
   workspace:st.workspace??'personal',workspaces:[{id:'personal',name:'Personal Workspace',hint:'private: only you can send it tasks'},{id:'example-org',name:'Example Org',hint:'organization · example-org'}]}),
  pay:()=>({id:'pay',title:'Get paid',status:st.pay>=4?'ok':'todo',network:st.net,wallet:{address:st.pay>=1?W:null,balance:st.pay>=2?{ada:10000,usdm:0}:{ada:0,usdm:0},faucet:'https://dispenser.masumi.network/'},items:[
   it('Network',st.net==='preprod'?'ok':'warn',st.net==='preprod'?'Cardano preprod: test ADA and test USDM (press n for mainnet)':'Cardano MAINNET: real ADA and real USDM (press n for preprod)'),
   it('Blockfrost key',st.bf?'ok':'input',st.bf?'set':'free preprod key from blockfrost.io',{input:st.bf?undefined:{key:'BLOCKFROST_API_KEY_PREPROD',label:'Blockfrost preprod project id',secret:true}}),
   it('Database','ok','Docker found: Postgres runs in a container'),it('Payment service',st.pay>=1,st.pay>=1?'http://127.0.0.1:38127':'lokAl installs your own instance'),
   it('Selling wallet',st.pay>=2?'ok':st.pay>=1?'action':'todo',st.pay>=1?`${W.slice(0,20)}…${W.slice(-6)} · ${st.pay>=2?'10000':'0'} tADA`:'created by the payment service',{command:st.pay===1?'https://dispenser.masumi.network/':undefined}),
   it('Registry',st.pay>=3?'ok':'todo',st.pay>=3?'agent 7e8c1b0f9d2a44c1…':'registers your agent on Cardano preprod',{tx:st.pay>=3?'9f2c6a1be0d34c7a8e5f1b2c3d4e5f60718293a4b5c6d7e8f9a0b1c2d3e4f5a6':undefined}),
   it('Paid tasks',st.pay>=4,st.pay>=4?'enabled':'enabled after registration confirms')]}),
  live:()=>({id:'live',title:"You're live",status:st.live&&st.jobs.length?'ok':'todo',items:[it('Agent (Eve)',st.live,st.live?'running':'stopped'),it('Worker',st.live,st.live?'running':'stopped'),it('Agent API (MIP-003)',st.live,st.live?'running':'stopped'),it('First job',st.jobs.length>0,st.jobs.length?st.jobs[0].status:'send yourself a test job')]}),
 };
 const runs={
  machine:async()=>{if(st.machine<1){await prog('ollama-install','Downloading Ollama 1.4 GB');st.machine=1}if(st.machine<2){await prog('model-pull','pulling llama3.2:3b 2.0 GB',2500);st.machine=2}await prog('smoke','Asking the model a test question',600);st.machine=3},
  job:async()=>{},sokosumi:async()=>{await prog('sokosumi','Waiting for browser sign-in',1500);st.sokosumi=true},
  pay:async()=>{if(!st.bf)return;if(st.pay<1){await prog('mps','Installing your payment service',2500);st.pay=1;return}if(st.pay<2){await prog('wallet','Waiting for test ADA',1200);st.pay=2}if(st.pay<3){await prog('registry','Registering on Cardano preprod',2000);st.pay=3}st.pay=4},
  live:async()=>{await prog('services','Starting agent, worker, API',900);st.live=true;st.daemon??=Date.now()},
 };
 const running=new Set();
 return {mock:true,bus,recentLogs:(n=50)=>logs.slice(-n),
  steps:Object.values(statusOf).map(f=>{const s=f();return {id:s.id,title:s.title}}),
  async status(id){const s=statusOf[id]();return running.has(id)?{...s,status:'running'}:s},
  async statusAll(){return Promise.all(Object.keys(statusOf).map(id=>this.status(id)))},
  async runStep(id){running.add(id);bus.emit('step',{id,status:'running'});log(id,`running ${id}`);await runs[id]();running.delete(id);bus.emit('step',{id,status:statusOf[id]().status});return statusOf[id]()},
  mock:true,headless,vault:'system',
  chooseModel:async m=>{st.model=m;st.backend='ollama';st.machine=Math.min(st.machine,1)},useOllama:async()=>{st.backend='ollama'},useLlamacpp:async()=>{},
  async useExternal({baseURL,model}){await prog('smoke','Asking the model a test question',600);st.backend='api';st.api=baseURL;st.model=model||'gpt-4o-mini';st.machine=3},
  templates:()=>listTemplates().map(({prompt,samples,...t})=>t),
  async importPrompt(file){log('job',`Imported ${file}`);st.job='invoice-json';return statusOf.job()},
  async loginWithKey(){await sleep(600);st.sokosumi=true;return statusOf.sokosumi()},
  network:()=>st.net,async setNetwork(n){st.net=n;log('pay',`Network switched to ${n}`);return statusOf.pay()},
  async info(){return {network:{id:st.net,name:st.net==='preprod'?'Preprod':'Mainnet',explorer:'https://preprod.cardanoscan.io'},model:{backend:st.backend,model:st.model,endpoint:'http://127.0.0.1:11434/v1',weightsDigest:'sha256:a80c4f17acd55265feec403c7aef86be0c25983ab279d83f3bcd3abbcb5b8b72'},
   sokosumi:{web:'https://preprod.sokosumi.com',account:st.sokosumi?'you@example.com':null,vendor:st.sokosumi?{id:'vnd_demo',name:'you (lokal)',slug:'lokal-you'}:null,workspace:'personal'},
   payments:{service:'http://127.0.0.1:38127',up:st.pay>=1,sellingWallet:st.pay>=1?{address:W,url:`https://preprod.cardanoscan.io/address/${W}`,ada:st.pay>=2?10000:0,usdm:0}:null,faucet:'https://dispenser.masumi.network/'},
   coworkers:st.coworkers.map(c=>({...c,sokosumiCoworkerId:c.coworkerId,templateName:c.template,promptHash:'sha256:5f1d…',agentApi:`http://127.0.0.1:${c.ports.api}`,registry:c.primary&&st.pay>=3?{state:'RegistrationConfirmed',agentIdentifier:'7e8c1b0f9d2a44c1aa',agentUrl:'https://preprod.cardanoscan.io/token/7e8c',txUrl:'https://preprod.cardanoscan.io/transaction/9f2c'}:null})),
   daemon:st.daemon?{pid:4242,since:new Date(st.daemon).toISOString(),socket:'~/.local/share/lokal/lokald.sock'}:null,paths:{home:'~/.local/share/lokal',logs:'~/.local/share/lokal/logs',templates:'~/.local/share/lokal/templates'}}},
  async exportWallet(){return {address:W,mnemonic:'mock mock mock mock mock mock mock mock mock mock mock mock mock mock mock mock mock mock mock mock mock mock mock mock'}},
  async resources(){const t=Date.now()/1000;const on=st.live;return {at:Date.now(),cpu:{pct:on?35+25*Math.sin(t/3)+Math.random()*10:4+Math.random()*3,cores:8,load:1.2},ram:{usedGB:on?9.4:6.1,totalGB:15.3,pct:on?61:40},
   gpu:null,procs:on?{model:{cpu:+(180+60*Math.sin(t/2)).toFixed(1),memMB:2310,n:2},agent:{cpu:2.1,memMB:310,n:3},worker:{cpu:0.4,memMB:64,n:1},api:{cpu:0.2,memMB:58,n:1},mps:{cpu:1.4,memMB:420,n:4}}:{}}},
  async daemon(){return st.daemon?{running:true,pid:4242,startedAt:st.daemon,services:[]}:{running:false}},
  async stopDaemon(){st.daemon=null;st.live=false;return true},
  async attach(){return ()=>{}},
  coworkers:()=>st.coworkers.map(c=>c.primary?{...c,template:st.job,coworkerId:st.sokosumi?'cw_main_demo':null,paid:st.pay>=4,price:st.price??'1 USDM'}:c),
  async addCoworker({name,template}){await prog('coworker',`Registering ${name} on Sokosumi`,800);const id=name.toLowerCase().replace(/[^a-z0-9]+/g,'-');const n=st.coworkers.length;const c={id,name,primary:false,template,coworkerId:`cw_${id}`,paid:false,ports:{eve:21949+2*n,api:21950+2*n},dir:`~/.local/share/lokal/coworkers/${id}`};st.coworkers.push(c);log('coworkers',`Registered Coworker ${name}`);return c},
  async removeCoworker(id){st.coworkers=st.coworkers.filter(c=>c.id!==id||c.primary);log('coworkers',`Removed ${id}`);return st.coworkers},
  async setCoworkerTemplate(id,t){const c=st.coworkers.find(c=>c.id===id);if(c.primary)st.job=t;else c.template=t;return c},
  async registerCoworkerOnSokosumi(id){return st.coworkers.find(c=>c.id===id)},async registerCoworkerPaid(id){const c=st.coworkers.find(c=>c.id===id);if(c)c.paid=true;return c},
  async selectTemplate(id){st.job=id;return statusOf.job()},createTemplate:async({id})=>{st.job=id},
  login(){if(headless)st.signIn=true;log('sokosumi',headless?'Started the Sokosumi sign-in':'Opened Sokosumi login in your browser')},
  async setPrice(v){st.price=v?parsePrice(v).display:null;return st.price?{...parsePrice(st.price),own:true}:parsePrice(1)},
  async useWorkspace(id){st.workspace=id==='personal'?null:id;return {pending:false,org:id==='personal'?null:{name:'Example Org',slug:id}}},
  async setValue(key){if(key==='BLOCKFROST_API_KEY_PREPROD')st.bf=true;return statusOf.pay()},
  runPay(){return this.runStep('pay')},
  async sendTestJob(i=0){
   const t=loadTemplate(st.job??'invoice-json');const s=orderedSamples(t)[i%Math.max(t.samples.length,1)]??{text:'Say hello and describe what you can do.',expect:'pass',name:'hello'};const id=crypto.randomUUID();
   const job={id,coworker:'main',source:'sokosumi',updatedAt:Date.now(),paid:true,status:'awaiting-escrow',input:s.text,output:null,check:null,model:'llama3.2:3b',digest:'sha256:a80c4f17acd55265feb47dfb4e8a6c1b51c1d8a1e2c8d14f1e5b6b6b4b5d6c7e8',txs:[]};
   st.jobs.unshift(job);log('worker',`Task ${id.slice(0,8)} READY`);
   const tx=()=>Array.from({length:64},()=>'0123456789abcdef'[Math.random()*16|0]).join('');
   const step=async(ms,patch,tlabel)=>{await sleep(ms);Object.assign(job,patch,{updatedAt:Date.now()});if(tlabel){const h=tx();job.txs.push({label:tlabel,hash:h,url:`https://preprod.cardanoscan.io/transaction/${h}`})}bus.emit('job',job)};
   (async()=>{await step(1500,{status:'awaiting-escrow'},'FundsLocked');await step(2500,{status:'answering'});
    const pass=s.expect==='pass';
    await step(3000,{status:pass?'awaiting-result':'withheld',output:pass?'{"vendor":"…","total":25.81}':'{"error":"not an invoice"}',check:{type:'invoice',pass,reasons:pass?[]:['$: missing required field "vendor"']}},pass?'ResultSubmitted':undefined);
    if(pass)await step(3000,{status:'paid',settled:true},'Withdrawn');})();
   return {id};
  },
  async tryIt(templateId,input){
   const t=loadTemplate(templateId);const s=t.samples.find(x=>x.text===input);
   const out=s?.expect==='fail'?'{"error":"not an invoice"}':'{"vendor":"Kaffeerösterei Isar","invoice_number":"2026-10417","date":"2026-10-30","currency":"EUR","line_items":[{"description":"Flat White","quantity":2,"unit_price":3.9,"amount":7.8}],"subtotal":7.8,"tax":null,"total":7.8}';
   let text='';for(const ch of out.match(/.{1,6}/g)){text+=ch;bus.emit('try',{delta:ch,text});await sleep(30)}
   const verdict=check(t.check,input,out);st.tried=`${verdict.pass?'passed':'failed'} on "${s?.name??'your input'}"`;return {output:out,check:verdict,seconds:2.4};
  },
  jobs:()=>st.jobs,earnings:()=>({jobs:st.jobs.length,paidJobs:st.jobs.filter(j=>j.status==='paid').length,usdm:st.jobs.filter(j=>j.status==='paid').length,passRate:st.jobs.filter(j=>j.check).length?st.jobs.filter(j=>j.check?.pass).length/st.jobs.filter(j=>j.check).length:null}),
  async wallet(){return statusOf.pay().wallet},
  async health(){const on=st.live,paid=st.pay>=4;const up=st.daemon?Math.round((Date.now()-st.daemon)/1000)+'s':'';
   return [['model','Model','thinks: answers every job',st.machine>=3,`Ollama 0.40.13 · ${st.model}`],['agent','Agent','Eve: runs the prompt on the model',on,`running ${up}`],['worker','Worker','takes Sokosumi tasks, checks answers',on,`running ${up}`],
    ['api','Agent API','MIP-003: paid jobs from the registry',paid?on:null,'running'],['sokosumi','Sokosumi','marketplace where buyers hire you',st.sokosumi,'you@example.com'],['mps','Payments','Masumi payment service (escrow)',paid?st.pay>=1:null,'up · Preprod'],
    ['wallet','Wallet','selling wallet: receives the money',paid?st.pay>=2:null,'10000 tADA'],['registry','Registry','agent identity on Cardano',paid?st.pay>=3:null,'7e8c1b0f9d2a…'],['daemon','lokald','keeps everything running',!!st.daemon,`pid 4242 · up ${up}`]]
    .map(([id,label,role,ok,detail])=>({id,label,role,status:ok===null?'off':ok?'ok':'fail',detail:ok===null?'not enabled':ok?detail:'down',fix:`${label} not ready (mock)`}))},
  services:async()=>[],startServices:async()=>{st.live=true;st.daemon??=Date.now()},stopServices:async()=>{st.live=false},restartService:async()=>{},
  verify:verifyResult,env:()=>({}),
 };
}
