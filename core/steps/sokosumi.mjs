import * as sk from '../sokosumi.mjs';
import {loadConfig,saveConfig,readEnv,writeEnv} from '../config.mjs';
import {log} from '../events.mjs';
import {isHeadless,takeOpenedUrl,keychainLocked} from '../vault.mjs';
import {hostname,userInfo} from 'node:os';
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
export async function status(){
 const cli=await sk.installed();
 const env=readEnv(),cfg=loadConfig();
 const items=[{label:'Sokosumi CLI',status:cli.installed?(cli.pinned?'ok':'warn'):'todo',detail:cli.installed?`v${cli.version}${cli.pinned?'':` (lokAl is tested with ${sk.CLI_VERSION})`}`:`installed by the lokal installer (npm i -g @masumi_network/sokosumi@${sk.CLI_VERSION})`}];
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
 items.push({label:'Coworker',status:coworkerId?'ok':'todo',detail:coworkerId?`${cfg.coworkerName??''} ${coworkerId}`.trim():'lokAl registers a private Coworker'});
 const keyOk=!!coworkerId&&(cfg.keyImported===coworkerId||cfg.keyImported===undefined&&!!coworkerId);
 items.push({label:'Runtime key',status:keyOk?'ok':'todo',detail:keyOk?'stored in the CLI vault':'imported straight into the CLI vault'});
 const ws=env.SOKOSUMI_ORGANIZATION_SLUG;
 const orgs=(await sk.workspaces().catch(()=>[])).filter(w=>w.organizationId);
 items.push({label:'Workspace',status:'ok',detail:ws?`${ws} (organization)`:`Personal Workspace (private testing)${orgs.length?` · press o to use ${orgs[0].name}`:''}`});
 const done=v&&coworkerId&&keyOk;
 if(v&&loadConfig().vendorId!==v.id)saveConfig({vendorId:v.id});
 return {id,title,status:done?'ok':'todo',items,user,vendor:v,coworkerId,workspace:ws??'personal',organizations:orgs,headless};
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
  const cfg=loadConfig();const name=`${cfg.model??'local model'} via lokAl`;
  // Reinstalls (e.g. after uninstall.sh) reuse the Coworker lokal registered before instead of piling up new ones.
  const prior=(await sk.ownedCoworkers()).find(c=>/ via lokal$/i.test(c.name??''));
  const c=prior??await sk.registerCoworker({vendorId:v.id,name,description:'A local open-weights model served with lokAl. Results are checked before payment.'});
  coworkerId=c.id;writeEnv({COWORKER_ID:coworkerId});saveConfig({coworkerName:c.name??name,vendorId:v.id});log('sokosumi',`${prior?'Reusing':'Registered'} Coworker ${c.name??name} (${coworkerId})`);
  await sk.importRuntimeKey(coworkerId);saveConfig({keyImported:coworkerId});log('sokosumi','Runtime key imported into the CLI vault');
 }
 return status();
}
// Move the Coworker to an organization Workspace (e.g. the event's). PENDING means an admin must approve.
export async function useOrganization(slugOrId){
 const s=await status();
 const org=(s.organizations??[]).find(o=>o.slug===slugOrId||o.organizationId===slugOrId)??s.organizations?.[0];
 if(!org)throw new Error('You are not a member of any organization Workspace. Join one with its invitation link first.');
 const r=await sk.connectWorkspace({coworkerId:s.coworkerId,vendorId:s.vendor.id,organizationId:org.organizationId});
 const access=r.connect?.access?.status??r.connect?.workspaceAccess?.status??r.connect?.status;
 if(access&&access!=='GRANTED'){log('sokosumi',`Workspace access is ${access}: ask a ${org.name} admin to approve, then press o again.`);return {pending:true,access};}
 writeEnv({SOKOSUMI_ORGANIZATION_ID:org.organizationId,SOKOSUMI_ORGANIZATION_SLUG:org.slug});
 log('sokosumi',`Using Workspace ${org.name}. Restart services to pick it up.`);
 return {pending:false,org};
}
export function usePersonal(){writeEnv({SOKOSUMI_ORGANIZATION_ID:'',SOKOSUMI_ORGANIZATION_SLUG:''});}
