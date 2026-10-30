import {EventEmitter} from 'node:events';
import {appendFileSync} from 'node:fs';
import {join} from 'node:path';
import {LOGS,ensureDirs} from './paths.mjs';
// One bus for the whole app. Event types: log, progress, step, job, health.
export const bus=new EventEmitter();
bus.setMaxListeners(50);
const tail=[];
export function log(source,line,level='info'){
 const e={type:'log',source,line:String(line).replace(/\s+$/,''),level,at:Date.now()};
 tail.push(e);if(tail.length>500)tail.shift();
 try{ensureDirs();appendFileSync(join(LOGS,'lokal.log'),`${new Date(e.at).toISOString()} [${source}] ${e.line}\n`)}catch{}
 bus.emit('log',e);
}
export const recentLogs=(n=50,source)=>tail.filter(e=>!source||e.source===source).slice(-n);
export function progress(id,label,pct){bus.emit('progress',{type:'progress',id,label,pct,at:Date.now()});}
