import {detectHardware} from '../hardware.mjs';
import {recommend} from '../runtime/recommend.mjs';
import * as ollama from '../runtime/ollama.mjs';
import * as llamacpp from '../runtime/llamacpp.mjs';
import {chat} from '../backends/openai.mjs';
import {loadConfig,saveConfig,writeEnv} from '../config.mjs';
import {log,progress} from '../events.mjs';
// Step 1: hardware → runtime (install if missing, no sudo) → model → smoke test → write ZAI_* env.
export const id='machine',title='Your machine & model';
let hwCache=null;
export async function status(){
 const cfg=loadConfig();
 const hw=hwCache??=await detectHardware();
 const rec=recommend(hw);
 const kind=cfg.backend?.kind??'ollama';
 const items=[{label:'Hardware',status:'ok',detail:`${hw.cpu} · ${hw.cores} cores · ${hw.ramGB} GB RAM · ${hw.gpu?`${hw.gpu.name}${hw.gpu.vramGB?` (${hw.gpu.vramGB} GB)`:''}`:'no GPU, CPU inference'}`}];
 let ready=false;
 if(kind==='external'){
  items.push({label:'Endpoint',status:cfg.backend.verified?'ok':'todo',detail:cfg.backend.baseURL});
  ready=!!cfg.backend.verified;
 }else if(kind==='llamacpp'){
  const d=await llamacpp.detect();
  items.push({label:'llama.cpp server',status:d.running?'ok':'todo',detail:d.running?`${d.url} · ${d.model}`:'start llama-server, then retry'});
  ready=d.running&&!!cfg.backend?.verified;
 }else{
  const d=await ollama.detect();
  const model=cfg.model??rec.model.id;
  const has=d.running&&await ollama.hasModel(model);
  items.push({label:'Ollama runtime',status:d.installed?'ok':'todo',detail:d.installed?`${d.binary}${d.version?` · v${d.version}`:''}`:'not installed: lokAl installs it for you (no sudo)'});
  items.push({label:'Ollama server',status:d.running?'ok':'todo',detail:d.running?d.url:'not running'});
  items.push({label:`Model ${model}`,status:has?'ok':'todo',detail:has?(cfg.digest??'downloaded'):`${rec.model.name} recommended for ${rec.reason} (~${rec.model.sizeGB} GB)`});
  items.push({label:'Test prompt',status:cfg.smokeTest?.model===model?'ok':'todo',detail:cfg.smokeTest?.model===model?`answered in ${cfg.smokeTest.seconds}s`:'not run yet'});
  ready=has&&cfg.smokeTest?.model===model;
 }
 return {id,title,status:ready?'ok':'todo',items,hardware:hw,recommendation:rec,backend:kind,model:cfg.model??rec.model.id};
}
export async function chooseModel(model){saveConfig({model,smokeTest:null,digest:null});}
export async function useExternal({baseURL,apiKey,model}){
 const out=await chat({baseURL,apiKey,model,user:'Reply with the single word: ready',timeout:60000});
 saveConfig({backend:{kind:'external',baseURL,model,verified:!!out.trim()},model,digest:null});
 writeEnv({ZAI_BASE_URL:baseURL,ZAI_API_KEY:apiKey,ZAI_MODEL:model});
}
export async function run(){
 const cfg=loadConfig();
 if(cfg.backend?.kind&&cfg.backend.kind!=='ollama')return status();
 let d=await ollama.detect();
 if(!d.installed){log('machine','Installing Ollama into ~/.local/share/lokal/ollama');d=await ollama.install();}
 if(!d.running)await ollama.serve();
 const s=await status();const model=s.model;
 if(!await ollama.hasModel(model)){log('machine',`Downloading ${model}`);await ollama.pull(model);}
 const digest=await ollama.digest(model);
 progress('smoke','Asking the model a test question',0.5);
 const t0=Date.now();
 const out=await chat({baseURL:ollama.openAIBase(),apiKey:'ollama',model,user:'Reply with the single word: ready',timeout:300000});
 const seconds=+((Date.now()-t0)/1000).toFixed(1);
 progress('smoke',`Model answered: "${out.trim().slice(0,40)}"`,1);
 const ctx=s.recommendation.options.find(m=>m.id===model)?.contextTokens??32768;
 writeEnv({ZAI_BASE_URL:ollama.openAIBase(),ZAI_API_KEY:'ollama',ZAI_MODEL:model,ZAI_CONTEXT_WINDOW_TOKENS:String(ctx),LOKAL_MODEL_DIGEST:digest??''});
 saveConfig({backend:{kind:'ollama'},model,digest,smokeTest:{model,seconds,at:Date.now()}});
 return status();
}
