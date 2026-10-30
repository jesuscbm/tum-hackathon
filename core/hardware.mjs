import os from 'node:os';
import {run,which} from './exec.mjs';
// Best-effort detection. Unknown fields stay null; never throws.
export async function detectHardware(){
 const hw={os:process.platform,arch:process.arch,cpu:os.cpus()[0]?.model?.replace(/\s+/g,' ').trim()??'unknown',cores:os.cpus().length,
  ramGB:+(os.totalmem()/2**30).toFixed(1),freeRamGB:+(os.freemem()/2**30).toFixed(1),gpu:null};
 if(await which('nvidia-smi')){
  const r=await run('nvidia-smi',['--query-gpu=name,memory.total','--format=csv,noheader,nounits'],{quiet:true,timeout:8000});
  const [name,mem]=r.stdout.split('\n')[0]?.split(',').map(s=>s.trim())??[];
  if(name)hw.gpu={vendor:'nvidia',name,vramGB:+(Number(mem)/1024).toFixed(1)};
 }
 if(!hw.gpu&&process.platform==='darwin'&&process.arch==='arm64')hw.gpu={vendor:'apple',name:'Apple Silicon (unified memory)',vramGB:+(hw.ramGB*0.66).toFixed(1)};
 if(!hw.gpu&&await which('rocm-smi'))hw.gpu={vendor:'amd',name:'AMD GPU (ROCm)',vramGB:null};
 if(!hw.gpu&&process.platform==='linux'){
  const r=await run('sh',['-c','lspci 2>/dev/null | grep -iE "vga|3d"'],{quiet:true,timeout:5000});
  const line=r.stdout.split('\n')[0];if(line)hw.integratedGpu=line.replace(/^.*?:\s*/,'').replace(/\s*\(rev.*$/,'');
 }
 return hw;
}
