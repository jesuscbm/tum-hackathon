import {existsSync,readFileSync,writeFileSync,copyFileSync} from 'node:fs';
import {join} from 'node:path';
import {COWORKER_DIR} from '../paths.mjs';
import {loadConfig,saveConfig,writeEnv,readEnv} from '../config.mjs';
import {listTemplates,loadTemplate,saveCustomTemplate,orderedSamples} from '../../templates/index.mjs';
import {log} from '../events.mjs';
// Step 2: pick a job template (system prompt + check). Writes it as the agent's instructions.
export const id='job',title='Pick a job';
const INSTR=()=>join(COWORKER_DIR,'agent','instructions.md');
export async function status(){
 const cfg=loadConfig();const active=readEnv().LOKAL_TEMPLATE;
 const t=active?safe(()=>loadTemplate(active)):null;
 const tried=cfg.tried?.[active];
 const items=[{label:'Template',status:t?'ok':'todo',detail:t?`${t.name}`:'none selected'},
  {label:'Check',status:t?(t.check?.type==='none'?'warn':'ok'):'todo',detail:t?(t.check?.type==='none'?'no check: buyers get no pay-only-if-correct guarantee':`${t.check.type}`):'—'},
  {label:'Tried it',status:tried?'ok':'todo',detail:tried?`${tried.pass?'passed':'failed'} on "${tried.sample}"`:'try a sample before going live'}];
 return {id,title,status:t?'ok':'todo',items,templates:listTemplates().sort((a,b)=>(a.check?.type==='none')-(b.check?.type==='none')).map(({prompt,samples,...m})=>({...m,samples:orderedSamples({samples}).map(s=>({name:s.name,expect:s.expect}))})),active};
}
function safe(f){try{return f()}catch{return null}}
export async function select(templateId){
 const t=loadTemplate(templateId);
 const f=INSTR();
 if(existsSync(f)){const cur=readFileSync(f,'utf8');if(cur!==t.prompt&&!existsSync(f+'.before-lokal')){copyFileSync(f,f+'.before-lokal');log('job','Saved previous agent instructions to agent/instructions.md.before-lokal');}}
 writeFileSync(f,t.prompt);
 writeEnv({LOKAL_TEMPLATE:t.id,LOKAL_AGENT_NAME:`${t.name} (lokal)`,LOKAL_AGENT_DESCRIPTION:t.description??''});
 saveConfig({template:t.id});
 return status();
}
export async function createCustom({id:tid,name,prompt,check}){saveCustomTemplate({id:tid,name,prompt,check});return select(tid);}
export function recordTry(templateId,sample,pass){const cfg=loadConfig();saveConfig({tried:{...(cfg.tried??{}),[templateId]:{sample,pass,at:Date.now()}}});}
export const run=async()=>status();
