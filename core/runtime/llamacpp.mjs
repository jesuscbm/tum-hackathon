import {statSync,createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {which} from '../exec.mjs';
// llama.cpp support: detect an existing llama-server; weights digest = sha256 of the GGUF.
// Automatic download of llama-server is not implemented yet (Ollama is the default path).
export const LLAMACPP_URL=process.env.LLAMACPP_URL||'http://127.0.0.1:8080';
export async function detect(){
 const bin=await which('llama-server');
 let running=false,model=null;
 try{const r=await fetch(LLAMACPP_URL+'/v1/models',{signal:AbortSignal.timeout(1500)});if(r.ok){running=true;model=(await r.json()).data?.[0]?.id??null}}catch{}
 return {installed:!!bin,binary:bin,running,model,url:LLAMACPP_URL};
}
export async function ggufDigest(file){
 statSync(file);const h=createHash('sha256');
 for await(const c of createReadStream(file))h.update(c);
 return 'sha256:'+h.digest('hex');
}
export const openAIBase=()=>LLAMACPP_URL+'/v1';
