import {existsSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {parseEnv} from 'node:util';
import {COWORKER_DIR} from '../core/paths.mjs';
import {readEnv} from '../core/config.mjs';
// The coworker owns these files; we only read them or fill missing fields.
export const filesFor=dir=>({
 payment:join(dir,'docs','payment-state.json'),
 registration:join(dir,'docs','registration-state.json'),
 mpsEnv:join(COWORKER_DIR,'.local','mps.env'), // one payment service for every Coworker
 runtimeEnv:join(dir,'.local','mps-runtime.env'),
});
export const files=filesFor(COWORKER_DIR);
export const readJson=f=>{try{return JSON.parse(readFileSync(f,'utf8'))}catch{return null}};
export function writeJson(f,v){mkdirSync(join(f,'..'),{recursive:true});writeFileSync(f,JSON.stringify(v,null,2),{mode:0o600});}
export const readSecretEnv=f=>{try{return parseEnv(readFileSync(f,'utf8'))}catch{return {}}};
export function mpsUrl(){const e=readEnv();return e.MPS_URL||`http://127.0.0.1:${e.MPS_PORT||38127}`;}
export async function mps(path,{body,token,method}={}){
 const t=token??readSecretEnv(files.mpsEnv).ADMIN_KEY;
 const r=await fetch(mpsUrl()+'/api/v1'+path,{method:method??(body?'POST':'GET'),headers:{token:t??'','content-type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
 const j=await r.json().catch(()=>({}));
 if(!r.ok||(j.status&&j.status!=='success'))throw new Error(`Payment service ${path} HTTP ${r.status}`);
 return j.data??j;
}
export const exists=existsSync;
