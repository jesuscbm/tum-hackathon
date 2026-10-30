import {EventEmitter} from 'node:events';
import {listTemplates,loadTemplate,orderedSamples} from '../templates/index.mjs';
import {check} from '../checks/index.mjs';
import {verifyResult} from '../provenance.mjs';
// Fake core with the same interface as core/index.mjs, for UI work and offline demos (LOKAL_MOCK=1).
export function createMockCore(){
 const bus=new EventEmitter();const logs=[];
 const log=(source,line)=>{const e={type:'log',source,line,at:Date.now()};logs.push(e);bus.emit('log',e)};
 const st={machine:0,job:null,sokosumi:false,pay:0,live:false,jobs:[]};
 const sleep=ms=>new Promise(r=>setTimeout(r,ms));
 async function prog(id,label,ms=1500){for(let i=0;i<=20;i++){bus.emit('progress',{id,label,pct:i/20});await sleep(ms/20)}}
 const it=(label,ok,detail,extra={})=>({label,status:ok===true?'ok':ok===false?'todo':ok,detail,...extra});
 const W='addr_test1qz8f0demo9xw3l7n6k0yq2c5m4p8r7s6t5u4v3w2x1y0z9a8b7c6d5e4f3g2h1j0k9l8m7n6p5q4r3s2t1u0v9w8x7y6';
 const statusOf={
  machine:()=>({id:'machine',title:'Your machine & model',status:st.machine>=3?'ok':'todo',model:'llama3.2:3b',items:[
   it('Hardware','ok','Intel Core i5-10210U · 8 cores · 15.3 GB RAM · no GPU, CPU inference'),
   it('Ollama runtime',st.machine>=1,st.machine>=1?'~/.local/share/lokal/ollama · v0.40.13':'not installed: lokAl installs it for you (no sudo)'),
   it('Model llama3.2:3b',st.machine>=2,st.machine>=2?'sha256:a80c4f17acd5…':'Llama 3.2 3B recommended for 15.3 GB RAM, CPU inference (~2 GB)'),
   it('Test prompt',st.machine>=3,st.machine>=3?'answered in 2.1s':'not run yet')]}),
  job:()=>({id:'job',title:'Pick a job',status:st.job?'ok':'todo',active:st.job,templates:listTemplates().sort((a,b)=>(a.check?.type==='none')-(b.check?.type==='none')).map(({prompt,samples,...m})=>({...m,samples:orderedSamples({samples}).map(s=>({name:s.name,expect:s.expect}))})),items:[
   it('Template',!!st.job,st.job?loadTemplate(st.job).name:'none selected'),it('Check',!!st.job,st.job?loadTemplate(st.job).check.type:'—'),it('Tried it',!!st.tried,st.tried??'try a sample before going live')]}),
  sokosumi:()=>({id:'sokosumi',title:'Connect Sokosumi',status:st.sokosumi?'ok':'todo',items:[
   it('Sokosumi CLI','ok','v1.0.4'),it('Account',st.sokosumi?'ok':'action',st.sokosumi?'you@example.com':'sign in once in your browser',{command:'sokosumi --preprod auth login'}),
   it('Vendor',st.sokosumi,st.sokosumi?'you (lokal-you)':'lokAl creates one for you'),it('Coworker',st.sokosumi,st.sokosumi?'llama3.2:3b via lokal':'lokAl registers a private Coworker'),
   it('Runtime key',st.sokosumi,st.sokosumi?'stored in the CLI vault':'imported straight into the CLI vault'),it('Workspace','ok','Personal Workspace (private testing)')]}),
  pay:()=>({id:'pay',title:'Get paid',status:st.pay>=4?'ok':'todo',wallet:{address:st.pay>=1?W:null,balance:st.pay>=2?{ada:10000,usdm:0}:{ada:0,usdm:0},faucet:'https://dispenser.masumi.network/'},items:[
   it('Blockfrost key',st.bf?'ok':'input',st.bf?'set':'free preprod key from blockfrost.io',{input:st.bf?undefined:{key:'BLOCKFROST_API_KEY_PREPROD',label:'Blockfrost preprod project id',secret:true}}),
   it('Docker','ok','found'),it('Payment service',st.pay>=1,st.pay>=1?'http://127.0.0.1:38127':'lokAl installs your own instance'),
   it('Selling wallet',st.pay>=2?'ok':st.pay>=1?'action':'todo',st.pay>=1?`${W.slice(0,20)}…${W.slice(-6)} · ${st.pay>=2?'10000':'0'} tADA`:'created by the payment service',{command:st.pay===1?'https://dispenser.masumi.network/':undefined}),
   it('Registry',st.pay>=3?'ok':'todo',st.pay>=3?'agent 7e8c1b0f9d2a44c1…':'registers your agent on Cardano preprod',{tx:st.pay>=3?'9f2c6a1be0d34c7a8e5f1b2c3d4e5f60718293a4b5c6d7e8f9a0b1c2d3e4f5a6':undefined}),
   it('Paid tasks',st.pay>=4,st.pay>=4?'enabled':'enabled after registration confirms')]}),
  live:()=>({id:'live',title:"You're live",status:st.live&&st.jobs.length?'ok':'todo',items:[it('Agent (Eve)',st.live,st.live?'running':'stopped'),it('Worker',st.live,st.live?'running':'stopped'),it('Agent API (MIP-003)',st.live,st.live?'running':'stopped'),it('First job',st.jobs.length>0,st.jobs.length?st.jobs[0].status:'send yourself a test job')]}),
 };
 const runs={
  machine:async()=>{if(st.machine<1){await prog('ollama-install','Downloading Ollama 1.4 GB');st.machine=1}if(st.machine<2){await prog('model-pull','pulling llama3.2:3b 2.0 GB',2500);st.machine=2}await prog('smoke','Asking the model a test question',600);st.machine=3},
  job:async()=>{},sokosumi:async()=>{await prog('sokosumi','Waiting for browser sign-in',1500);st.sokosumi=true},
  pay:async()=>{if(!st.bf)return;if(st.pay<1){await prog('mps','Installing your payment service',2500);st.pay=1;return}if(st.pay<2){await prog('wallet','Waiting for test ADA',1200);st.pay=2}if(st.pay<3){await prog('registry','Registering on Cardano preprod',2000);st.pay=3}st.pay=4},
  live:async()=>{await prog('services','Starting agent, worker, API',900);st.live=true},
 };
 const running=new Set();
 return {mock:true,bus,recentLogs:(n=50)=>logs.slice(-n),
  steps:Object.values(statusOf).map(f=>{const s=f();return {id:s.id,title:s.title}}),
  async status(id){const s=statusOf[id]();return running.has(id)?{...s,status:'running'}:s},
  async statusAll(){return Promise.all(Object.keys(statusOf).map(id=>this.status(id)))},
  async runStep(id){running.add(id);bus.emit('step',{id,status:'running'});log(id,`running ${id}`);await runs[id]();running.delete(id);bus.emit('step',{id,status:statusOf[id]().status});return statusOf[id]()},
  chooseModel:async()=>{},useExternal:async()=>{},
  async selectTemplate(id){st.job=id;return statusOf.job()},createTemplate:async({id})=>{st.job=id},
  login(){log('sokosumi','Opened Sokosumi login in your browser')},
  async useOrganization(){return {pending:false,org:{name:'TUM-Hackathon'}}},usePersonal(){},
  async setValue(key){if(key==='BLOCKFROST_API_KEY_PREPROD')st.bf=true;return statusOf.pay()},
  runPay(){return this.runStep('pay')},
  async sendTestJob(i=0){
   const t=loadTemplate(st.job??'invoice-json');const s=orderedSamples(t)[i%Math.max(t.samples.length,1)]??{text:'Say hello and describe what you can do.',expect:'pass',name:'hello'};const id=crypto.randomUUID();
   const job={id,updatedAt:Date.now(),paid:true,status:'awaiting-escrow',input:s.text,output:null,check:null,model:'llama3.2:3b',digest:'sha256:a80c4f17acd55265feb47dfb4e8a6c1b51c1d8a1e2c8d14f1e5b6b6b4b5d6c7e8',txs:[]};
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
  async health(){const on=st.live;return [['model','Model',st.machine>=3],['agent','Agent',on],['worker','Worker',on],['sokosumi','Sokosumi',st.sokosumi],['mps','Payments',st.pay>=1],['wallet','Wallet',st.pay>=2],['registry','Registry',st.pay>=3]].map(([id,label,ok])=>({id,label,status:ok?'ok':'fail',fix:`${label} not ready (mock)`}))},
  services:()=>[],startServices:async()=>{st.live=true},stopServices:async()=>{},restartService:async()=>{},
  verify:verifyResult,env:()=>({}),
 };
}
