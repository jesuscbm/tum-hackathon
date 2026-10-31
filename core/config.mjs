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
// Node's --env-file ends an unquoted value at " #" and has no escapes in double quotes: quote what needs it,
// and refuse line breaks (a pasted "x\nPAID_TASKS_ENABLED=true" must not become a second setting).
export function envValue(v){
 const s=String(v??'');
 if(/[\r\n]/.test(s))throw new Error('A setting cannot contain a line break');
 if(!/#|^\s|\s$|^['"`]/.test(s))return s;
 if(!s.includes("'"))return `'${s}'`;
 if(!s.includes('"'))return `"${s}"`;
 throw new Error('A setting cannot contain both \' and " together with # or edge spaces');
}
export function writeEnv(patch,file=ENV_FILE()){
 for(const v of Object.values(patch))envValue(v);
 const lines=existsSync(file)?readFileSync(file,'utf8').split('\n'):(existsSync(join(COWORKER_DIR,'.env.example'))?readFileSync(join(COWORKER_DIR,'.env.example'),'utf8').split('\n'):[]);
 const left={...patch};
 const next=lines.map(line=>{const m=line.match(/^\s*([A-Z0-9_]+)\s*=/);if(m&&m[1] in left){const v=left[m[1]];delete left[m[1]];return `${m[1]}=${envValue(v)}`}return line;});
 while(next.length&&next.at(-1)==='')next.pop();
 for(const [k,v] of Object.entries(left))next.push(`${k}=${envValue(v)}`);
 writeFileSync(file,next.join('\n')+'\n',{mode:0o600});chmodSync(file,0o600);
 return readEnv(file);
}
