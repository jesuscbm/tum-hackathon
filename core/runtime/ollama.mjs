import {spawn} from 'node:child_process';
import {existsSync,mkdirSync,createWriteStream,openSync} from 'node:fs';
import {join} from 'node:path';
import {pipeline} from 'node:stream/promises';
import {Readable} from 'node:stream';
import {BIN,HOME,LOGS,ensureDirs} from '../paths.mjs';
import {run,which} from '../exec.mjs';
import {log,progress} from '../events.mjs';
export const OLLAMA_URL=process.env.OLLAMA_HOST?.startsWith('http')?process.env.OLLAMA_HOST:'http://127.0.0.1:11434';
const PRIVATE=join(HOME,'ollama');
// Pinned release (tested 2026-10-30). Override with LOKAL_OLLAMA_VERSION.
export const OLLAMA_VERSION=process.env.LOKAL_OLLAMA_VERSION||'v0.40.13';
async function api(path,body,timeout=10000){
 const r=await fetch(OLLAMA_URL+path,{method:body?'POST':'GET',headers:{'content-type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(timeout)});
 if(!r.ok)throw new Error(`Ollama ${path} HTTP ${r.status}`);return r.json();
}
export async function version(){try{return (await api('/api/version',undefined,2000)).version}catch{return null}}
export async function binary(){
 const own=join(PRIVATE,'bin','ollama');if(existsSync(own))return own;
 return await which('ollama');
}
export async function detect(){
 const [bin,v]=await Promise.all([binary(),version()]);
 return {installed:!!bin,binary:bin,running:!!v,version:v,url:OLLAMA_URL};
}
// No sudo: unpack the official release into ~/.local/share/lokal/ollama.
export async function install(){
 ensureDirs();mkdirSync(PRIVATE,{recursive:true});
 const plat=process.platform,arch=process.arch==='arm64'?'arm64':'amd64';
 const asset=plat==='darwin'?'ollama-darwin.tgz':plat==='linux'?`ollama-linux-${arch}.tar.zst`:null;
 if(!asset)throw new Error('Automatic install supports Linux and macOS. Install Ollama from https://ollama.com and rerun.');
 if(asset.endsWith('.zst')&&!await which('zstd'))throw new Error('Install needs zstd (e.g. `sudo apt install zstd`), or install Ollama from https://ollama.com');
 const url=`https://github.com/ollama/ollama/releases/download/${OLLAMA_VERSION}/${asset}`;
 const file=join(PRIVATE,asset);
 log('ollama',`Downloading ${url}`);
 const res=await fetch(url);if(!res.ok)throw new Error(`Download failed HTTP ${res.status}`);
 const total=Number(res.headers.get('content-length'))||0;let got=0,last=0;
 const body=Readable.fromWeb(res.body);
 body.on('data',c=>{got+=c.length;const pct=total?got/total:0;if(pct-last>0.01){last=pct;progress('ollama-install',`Downloading Ollama ${(got/2**20).toFixed(0)} / ${(total/2**20).toFixed(0)} MB`,pct)}});
 await pipeline(body,createWriteStream(file));
 progress('ollama-install','Unpacking',1);
 const r=await run('tar',[asset.endsWith('.zst')?'--zstd':'-z','-xf',file,'-C',plat==='darwin'?join(PRIVATE,'bin'):PRIVATE],{timeout:600000,source:'ollama'});
 if(plat==='darwin')mkdirSync(join(PRIVATE,'bin'),{recursive:true});
 if(r.code!==0)throw new Error('Unpacking Ollama failed: '+r.stderr.slice(0,200));
 await run('rm',['-f',file],{quiet:true});
 return detect();
}
let served=null;
export async function serve(){
 if(await version())return {started:false};
 const bin=await binary();if(!bin)throw new Error('Ollama is not installed');
 ensureDirs();const out=openSync(join(LOGS,'ollama.log'),'a');
 served=spawn(bin,['serve'],{detached:true,stdio:['ignore',out,out],env:{...process.env,OLLAMA_HOST:OLLAMA_URL.replace(/^https?:\/\//,'')}});
 served.unref();
 for(let i=0;i<40;i++){await new Promise(r=>setTimeout(r,250));if(await version()){log('ollama','Ollama server is up');return {started:true,pid:served.pid}}}
 throw new Error('Ollama did not start; see ~/.local/share/lokal/logs/ollama.log');
}
export async function models(){try{return (await api('/api/tags')).models??[]}catch{return []}}
export async function hasModel(name){return (await models()).some(m=>m.name===name||m.model===name||m.name===`${name}:latest`)}
export async function digest(name){const m=(await models()).find(m=>m.name===name||m.model===name);return m?.digest?`sha256:${m.digest}`:null}
// Streams /api/pull progress lines into progress events.
export async function pull(name){
 const res=await fetch(OLLAMA_URL+'/api/pull',{method:'POST',body:JSON.stringify({name,stream:true})});
 if(!res.ok)throw new Error(`Pull failed HTTP ${res.status}`);
 let buf='';const dec=new TextDecoder();
 for await(const chunk of res.body){
  buf+=dec.decode(chunk,{stream:true});let i;
  while((i=buf.indexOf('\n'))>=0){
   const line=buf.slice(0,i);buf=buf.slice(i+1);if(!line.trim())continue;
   const e=JSON.parse(line);if(e.error)throw new Error(e.error);
   const pct=e.total?e.completed/e.total:undefined;
   progress('model-pull',e.total?`${e.status} ${(e.completed/2**30).toFixed(2)} / ${(e.total/2**30).toFixed(2)} GB`:e.status,pct);
  }
 }
 return digest(name);
}
export const openAIBase=()=>OLLAMA_URL+'/v1';
