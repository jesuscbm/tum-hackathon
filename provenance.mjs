// Canonical result: the exact text posted to the buyer. Its sha256 is the on-chain resultHash.
import {createHash} from 'node:crypto';
import {loadTemplate} from './templates/index.mjs';
import {check} from './checks/index.mjs';
export function canonicalize(value){
 if(value===null||typeof value!=='object')return JSON.stringify(value);
 if(Array.isArray(value))return `[${value.map(v=>canonicalize(v===undefined?null:v)).join(',')}]`;
 return `{${Object.keys(value).filter(k=>value[k]!==undefined).sort().map(k=>`${JSON.stringify(k)}:${canonicalize(value[k])}`).join(',')}}`;
}
export const sha256=text=>createHash('sha256').update(text,'utf8').digest('hex');
export const promptHash=promptText=>`sha256:${sha256(promptText)}`;
export function canonicalResult({template,output,model,digest,promptHash,check}){
 return canonicalize({v:1,template,model,digest:digest??null,promptHash,check:{type:check.type,pass:check.pass,reasons:check.reasons},output});
}
// Sokosumi paid Tasks commit sha256(text); MIP-003 jobs (agent API, lokal buy) commit sha256(`${nonce};${text}`),
// the nonce being the buyer's identifierFromPurchaser.
export const resultHash=(canonicalString,nonce)=>sha256(nonce?`${nonce};${canonicalString}`:canonicalString);
export function verifyResult(canonicalString,expectedHash,{nonce}={}){
 let parsed=null;
 try{parsed=JSON.parse(canonicalString)}catch{return {ok:false,parsed:null,reason:'not JSON'}}
 if(canonicalize(parsed)!==canonicalString)return {ok:false,parsed,reason:'not in canonical form'};
 const actual=resultHash(canonicalString,nonce);
 const expected=String(expectedHash??'').trim().toLowerCase().replace(/^sha256:/u,'');
 return actual===expected?{ok:true,parsed,hash:actual}:{ok:false,parsed,hash:actual,reason:`hash ${actual} ≠ expected ${expected}`};
}
// The buyer's side of "paid only if the check passed": the check is deterministic and the job template public,
// so anyone can re-run it on the delivered output and compare with the verdict the seller committed on-chain.
// A seller who submits pass:true on a failing output is provably cheating (grounds for a Masumi dispute).
export function recheck(parsed){
 let t;try{t=loadTemplate(parsed.template)}catch{return {ok:null,reason:`job template "${parsed.template}" is not available here, so its check cannot be re-run`}}
 const v=check(t.check??{type:'none'},'',parsed.output);
 const prompt=promptHash(t.prompt)===parsed.promptHash;
 return {ok:v.pass===parsed.check?.pass&&v.type===parsed.check?.type,check:v,claimed:parsed.check,prompt,
  reason:v.pass!==parsed.check?.pass?`the seller claimed ${parsed.check?.pass?'pass':'fail'}, the check says ${v.pass?'pass':'fail'}${v.reasons.length?`: ${v.reasons.slice(0,2).join('; ')}`:''}`:null};
}
