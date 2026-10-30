import {readdirSync,readFileSync,statSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {COWORKER_DIR} from './paths.mjs';
import {explorer} from '../pay/wallet.mjs';
// Job feed built from the worker's journals: coworker/.local/<taskId>.json (+ .txt result).
const DIR=()=>join(COWORKER_DIR,'.local');
const ID=/^[0-9a-f-]{36}\.json$/;
function parseResult(text){try{const v=JSON.parse(text);if(v&&v.v===1&&'output' in v)return v}catch{}return null}
export function listJobs(limit=30){
 if(!existsSync(DIR()))return [];
 return readdirSync(DIR()).filter(f=>ID.test(f)).map(f=>{
  const file=join(DIR(),f),id=f.replace('.json','');
  let j={};try{j=JSON.parse(readFileSync(file,'utf8'))}catch{}
  const txt=join(DIR(),id+'.txt');
  const result=existsSync(txt)?readFileSync(txt,'utf8'):(j.paid?.result??j.completion?.result??null);
  const canonical=result?parseResult(result):null;
  const p=j.paid??null,obs=p?.observed;
  const txs=[obs?.CurrentTransaction,...(obs?.TransactionHistory??[])].filter(t=>t?.txHash).map(t=>({label:t.newOnChainState??t.status,hash:t.txHash,url:explorer.tx(t.txHash),status:t.status}));
  const uniq=[...new Map(txs.map(t=>[t.hash+t.label,t])).values()];
  const check=j.check??p?.check??canonical?.check??null;
  return {id,updatedAt:statSync(file).mtimeMs,paid:!!p,phase:j.phase??null,stage:p?.stage??null,
   input:j.input??null,output:canonical?.output??result,canonical,check,model:canonical?.model??null,digest:canonical?.digest??null,
   onChainState:obs?.onChainState??null,resultHash:p?.resultHash??j.resultHash??null,txs:uniq,settled:p?.settlement?.verified??false,
   status:p?(p.stage==='check-failed'?'withheld':p.stage==='settled'?'paid':p.stage):j.phase};
 }).sort((a,b)=>b.updatedAt-a.updatedAt).slice(0,limit);
}
export function earnings(jobs=listJobs(1000)){
 const done=jobs.filter(j=>j.status==='paid'||j.settled).length;
 const checked=jobs.filter(j=>j.check);
 return {jobs:jobs.length,paidJobs:done,usdm:done*1,passRate:checked.length?checked.filter(j=>j.check.pass).length/checked.length:null};
}
