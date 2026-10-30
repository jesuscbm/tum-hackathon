import {spawn} from 'node:child_process';
import {log} from './events.mjs';
// Run a command, collect output. Never logs stdin (may carry secrets).
export function run(cmd,args=[],{cwd,env,input,timeout=120000,source=cmd,quiet=false}={}){
 return new Promise((resolve)=>{
  let child;
  try{child=spawn(cmd,args,{cwd,env:{...process.env,...env},stdio:['pipe','pipe','pipe']})}catch(e){return resolve({code:127,stdout:'',stderr:e.message})}
  let stdout='',stderr='';const t=setTimeout(()=>child.kill('SIGTERM'),timeout);
  child.stdout.on('data',d=>{stdout+=d});
  child.stderr.on('data',d=>{stderr+=d;if(!quiet)for(const l of String(d).split('\n'))if(l.trim())log(source,l)});
  child.on('error',e=>{clearTimeout(t);resolve({code:127,stdout,stderr:stderr+e.message})});
  child.on('close',code=>{clearTimeout(t);resolve({code,stdout,stderr})});
  if(input!==undefined)child.stdin.end(input);else child.stdin.end();
 });
}
export async function which(cmd){const r=await run('sh',['-c',`command -v ${cmd}`],{quiet:true,timeout:5000});return r.code===0?r.stdout.trim():null;}
export async function json(cmd,args,opts){
 const r=await run(cmd,args,opts);
 let data=null;try{data=JSON.parse(r.stdout)}catch{}
 return {...r,ok:r.code===0&&data!==null,data};
}
