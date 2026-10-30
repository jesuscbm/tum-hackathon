import {readFileSync,existsSync} from 'node:fs';
import {check} from '../checks/index.mjs';
import {canonicalResult,promptHash,resultHash} from '../provenance.mjs';
import {loadTemplate} from '../templates/index.mjs';
// lokal: wrap the agent's answer with the template's check and a provenance record.
// The canonical JSON becomes the Task result, so its sha256 is the on-chain resultHash.
const MAX_TRIES=2;
export function gateConfig(env=process.env){
 const template=loadTemplate(env.LOKAL_TEMPLATE||'freeform');
 const instructions=existsSync('agent/instructions.md')?readFileSync('agent/instructions.md','utf8'):template.prompt;
 return {template,promptHash:promptHash(instructions),model:env.ZAI_MODEL,baseURL:env.ZAI_BASE_URL};
}
async function modelDigest(cfg,env=process.env){
 if(env.LOKAL_MODEL_DIGEST)return env.LOKAL_MODEL_DIGEST;
 const base=cfg.baseURL?.replace(/\/v1\/?$/,'');
 try{const r=await fetch(base+'/api/tags',{signal:AbortSignal.timeout(3000)});const m=(await r.json()).models?.find(m=>m.name===cfg.model||m.model===cfg.model);return m?.digest?`sha256:${m.digest}`:null}catch{return null}
}
export function gate(answer,env=process.env){
 // Without LOKAL_TEMPLATE the starter behaves exactly as before (plain-text results, no check).
 if(!env.LOKAL_TEMPLATE)return async(...args)=>{const text=await answer(...args);return {text,pass:true,check:{type:'none',pass:true,reasons:[]},tries:1,hash:resultHash(text)};};
 return gateWith(answer,gateConfig(env));
}
export function gateWith(answer,cfg){
 return async function gatedAnswer(input,journal,deadline){
  let output,verdict,tries=0,prompt=input;
  while(tries<MAX_TRIES){
   tries++;
   output=await answer(prompt,journal,deadline);
   verdict=check(cfg.template.check??{type:'none'},input,output);
   if(verdict.pass)break;
   prompt=`${input}\n\n---\nYour previous answer failed the automatic check: ${verdict.reasons.slice(0,3).join('; ')}. Answer again following the instructions exactly.`;
  }
  const text=canonicalResult({template:cfg.template.id,output,model:cfg.model,digest:await modelDigest(cfg),promptHash:cfg.promptHash,check:{type:verdict.type,pass:verdict.pass,reasons:verdict.reasons}});
  return {text,pass:verdict.pass,check:verdict,tries,hash:resultHash(text)};
 };
}
