// Canonical result: the exact text posted to the buyer. Its sha256 is the on-chain resultHash.
import {createHash} from 'node:crypto';
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
export const resultHash=canonicalString=>sha256(canonicalString);
export function verifyResult(canonicalString,expectedHash){
 let parsed=null;
 try{parsed=JSON.parse(canonicalString)}catch{return {ok:false,parsed:null,reason:'not JSON'}}
 if(canonicalize(parsed)!==canonicalString)return {ok:false,parsed,reason:'not in canonical form'};
 const actual=resultHash(canonicalString);
 const expected=String(expectedHash??'').trim().toLowerCase().replace(/^sha256:/u,'');
 return actual===expected?{ok:true,parsed,hash:actual}:{ok:false,parsed,hash:actual,reason:`hash ${actual} ≠ expected ${expected}`};
}
