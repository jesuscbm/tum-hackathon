import {detectHardware} from '../hardware.mjs';
import {recommend} from '../runtime/recommend.mjs';
import * as ollama from '../runtime/ollama.mjs';
import * as llamacpp from '../runtime/llamacpp.mjs';
import {chat,listModels} from '../backends/openai.mjs';
import {loadConfig,saveConfig,writeEnv,readEnv} from '../config.mjs';
import {log,progress} from '../events.mjs';
// Step 1: hardware → runtime (install if missing, no sudo) → model → smoke test → write ZAI_* env.
// Backends: ollama (lokAl installs it; any model tag), api (any OpenAI-compatible endpoint: cloud, vLLM,
// LM Studio, an Ollama on a GPU box), llamacpp (a running llama-server).
export const id='machine',title='Your machine & model';
// Known OpenAI-compatible endpoints, offered in the UI. Any other URL works too.
export const API_PRESETS=[
 {id:'openai',name:'OpenAI',baseURL:'https://api.openai.com/v1',model:'gpt-4o-mini'},
 {id:'openrouter',name:'OpenRouter',baseURL:'https://openrouter.ai/api/v1',model:'meta-llama/llama-3.3-70b-instruct'},
 {id:'groq',name:'Groq',baseURL:'https://api.groq.com/openai/v1',model:'llama-3.3-70b-versatile'},
 {id:'mistral',name:'Mistral',baseURL:'https://api.mistral.ai/v1',model:'mistral-small-latest'},
 {id:'vllm',name:'vLLM / your GPU server',baseURL:'http://127.0.0.1:8000/v1',model:''},
 {id:'lmstudio',name:'LM Studio',baseURL:'http://127.0.0.1:1234/v1',model:''},
];
let hwCache=null;
export async function status(){
 const cfg=loadConfig();
 const hw=hwCache??=await detectHardware();
 const rec=recommend(hw);
 const kind=cfg.backend?.kind==='external'?'api':cfg.backend?.kind??'ollama';
 const items=[{label:'Hardware',status:'ok',detail:`${hw.cpu} · ${hw.cores} cores · ${hw.ramGB} GB RAM · ${hw.gpu?`${hw.gpu.name}${hw.gpu.vramGB?` (${hw.gpu.vramGB} GB)`:''}`:'no GPU, CPU inference'}`}];
 let ready=false;
 if(kind==='api'){
  const b=cfg.backend;
  items.push({label:'Endpoint',status:b.verified?'ok':'todo',detail:`${b.baseURL}${b.verified?'':' · not verified yet'}`});
  items.push({label:`Model ${b.model}`,status:b.verified?'ok':'todo',detail:b.verified?`answered in ${cfg.smokeTest?.seconds??'?'}s · weights unverified (remote)`:'press enter to test it'});
  ready=!!b.verified;
 }else if(kind==='llamacpp'){
  const d=await llamacpp.detect(cfg.backend?.baseURL);
  items.push({label:'llama.cpp server',status:d.running?'ok':'todo',detail:d.running?`${d.url} · ${d.model}`:`start llama-server on ${d.url}, then press enter`});
  items.push({label:'Test prompt',status:cfg.smokeTest?.model===d.model&&d.running?'ok':'todo',detail:cfg.smokeTest?.model===d.model?`answered in ${cfg.smokeTest.seconds}s`:'not run yet'});
  ready=d.running&&cfg.smokeTest?.model===d.model;
 }else{
  const d=await ollama.detect();
  const model=cfg.model??rec.model.id;
  const known=rec.options.find(m=>m.id===model);
  const has=d.running&&await ollama.hasModel(model);
  items.push({label:'Ollama runtime',status:d.installed?'ok':'todo',detail:d.installed?`${d.binary}${d.version?` · v${d.version}`:''}`:'not installed: lokAl installs it for you (no sudo)'});
  items.push({label:'Ollama server',status:d.running?'ok':'todo',detail:d.running?d.url:'not running'});
  items.push({label:`Model ${model}`,status:has?'ok':'todo',detail:has?(cfg.digest??'downloaded'):known?`${known.name}${known.id===rec.model.id?` recommended for ${rec.reason}`:''} (~${known.sizeGB} GB)`:'custom model: downloaded from the Ollama library'});
  items.push({label:'Test prompt',status:cfg.smokeTest?.model===model?'ok':'todo',detail:cfg.smokeTest?.model===model?`answered in ${cfg.smokeTest.seconds}s`:'not run yet'});
  ready=has&&cfg.smokeTest?.model===model;
 }
 return {id,title,status:ready?'ok':'todo',items,hardware:hw,recommendation:rec,backend:kind,model:kind==='api'?cfg.backend.model:cfg.model??rec.model.id,presets:API_PRESETS,api:kind==='api'?{baseURL:cfg.backend.baseURL,model:cfg.backend.model}:null};
}
// Any Ollama tag works ("qwen2.5:32b", "hf.co/bartowski/…-GGUF:Q4_K_M"); the catalog is only the shortlist.
export async function chooseModel(model){
 const m=String(model??'').trim();if(!m||/\s/.test(m))throw new Error('Model tag must not be empty or contain spaces');
 saveConfig({backend:{kind:'ollama'},model:m,smokeTest:null,digest:null});
}
async function smoke({baseURL,apiKey,model}){
 progress('smoke','Asking the model a test question',0.5);
 const t0=Date.now();
 const out=await chat({baseURL,apiKey,model,user:'Reply with the single word: ready',timeout:300000});
 const seconds=+((Date.now()-t0)/1000).toFixed(1);
 progress('smoke',`Model answered: "${out.trim().slice(0,40)}"`,1);
 if(!out.trim())throw new Error('The model returned an empty answer');
 return {model,seconds,at:Date.now()};
}
// An OpenAI-compatible endpoint (cloud or self-hosted). The key goes to coworker/.env only.
export async function useExternal({baseURL,apiKey,model,contextTokens}){
 const url=String(baseURL??'').trim().replace(/\/+$/,'');
 if(!/^https?:\/\/\S+$/.test(url))throw new Error('Enter the endpoint as a URL, e.g. https://api.openai.com/v1');
 let m=String(model??'').trim();
 if(!m){const ms=await listModels({baseURL:url,apiKey}).catch(()=>[]);m=ms[0];if(!m)throw new Error('Name the model (the endpoint did not list any)');}
 const smokeTest=await smoke({baseURL:url,apiKey:apiKey||'lokal',model:m});
 saveConfig({backend:{kind:'external',baseURL:url,model:m,verified:true},model:m,digest:null,smokeTest});
 // No weights digest for a remote model: provenance marks it unverified.
 writeEnv({ZAI_BASE_URL:url,ZAI_API_KEY:apiKey||'lokal',ZAI_MODEL:m,ZAI_CONTEXT_WINDOW_TOKENS:String(contextTokens||32768),LOKAL_MODEL_DIGEST:''});
 log('machine',`Using ${m} at ${url}`);
 return status();
}
export async function useLlamacpp({baseURL}={}){
 const d=await llamacpp.detect(baseURL);
 if(!d.running)throw new Error(`No llama-server answering at ${d.url}`);
 saveConfig({backend:{kind:'llamacpp',baseURL:d.url},model:d.model,digest:null,smokeTest:null});
 return run();
}
export async function useOllama(){const cfg=loadConfig();saveConfig({backend:{kind:'ollama'},model:cfg.backend?.kind==='ollama'?cfg.model:null,smokeTest:null,digest:null});return status();}
export async function run(){
 const cfg=loadConfig();
 if(cfg.backend?.kind==='external'){const b=cfg.backend;const env=readEnv();const smokeTest=await smoke({baseURL:b.baseURL,apiKey:env.ZAI_API_KEY,model:b.model});saveConfig({smokeTest});return status();}
 if(cfg.backend?.kind==='llamacpp'){
  const d=await llamacpp.detect(cfg.backend.baseURL);if(!d.running)return status();
  const smokeTest=await smoke({baseURL:d.url+'/v1',apiKey:'lokal',model:d.model});
  const digest=cfg.backend.gguf?await llamacpp.ggufDigest(cfg.backend.gguf).catch(()=>null):null;
  writeEnv({ZAI_BASE_URL:d.url+'/v1',ZAI_API_KEY:'lokal',ZAI_MODEL:d.model,ZAI_CONTEXT_WINDOW_TOKENS:'32768',LOKAL_MODEL_DIGEST:digest??''});
  saveConfig({model:d.model,digest,smokeTest});return status();
 }
 let d=await ollama.detect();
 if(!d.installed){log('machine','Installing Ollama into ~/.local/share/lokal/ollama');d=await ollama.install();}
 if(!d.running)await ollama.serve();
 const s=await status();const model=s.model;
 if(!await ollama.hasModel(model)){log('machine',`Downloading ${model}`);await ollama.pull(model);}
 const digest=await ollama.digest(model);
 const smokeTest=await smoke({baseURL:ollama.openAIBase(),apiKey:'ollama',model});
 const ctx=s.recommendation.options.find(m=>m.id===model)?.contextTokens??32768;
 writeEnv({ZAI_BASE_URL:ollama.openAIBase(),ZAI_API_KEY:'ollama',ZAI_MODEL:model,ZAI_CONTEXT_WINDOW_TOKENS:String(ctx),LOKAL_MODEL_DIGEST:digest??''});
 saveConfig({backend:{kind:'ollama'},model,digest,smokeTest});
 return status();
}
