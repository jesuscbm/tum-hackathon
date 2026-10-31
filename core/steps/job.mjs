import {existsSync,readFileSync,writeFileSync,copyFileSync} from 'node:fs';
import {join} from 'node:path';
import {COWORKER_DIR} from '../paths.mjs';
import {loadConfig,saveConfig,writeEnv,readEnv} from '../config.mjs';
import {listTemplates,loadTemplate,saveCustomTemplate,orderedSamples,importMarkdown,priceFor,parsePrice} from '../../templates/index.mjs';
import {log} from '../events.mjs';
// Step 2: pick a job template (system prompt + check). Writes it as the agent's instructions.
export const id='job',title='Pick a job';
const INSTR=()=>join(COWORKER_DIR,'agent','instructions.md');
export async function status(){
 const cfg=loadConfig();const env=readEnv();const active=env.LOKAL_TEMPLATE;const price=priceFor(env);
 const t=active?safe(()=>loadTemplate(active)):null;
 const tried=cfg.tried?.[active];
 const items=[{label:'Template',status:t?'ok':'todo',detail:t?`${t.name}`:'none selected'},
  {label:'Check',status:t?(t.check?.type==='none'?'warn':'ok'):'todo',detail:t?(t.check?.type==='none'?'no check: buyers get no pay-only-if-correct guarantee':`${t.check.type}`):'—'},
  {label:'Price',status:'ok',detail:`${price.display} per job${price.own?' (your price)':" (the job's default) · press p to change"}`},
  {label:'Tried it',status:tried?'ok':'todo',detail:tried?`${tried.pass?'passed':'failed'} on "${tried.sample}"`:'try a sample before going live'}];
 return {id,title,status:t?'ok':'todo',items,templates:listTemplates().sort((a,b)=>(a.check?.type==='none')-(b.check?.type==='none')).map(({prompt,samples,...m})=>({...m,preview:prompt.trim().split('\n').find(l=>l.trim())?.slice(0,140)??'',samples:orderedSamples({samples}).map(s=>({name:s.name,expect:s.expect}))})),active,price};
}
function safe(f){try{return f()}catch{return null}}
export async function select(templateId){
 const t=loadTemplate(templateId);
 const f=INSTR();
 if(existsSync(f)){const cur=readFileSync(f,'utf8');if(cur!==t.prompt&&!existsSync(f+'.before-lokal')){copyFileSync(f,f+'.before-lokal');log('job','Saved previous agent instructions to agent/instructions.md.before-lokal');}}
 writeFileSync(f,t.prompt);
 writeEnv({LOKAL_TEMPLATE:t.id,LOKAL_AGENT_NAME:`${t.name} (lokAl)`,LOKAL_AGENT_DESCRIPTION:t.description??''});
 saveConfig({template:t.id});
 return status();
}
export async function createCustom({id:tid,name,prompt,check}){saveCustomTemplate({id:tid,name,prompt,check});return select(tid);}
// A Markdown prompt with front matter (see templates/index.mjs), copied into the custom templates folder.
export async function importPrompt(file){const t=importMarkdown(file);log('job',`Imported ${t.name} (${t.id}) from ${file}`);return select(t.id);}
export function recordTry(templateId,sample,pass){const cfg=loadConfig();saveConfig({tried:{...(cfg.tried??{}),[templateId]:{sample,pass,at:Date.now()}}});}
// What buyers pay per job, for this Coworker's Sokosumi Tasks and agent API alike: "1 USDM", "0.5 USDM",
// "2 ADA", or empty for the job's own price. The registry entry uses dynamic pricing, so no new registration.
export function setPrice(value,dir=COWORKER_DIR){
 const v=String(value??'').trim();const p=v?parsePrice(v):null;
 writeEnv({AGENT_PRICE:p?.display??''},join(dir,'.env'));
 log('job',p?`Price: ${p.display} per job`:"Price: back to the job's default");
 return priceFor(readEnv(join(dir,'.env')));
}
export const run=async()=>status();
