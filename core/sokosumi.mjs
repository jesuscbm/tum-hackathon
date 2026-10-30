import {spawn} from 'node:child_process';
import {json,run,which} from './exec.mjs';
import {log} from './events.mjs';
// Thin wrapper over the pinned Sokosumi CLI (Preprod). Secrets never touch our logs.
export const CLI_VERSION='1.1.0';
const cli=(args,opts={})=>json('sokosumi',['--preprod',...args,'--json'],{source:'sokosumi',quiet:true,timeout:60000,...opts});
export async function installed(){
 if(!await which('sokosumi'))return {installed:false};
 const r=await run('sokosumi',['--version'],{quiet:true,timeout:10000});
 const version=r.stdout.trim().match(/\d+\.\d+\.\d+/)?.[0]??null;
 return {installed:true,version,pinned:version===CLI_VERSION};
}
export async function whoami(){const r=await cli(['auth','whoami']);return r.ok?r.data.user:null;}
// Opens the browser OAuth flow in the background; the caller polls whoami().
// Headless, the xdg-open stand-in (core/vault.mjs) records the URL instead, and the UI shows it.
let loginChild=null;
export function login(){
 if(loginChild&&loginChild.exitCode===null)return;
 loginChild=spawn('sokosumi',['--preprod','auth','login'],{detached:true,stdio:'ignore'});
 loginChild.on('error',()=>{});loginChild.unref();log('sokosumi','Started the Sokosumi sign-in');
}
// No browser needed: a user API key from the Sokosumi web app (Connections page), passed over stdin.
export async function loginWithKey(key){
 const k=String(key??'').trim();
 if(!k.startsWith('soko_preprod_'))throw new Error('That is not a Sokosumi preprod API key (it starts with "soko_preprod_").');
 const r=await run('sokosumi',['--preprod','auth','login','--api-key-stdin','--json'],{input:k+'\n',quiet:true,timeout:60000});
 if(r.code!==0)throw new Error('Sign-in with the API key failed: '+firstLine(r));
 log('sokosumi','Signed in with an API key');
 return whoami();
}
export const API_KEY_PAGE='https://preprod.sokosumi.com/connections';
export async function vendor(){const r=await cli(['vendors','me']);const v=r.data?.vendors??r.data?.vendor??r.data;return Array.isArray(v)?v[0]??null:v??null;}
export async function createVendor(name,slug){const r=await cli(['vendors','create','--name',name,'--slug',slug]);if(!r.ok)throw new Error(firstLine(r));return r.data.vendor??r.data;}
export async function ownedCoworkers(){const r=await cli(['coworkers','list','--scope','owned']);return r.data?.coworkers??[];}
export async function registerCoworker({vendorId,name,description}){
 const r=await cli(['coworkers','register','--personal','--vendor-id',vendorId,'--name',name,'--description',description,'--capability','tasks']);
 if(!r.ok)throw new Error(firstLine(r));return r.data.coworker??r.data;
}
// Sokosumi has no delete for Coworkers: a removed one is renamed so nobody (and no reinstall) picks it up again.
export async function retireCoworker(id,name){const r=await cli(['coworkers','update',id,'--name',`${name} (retired)`.slice(0,120),'--description','Retired: no longer served by lokAl.']);if(!r.ok)throw new Error(firstLine(r));return true;}
// api-key → key-import over stdin; the token only lives in this process's memory.
export async function importRuntimeKey(coworkerId){
 const k=await cli(['coworkers','api-key',coworkerId]);
 const token=k.data?.apiKey?.token;if(!k.ok||typeof token!=='string')throw new Error('Could not create the Coworker runtime key: '+firstLine(k));
 const r=await run('sokosumi',['--preprod','runtime','key-import','--coworker-id',coworkerId,'--api-key-stdin','--json'],{input:token+'\n',quiet:true,timeout:60000});
 if(r.code!==0)throw new Error('Key import failed: '+firstLine(r));
 return true;
}
export async function connectWorkspace({coworkerId,vendorId,organizationId}){
 const r=await cli(['coworkers','connect',coworkerId,'--vendor-id',vendorId,'--workspace-id',organizationId]);
 if(!r.ok)throw new Error(firstLine(r));
 const c=await cli(['workspaces','check',organizationId]);
 return {connect:r.data,check:c.data};
}
export async function workspaces(){const r=await cli(['workspaces','list']);return r.data?.workspaces??r.data?.organizations??[];}
export async function createTask({coworkerId,name,description,organizationSlug}){
 const where=organizationSlug?['--organization-slug',organizationSlug]:['--personal'];
 const r=await cli(['tasks','create',...where,'--coworker-id',coworkerId,'--name',name,'--description',description,'--status','READY']);
 if(!r.ok)throw new Error(firstLine(r));return r.data.task??r.data;
}
export async function getTask(id,organizationSlug){const r=await cli(['tasks','get',id,...(organizationSlug?['--organization-slug',organizationSlug]:[])]);return r.ok?(r.data.task??r.data):null;}
// The CLI prints {"error":"…"} with --json; show the message, not the JSON. A missing route means the CLI is older than Core.
export function firstLine(r){
 const raw=(r.stderr||r.stdout||'').trim();let msg=raw.split('\n').find(l=>l.trim())||`exit ${r.code}`;
 try{const j=JSON.parse(raw);if(typeof j.error==='string')msg=j.error}catch{}
 if(/route_not_found/.test(msg))return `Sokosumi rejected a request from this CLI version (route not found). Install Sokosumi CLI ${CLI_VERSION}: run the lokAl installer again.`;
 return msg.replace(/Core API request failed with status (\d+): .*?"message\\?":\\?"([^"\\]+).*/,'Sokosumi API error $1: $2').slice(0,240);
}
