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
function ram(){
 const total=os.totalmem();let avail=os.freemem();
 // Linux: MemAvailable counts reclaimable cache, which freemem() does not.
 try{const m=readFileSync('/proc/meminfo','utf8').match(/MemAvailable:\s+(\d+)/);if(m)avail=Number(m[1])*1024}catch{}
 return {usedGB:+((total-avail)/2**30).toFixed(1),totalGB:+(total/2**30).toFixed(1),pct:100*(total-avail)/total};
}
let smi;
async function gpu(){
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
 const [g,p]=await Promise.all([gpu().catch(()=>null),procs(groups).catch(()=>({}))]);
 return {at:Date.now(),cpu:{pct:cpuPct(),cores:os.cpus().length,load:os.loadavg()[0]},ram:ram(),gpu:g,procs:p};
}
