import {readdirSync,readFileSync,statSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {explorer} from '../pay/wallet.mjs';
import * as cw from './coworkers.mjs';
// Job feed built from every Coworker's journals: Sokosumi Tasks in .local/<taskId>.json (+ .txt result) and
// MIP-003 agent API jobs in .local/standard-jobs/<id>.json (+ .txt).
const ID=/^[0-9a-f-]{36}\.json$/;
function parseResult(text){try{const v=JSON.parse(text);if(v&&v.v===1&&'output' in v)return v}catch{}return null}
const read=f=>{try{return JSON.parse(readFileSync(f,'utf8'))}catch{return {}}};
function taskJobs(c){
 const dir=join(c.dir,'.local');if(!existsSync(dir))return [];
 return readdirSync(dir).filter(f=>ID.test(f)).map(f=>{
  const file=join(dir,f),id=f.replace('.json','');const j=read(file);
  const txt=join(dir,id+'.txt');
  const result=existsSync(txt)?readFileSync(txt,'utf8'):(j.paid?.result??j.completion?.result??null);
  const canonical=result?parseResult(result):null;
  const p=j.paid??null,obs=p?.observed;
  const txs=[obs?.CurrentTransaction,...(obs?.TransactionHistory??[])].filter(t=>t?.txHash).map(t=>({label:t.newOnChainState??t.status,hash:t.txHash,url:explorer.tx(t.txHash),status:t.status}));
  const uniq=[...new Map(txs.map(t=>[t.hash+t.label,t])).values()];
  const check=j.check??p?.check??canonical?.check??null;
  return {id,coworker:c.id,source:'sokosumi',updatedAt:statSync(file).mtimeMs,paid:!!p,phase:j.phase??null,stage:p?.stage??null,
   input:j.input??null,output:canonical?.output??result,canonical,check,model:canonical?.model??null,digest:canonical?.digest??null,
   onChainState:obs?.onChainState??null,resultHash:p?.resultHash??j.resultHash??null,txs:uniq,settled:p?.settlement?.verified??false,
   status:p?(p.stage==='check-failed'?'withheld':p.stage==='settled'?'paid':p.stage):j.phase};
 });
}
function apiJobs(c){
 const dir=join(c.dir,'.local','standard-jobs');if(!existsSync(dir))return [];
 return readdirSync(dir).filter(f=>ID.test(f)).map(f=>{
  const file=join(dir,f),id=f.replace('.json','');const j=read(file);
  const canonical=j.result?parseResult(j.result):null;
  return {id,coworker:c.id,source:'api',updatedAt:statSync(file).mtimeMs,paid:true,phase:j.phase??null,stage:j.phase??null,
   input:j.input?.prompt??null,output:canonical?.output??j.result??null,canonical,check:j.check??canonical?.check??null,model:canonical?.model??null,digest:canonical?.digest??null,
   onChainState:null,resultHash:j.resultHash??null,txs:[],settled:false,
   status:j.phase==='check-failed'?'withheld':j.phase==='result-confirmed'?'result on-chain':j.phase};
 });
}
export function listJobs(limit=30){
 return cw.list().flatMap(c=>[...taskJobs(c),...apiJobs(c)]).sort((a,b)=>b.updatedAt-a.updatedAt).slice(0,limit);
}
export function earnings(jobs=listJobs(1000)){
 const done=jobs.filter(j=>j.status==='paid'||j.settled).length;
 const checked=jobs.filter(j=>j.check);
 return {jobs:jobs.length,paidJobs:done,usdm:done*1,passRate:checked.length?checked.filter(j=>j.check.pass).length/checked.length:null};
}
