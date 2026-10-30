import os from 'node:os';
import {readFileSync} from 'node:fs';
import {run,which} from './exec.mjs';
// Machine load for the dashboard: CPU, RAM, GPU, and what each service uses. Best effort, never throws.
let prevCpu=null;
function cpuPct(){
 const t=os.cpus().reduce((a,c)=>{const tot=Object.values(c.times).reduce((x,y)=>x+y,0);return {idle:a.idle+c.times.idle,total:a.total+tot}},{idle:0,total:0});
 const p=prevCpu;prevCpu=t;
 if(!p||t.total===p.total)return null;
 return Math.max(0,Math.min(100,100*(1-(t.idle-p.idle)/(t.total-p.total))));
}
// freemem() leaves out reclaimable cache, so RAM would look nearly full: Linux reports MemAvailable, macOS's
// vm_stat counts free + inactive + speculative + purgeable pages (what Activity Monitor treats as available).
export function availableFromVmStat(text){
 const page=Number(text.match(/page size of (\d+) bytes/)?.[1]);if(!page)return null;
 const n=k=>Number(text.match(new RegExp(`Pages ${k}:\\s+(\\d+)`))?.[1]??0);
 return (n('free')+n('inactive')+n('speculative')+n('purgeable'))*page;
}
async function ram(){
 const total=os.totalmem();let avail=os.freemem();
 try{const m=readFileSync('/proc/meminfo','utf8').match(/MemAvailable:\s+(\d+)/);if(m)avail=Number(m[1])*1024}catch{}
 if(process.platform==='darwin'){const r=await run('vm_stat',[],{quiet:true,timeout:3000});const a=availableFromVmStat(r.stdout);if(a)avail=Math.min(total,a);}
 return {usedGB:+((total-avail)/2**30).toFixed(1),totalGB:+(total/2**30).toFixed(1),pct:100*(total-avail)/total};
}
let smi;
// Apple Silicon: the GPU shares RAM and its load needs `sudo powermetrics`, so it is named without a meter.
async function gpu(){
 if(process.platform==='darwin'&&process.arch==='arm64')return {name:`${os.cpus()[0]?.model?.trim()||'Apple Silicon'} GPU`,unified:true};
 smi??=await which('nvidia-smi');
 if(!smi)return null;
 const r=await run(smi,['--query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu','--format=csv,noheader,nounits'],{quiet:true,timeout:4000});
 const [name,util,used,total,temp]=(r.stdout.split('\n')[0]??'').split(',').map(s=>s.trim());
 if(!name)return null;
 return {name,pct:Number(util),vramUsedGB:+(Number(used)/1024).toFixed(1),vramGB:+(Number(total)/1024).toFixed(1),vramPct:100*Number(used)/Number(total),tempC:Number(temp)};
}
// Per service: sum over its process group (lokAl starts each service as a group leader), so the agent's Eve child
// and pnpm → tsx → node chains are counted. The model server is matched by name (ollama, llama-server).
async function procs(groups){
 const r=await run('ps',['-A','-o','pid=,pgid=,rss=,pcpu=,comm='],{quiet:true,timeout:4000});
 const rows=r.stdout.split('\n').map(l=>l.trim().split(/\s+/)).filter(x=>x.length>=5).map(([pid,pgid,rss,pcpu,...c])=>({pid:+pid,pgid:+pgid,rssMB:+rss/1024,cpu:+pcpu,comm:c.join(' ')}));
 const sum=xs=>({cpu:+xs.reduce((a,x)=>a+x.cpu,0).toFixed(1),memMB:Math.round(xs.reduce((a,x)=>a+x.rssMB,0)),n:xs.length});
 const out={};
 for(const [id,pids] of Object.entries(groups)){const set=new Set(pids);const xs=rows.filter(x=>set.has(x.pgid)||set.has(x.pid));if(xs.length)out[id]=sum(xs);}
 const model=rows.filter(x=>/ollama|llama-server/.test(x.comm));if(model.length)out.model=sum(model);
 return out;
}
export async function resources(serviceList=[]){
 const groups={};
 for(const s of serviceList)if(s.pid){const k=s.kind??s.id;(groups[k]??=[]).push(s.pid);}
 const [g,p,m]=await Promise.all([gpu().catch(()=>null),procs(groups).catch(()=>({})),ram()]);
 return {at:Date.now(),cpu:{pct:cpuPct(),cores:os.cpus().length,load:os.loadavg()[0]},ram:m,gpu:g,procs:p};
}
