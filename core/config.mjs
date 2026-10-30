import {existsSync,readFileSync,writeFileSync,chmodSync} from 'node:fs';
import {join} from 'node:path';
import {CONFIG,COWORKER_DIR,ensureDirs} from './paths.mjs';
export function loadConfig(){try{return JSON.parse(readFileSync(CONFIG,'utf8'))}catch{return {}}}
export function saveConfig(patch){ensureDirs();const next={...loadConfig(),...patch};writeFileSync(CONFIG,JSON.stringify(next,null,1),{mode:0o600});return next;}
// coworker/.env: read as a map; write merges keys in place and keeps comments and order.
export const ENV_FILE=()=>join(COWORKER_DIR,'.env');
export function readEnv(file=ENV_FILE()){
 if(!existsSync(file))return {};
 const out={};for(const line of readFileSync(file,'utf8').split('\n')){const m=line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);if(m)out[m[1]]=m[2].trim().replace(/^(['"])(.*)\1$/,'$2');}
 return out;
}
export function writeEnv(patch,file=ENV_FILE()){
 const lines=existsSync(file)?readFileSync(file,'utf8').split('\n'):(existsSync(join(COWORKER_DIR,'.env.example'))?readFileSync(join(COWORKER_DIR,'.env.example'),'utf8').split('\n'):[]);
 const left={...patch};
 const next=lines.map(line=>{const m=line.match(/^\s*([A-Z0-9_]+)\s*=/);if(m&&m[1] in left){const v=left[m[1]];delete left[m[1]];return `${m[1]}=${v??''}`}return line;});
 while(next.length&&next.at(-1)==='')next.pop();
 for(const [k,v] of Object.entries(left))next.push(`${k}=${v??''}`);
 writeFileSync(file,next.join('\n')+'\n',{mode:0o600});chmodSync(file,0o600);
 return readEnv(file);
}
