import * as sk from '../sokosumi.mjs';
import {loadConfig,saveConfig,readEnv,writeEnv} from '../config.mjs';
import {log} from '../events.mjs';
import {isHeadless,takeOpenedUrl,keychainLocked} from '../vault.mjs';
import {hostname,userInfo} from 'node:os';
import {loadTemplate} from '../../templates/index.mjs';
import * as cw from '../coworkers.mjs';
// Step 3: account → Vendor → Coworker → runtime key → Workspace. Reuses whatever already exists.
export const id='sokosumi',title='Connect Sokosumi';
// Over SSH there is no browser: sign in with an API key (pasted), or open the sign-in link on your laptop
// through an SSH tunnel to the CLI's callback port. The xdg-open stand-in records that link (core/vault.mjs).
const KEY_INPUT={key:'SOKOSUMI_API_KEY',label:`Sokosumi API key (create one at ${sk.API_KEY_PAGE}, starts with soko_preprod_)`,secret:true};
let signIn=null;
export function tunnelCommand(){
 const host=(process.env.SSH_CONNECTION??'').split(' ')[2]||hostname();
 return `ssh -N -L 53682:127.0.0.1:53682 ${userInfo().username}@${host}`;
}
// The name buyers see. Chosen with e in step 3 (or lokal coworker rename); the default names the job and you.
const defaultName=user=>{const t=(()=>{try{return loadTemplate(readEnv().LOKAL_TEMPLATE||'freeform').name}catch{return 'Assistant'}})();return `${t} by ${user?.email?.split('@')[0]??'lokAl'}`;};
export const plannedName=(user)=>{const cfg=loadConfig();return cfg.coworkerName??defaultName(user);};
export async function status(){
 const cli=await sk.installed();
 const env=readEnv(),cfg=loadConfig();
 const items=[{label:'Sokosumi CLI',status:cli.installed?(cli.pinned?'ok':'warn'):'todo',detail:cli.installed?`v${cli.version}${cli.pinned?'':` (lokAl is tested with ${sk.CLI_VERSION})`}`:`installed by the lokal installer (Sokosumi CLI ${sk.CLI_VERSION})`}];
 if(!cli.installed)return {id,title,status:'todo',items};
 if(await keychainLocked())items.push({label:'Keychain',status:'action',detail:'macOS over SSH: run `security unlock-keychain` once per session so the Sokosumi CLI can keep its keys',command:'security unlock-keychain'});
 const user=await sk.whoami();
 const headless=isHeadless();
 const url=takeOpenedUrl();if(url){signIn={url,at:Date.now()};log('sokosumi',`Sign-in link: ${url}`);}
 if(user)signIn=null;
 items.push(user?{label:'Account',status:'ok',detail:user.email}
  :headless?{label:'Account',status:'input',detail:'no browser on this machine: paste a Sokosumi API key, or press b for a sign-in link',input:KEY_INPUT}
  :{label:'Account',status:'action',detail:'sign in once in your browser',command:'sokosumi --preprod auth login'});
 if(!user)return {id,title,status:headless?'input':'action',items,headless,signIn:signIn&&{...signIn,tunnel:tunnelCommand()}};
 const v=await sk.vendor();
 items.push({label:'Vendor',status:v?'ok':'todo',detail:v?`${v.name} (${v.slug})`:'lokAl creates one for you'});
 const coworkerId=env.COWORKER_ID;
 items.push({label:'Coworker',status:coworkerId?'ok':'todo',detail:coworkerId?`${cfg.coworkerName??''} ${coworkerId} · press e to rename, u to switch`.trim():`lokAl registers "${plannedName(user)}" · press e to choose the name, u to use one you already have`});
 const keyOk=!!coworkerId&&(cfg.keyImported===coworkerId||cfg.keyImported===undefined&&!!coworkerId);
 items.push({label:'Runtime key',status:keyOk?'ok':'todo',detail:keyOk?'stored in the CLI vault':'imported straight into the CLI vault'});
 const ws=env.SOKOSUMI_ORGANIZATION_SLUG;
 const orgs=(await sk.workspaces().catch(()=>[])).filter(w=>w.organizationId);
 const cur=ws&&orgs.find(o=>o.slug===ws);
 const workspaces=[{id:'personal',name:'Personal Workspace',hint:'private: only you can send it tasks'},...orgs.map(o=>({id:o.slug,name:o.name??o.slug,hint:`organization · ${o.slug}`}))];
 items.push({label:'Workspace',status:'ok',detail:ws?`${cur?.name??ws} (organization)${orgs.length?' · press o to change':''}`:`Personal Workspace (private testing)${orgs.length===1?` · press o to use ${orgs[0].name??orgs[0].slug}`:orgs.length?` · press o to pick one of your ${orgs.length} organization Workspaces`:''}`});
 const done=v&&coworkerId&&keyOk;
 if(v&&loadConfig().vendorId!==v.id)saveConfig({vendorId:v.id});
 return {id,title,status:done?'ok':'todo',items,user,vendor:v,coworkerId,coworkerName:cfg.coworkerName??null,workspace:ws||'personal',workspaces,organizations:orgs,headless};
}
export function login(){sk.login();}
export async function loginWithKey(key){await sk.loginWithKey(key);return status();}
export async function run(){
 let s=await status();
 if(!s.user&&s.headless)return s; // waits for an API key (or b → sign-in link)
 if(!s.user){sk.login();for(let i=0;i<90&&!(await sk.whoami());i++)await new Promise(r=>setTimeout(r,2000));s=await status();if(!s.user)return s;}
 let v=s.vendor;
 if(!v){const base=s.user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,24);v=await sk.createVendor(`${base} (lokal)`,`lokal-${base}-${Date.now().toString(36).slice(-4)}`);log('sokosumi',`Vendor created: ${v.slug}`);}
 let coworkerId=readEnv().COWORKER_ID;
 if(!coworkerId){
  const name=plannedName(s.user);
  // Reinstalls (e.g. after uninstall.sh) reuse the Coworker lokal registered before instead of piling up new ones
  // (" via lokAl": the fixed name older versions used).
  const prior=(await sk.ownedCoworkers()).find(c=>c.name===name||/ via lokal$/i.test(c.name??''));
  const c=prior??await sk.registerCoworker({vendorId:v.id,name,description:'A local open-weights model served with lokAl. Results are checked before payment.'});
  coworkerId=c.id;writeEnv({COWORKER_ID:coworkerId});saveConfig({coworkerName:c.name??name,vendorId:v.id});log('sokosumi',`${prior?'Reusing':'Registered'} Coworker ${c.name??name} (${coworkerId})`);
  await sk.importRuntimeKey(coworkerId);saveConfig({keyImported:coworkerId});log('sokosumi','Runtime key imported into the CLI vault');
 }
 return status();
}
// An existing Sokosumi Coworker you own becomes the main one instead of a new registration: during setup, or to
// switch later (the previous one becomes spare). Its Workspace approvals carry over. External writes (a new runtime
// key, a Workspace connect): callers confirm first. Pick from coworkers.spare().
export async function useCoworker(coworkerId){
 const s=await status();
 if(!s.user)throw new Error('Sign in to Sokosumi first');
 const c=(await sk.ownedCoworkers()).find(x=>x.id===coworkerId);
 if(!c)throw new Error(`Sokosumi Coworker ${coworkerId} is not one you own`);
 if(sk.retired(c))throw new Error(`${c.name} is retired`);
 const extra=cw.list().find(x=>!x.primary&&x.coworkerId===coworkerId);
 if(extra)throw new Error(`${c.name} is already served here by the Coworker "${extra.name}"`);
 const vendorId=c.vendorId??c.vendor?.id??s.vendor?.id;
 if(!vendorId)throw new Error('No Vendor: press enter in step 3 first so lokAl can find or create it');
 // The key first: COWORKER_ID only points at a Coworker this machine can run.
 await sk.importRuntimeKey(coworkerId);
 writeEnv({COWORKER_ID:coworkerId});saveConfig({coworkerName:c.name??coworkerId,vendorId,keyImported:coworkerId});
 log('sokosumi',`Using the existing Coworker ${c.name??''} (${coworkerId}); runtime key imported`);
 const env=readEnv();let access=null;
 if(env.SOKOSUMI_ORGANIZATION_ID){
  const r=await sk.connectWorkspace({coworkerId,vendorId,organizationId:env.SOKOSUMI_ORGANIZATION_ID}).catch(e=>({error:e.message}));
  access=r.error?'FAILED':r.access??'GRANTED';
  log('sokosumi',r.error?`Workspace connect failed: ${r.error}`:`Workspace ${env.SOKOSUMI_ORGANIZATION_SLUG}: access ${access}`);
 }
 return {...await status(),access,name:c.name??coworkerId};
}
// Before registration: the name to register with. After: renames the Coworker on Sokosumi (external write).
export async function setName(name){
 const n=String(name??'').trim();if(!n||n.length>80)throw new Error('A name has 1 to 80 characters');
 const id=readEnv().COWORKER_ID;
 if(id){await sk.renameCoworker(id,n);log('sokosumi',`Coworker renamed to ${n}`);}
 saveConfig({coworkerName:n});
 return status();
}
// Which Workspace's tasks the Coworkers serve: 'personal', or an organization's slug/id from status().workspaces.
// An organization needs a Workspace connect (an external write: the UI and CLI confirm it first) for every
// Coworker on this machine. PENDING means an admin of that organization must approve; Coworkers that were
// approved before come back GRANTED at once, and new extra Coworkers can reuse them (coworkers.spare()).
export async function useWorkspace(slugOrId){
 if(!slugOrId||slugOrId==='personal'){
  writeEnv({SOKOSUMI_ORGANIZATION_ID:'',SOKOSUMI_ORGANIZATION_SLUG:''});
  log('sokosumi','Using the Personal Workspace. Restart services to pick it up.');return {pending:false,org:null,coworkers:[]};
 }
 const s=await status();
 if(!s.coworkerId||!s.vendor)throw new Error('Create the Coworker first: press enter in setup step 3 (or lokal run sokosumi).');
 const orgs=s.organizations??[];
 const org=orgs.find(o=>o.slug===slugOrId||o.organizationId===slugOrId);
 if(!org)throw new Error(orgs.length?`No organization Workspace "${slugOrId}". Yours: ${orgs.map(o=>o.slug).join(', ')}`:'You are not a member of any organization Workspace. Join one with its invitation link first.');
 const r=await sk.connectWorkspace({coworkerId:s.coworkerId,vendorId:s.vendor.id,organizationId:org.organizationId});
 const out=[{id:'main',name:s.coworkerName??'main',access:r.access??'GRANTED'}];
 for(const c of cw.list())if(!c.primary&&c.coworkerId){
  const x=await sk.connectWorkspace({coworkerId:c.coworkerId,vendorId:s.vendor.id,organizationId:org.organizationId}).catch(e=>({access:'FAILED',error:e.message}));
  out.push({id:c.id,name:c.name,access:x.access??'GRANTED',error:x.error});
  log('sokosumi',x.error?`${c.name}: Workspace connect failed: ${x.error}`:`${c.name}: Workspace access ${x.access??'GRANTED'}`);
 }
 const waiting=out.filter(c=>c.access!=='GRANTED');
 if(r.access&&r.access!=='GRANTED'){log('sokosumi',`Workspace access is ${r.access}: ask a ${org.name} admin to approve, then choose it again.`);return {pending:true,access:r.access,org,coworkers:out};}
 writeEnv({SOKOSUMI_ORGANIZATION_ID:org.organizationId,SOKOSUMI_ORGANIZATION_SLUG:org.slug});
 log('sokosumi',`Using Workspace ${org.name}${waiting.length?` (still waiting for approval: ${waiting.map(c=>c.name).join(', ')})`:''}. Restart services to pick it up.`);
 return {pending:false,org,coworkers:out,waiting:waiting.map(c=>c.name)};
}
