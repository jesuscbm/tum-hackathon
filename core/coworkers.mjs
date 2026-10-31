import {existsSync,mkdirSync,readdirSync,symlinkSync,copyFileSync,writeFileSync,rmSync,lstatSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {COWORKER_DIR,HOME} from './paths.mjs';
import {readEnv,writeEnv,loadConfig} from './config.mjs';
import {loadTemplate,priceFor} from '../templates/index.mjs';
import * as sk from './sokosumi.mjs';
import {log} from './events.mjs';
// Several Coworkers on one machine. The first one ("main") is the coworker/ folder the wizard sets up.
// Each extra one is a folder under $LOKAL_HOME/coworkers/<id> with its own .env, journals, prompt and ports;
// the code is symlinked from coworker/ (Node resolves imports from the real path; files are read from the cwd).
// Model, Sokosumi account, Workspace, payment service and selling wallet are shared with main.
export const EXTRA_DIR=()=>join(HOME,'coworkers');
const ID=/^[a-z0-9][a-z0-9-]{0,31}$/;
// Keys an extra Coworker takes from main at every start, unless its own .env sets them (per-Coworker model override).
export const SHARED_KEYS=['ZAI_API_KEY','ZAI_BASE_URL','ZAI_MODEL','ZAI_CONTEXT_WINDOW_TOKENS','LOKAL_MODEL_DIGEST','BLOCKFROST_API_KEY_PREPROD','BLOCKFROST_API_KEY_MAINNET',
 'SOKOSUMI_ORGANIZATION_ID','SOKOSUMI_ORGANIZATION_SLUG','AGENT_AUTHOR','MPS_PORT','MPS_URL','LOKAL_NETWORK'];
export const slug=name=>String(name??'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,32);
function describe(id,dir,primary){
 const env=readEnv(join(dir,'.env'));
 const paid=env.PAID_TASKS_ENABLED==='true';
 return {id,dir,primary,name:env.LOKAL_COWORKER_NAME||(primary?'main':id),template:env.LOKAL_TEMPLATE||null,coworkerId:env.COWORKER_ID||null,paid,
  ports:{eve:Number(env.EVE_PORT||21949),api:Number(env.AGENT_API_PORT||21950)},model:env.ZAI_MODEL||null,price:priceFor(env).display,env};
}
export function list(){
 const out=[describe('main',COWORKER_DIR,true)];
 if(existsSync(EXTRA_DIR()))for(const d of readdirSync(EXTRA_DIR()).sort())if(ID.test(d)&&existsSync(join(EXTRA_DIR(),d,'.env')))out.push(describe(d,join(EXTRA_DIR(),d),false));
 return out;
}
export const get=id=>list().find(c=>c.id===(id||'main'))??null;
// Environment for a Coworker's processes: --env-file never overrides variables that are already set, so
// passing main's shared values here makes model/Workspace changes reach every Coworker on its next start.
export function sharedEnv(c){
 if(c.primary)return {};
 const main=readEnv(join(COWORKER_DIR,'.env'));
 return Object.fromEntries(SHARED_KEYS.filter(k=>!c.env[k]&&main[k]!==undefined).map(k=>[k,main[k]]));
}
function freePorts(){
 const used=new Set(list().flatMap(c=>[c.ports.eve,c.ports.api]));
 for(let p=21951;p<22100;p+=2)if(!used.has(p)&&!used.has(p+1))return {eve:p,api:p+1};
 throw new Error('No free ports left for another Coworker');
}
// Code files come from coworker/ (symlinks, so updates reach every Coworker); state stays in the folder.
export function linkCode(dir){
 mkdirSync(join(dir,'agent'),{recursive:true,mode:0o700});mkdirSync(join(dir,'.local'),{recursive:true,mode:0o700});mkdirSync(join(dir,'docs'),{recursive:true});
 for(const f of readdirSync(COWORKER_DIR))if((f.endsWith('.mjs')&&!f.endsWith('.test.mjs'))||f==='node_modules'){
  const to=join(dir,f);try{lstatSync(to);continue}catch{}
  symlinkSync(join(COWORKER_DIR,f),to);
 }
 // Real copies: Eve finds its project by a package.json *file* and compiles agent.ts from this folder.
 copyFileSync(join(COWORKER_DIR,'package.json'),join(dir,'package.json'));
 copyFileSync(join(COWORKER_DIR,'agent','agent.ts'),join(dir,'agent','agent.ts'));
}
// Sokosumi Coworkers you own that no Coworker on this machine uses (e.g. left by a removed one) and that are not
// retired. Reusing one keeps its Workspace approvals, so an organization Workspace needs no new admin approval.
// granted: last connect to main's Workspace came back GRANTED (sorted first).
export async function spare(){
 const used=new Set(list().map(c=>c.coworkerId).filter(Boolean));
 const org=readEnv(join(COWORKER_DIR,'.env')).SOKOSUMI_ORGANIZATION_ID||null;
 const owned=(await sk.ownedCoworkers()).filter(c=>c.id&&!used.has(c.id)&&!sk.retired(c));
 return owned.map(c=>({id:c.id,name:c.name??c.id,access:org?sk.knownAccess(c.id,org):null,granted:!!org&&sk.knownAccess(c.id,org)==='GRANTED'}))
  .sort((a,b)=>b.granted-a.granted);
}
// Gives a Coworker folder its Sokosumi Coworker: a reused one (renamed to this name) or a new registration,
// then a runtime key and, when main serves an organization Workspace, a connect (GRANTED at once if approved before).
async function attach(dir,name,t,{reuse,vendorId}){
 const main=readEnv(join(COWORKER_DIR,'.env'));
 const label=`${name} · lokAl`;
 let c;
 if(reuse){
  const s=(await spare()).find(x=>x.id===reuse);
  if(!s)throw new Error(`Sokosumi Coworker ${reuse} is not free to reuse (not yours, retired, or used by another Coworker here)`);
  await sk.renameCoworker(reuse,label).catch(e=>log('coworkers',`Kept the old name on Sokosumi: ${e.message}`));
  c={id:reuse,name:label};log('coworkers',`Reusing Sokosumi Coworker ${s.name} (${reuse}) as ${label}`);
 }else{
  c=await sk.registerCoworker({vendorId,name:label,description:t.description||'A model served with lokAl. Results are checked before payment.'});
  log('coworkers',`Registered Coworker ${c.name} (${c.id}) on Sokosumi`);
 }
 writeEnv({COWORKER_ID:c.id},join(dir,'.env'));
 await sk.importRuntimeKey(c.id);log('coworkers','Runtime key imported');
 let access=null;
 if(main.SOKOSUMI_ORGANIZATION_ID){
  const r=await sk.connectWorkspace({coworkerId:c.id,vendorId,organizationId:main.SOKOSUMI_ORGANIZATION_ID}).catch(e=>({error:e.message}));
  access=r.error?'FAILED':r.access??'GRANTED';
  log('coworkers',r.error?`Workspace connect failed: ${r.error}`:access==='GRANTED'?`Connected to Workspace ${main.SOKOSUMI_ORGANIZATION_SLUG}`:`Workspace ${main.SOKOSUMI_ORGANIZATION_SLUG}: access ${access}, waiting for an admin to approve`);
 }
 return access;
}
const vendorOf=async()=>loadConfig().vendorId??(await sk.vendor())?.id;
// Creates the folder and (with register) its Sokosumi Coworker: an external write, so callers confirm first.
// reuse: the id of a spare() Sokosumi Coworker to take over instead of registering a new one.
export async function add({name,template,register=true,reuse}){
 const id=slug(name);
 if(!ID.test(id)||id==='main')throw new Error('Name it with letters and digits (not "main")');
 const dir=join(EXTRA_DIR(),id);
 if(existsSync(join(dir,'.env')))throw new Error(`A Coworker called ${id} already exists`);
 const t=loadTemplate(template);
 const vendorId=register?await vendorOf():null;
 if(register&&!vendorId)throw new Error('Connect Sokosumi first (setup step 3): a new Coworker needs your Vendor');
 const ports=freePorts();
 linkCode(dir);
 writeFileSync(join(dir,'agent','instructions.md'),t.prompt);
 writeFileSync(join(dir,'.env'),'# lokal: this Coworker\'s own settings. Model, Workspace and payment settings come from the main Coworker unless set here.\n',{mode:0o600});
 writeEnv({LOKAL_COWORKER_NAME:name,COWORKER_ID:'',EVE_PORT:String(ports.eve),EVE_URL:`http://127.0.0.1:${ports.eve}`,AGENT_API_PORT:String(ports.api),
  PAID_TASKS_ENABLED:'false',LOKAL_TEMPLATE:t.id,LOKAL_AGENT_NAME:`${name} (lokAl)`,LOKAL_AGENT_DESCRIPTION:t.description??''},join(dir,'.env'));
 // Shared selling wallet: registration for this Coworker reuses main's payment source and wallet.
 const ps=join(COWORKER_DIR,'docs','payment-state.json');if(existsSync(ps))copyFileSync(ps,join(dir,'docs','payment-state.json'));
 log('coworkers',`Created ${dir}`);
 let access=null;
 if(register){
  try{access=await attach(dir,name,t,{reuse,vendorId});}
  catch(e){log('coworkers',`Sokosumi ${reuse?'reuse':'registration'} failed: ${e.message}. Retry with: lokal coworker register ${id}${reuse?` --reuse ${reuse}`:''}`,'error');}
 }
 return {...get(id),access};
}
// Gives an existing folder without a Sokosumi Coworker one (e.g. after a failed add): new, or reuse a spare one.
export async function registerOnSokosumi(id,{reuse}={}){
 const c=get(id);if(!c||c.primary)throw new Error(`No extra Coworker ${id}`);
 if(c.coworkerId)return c;
 const vendorId=await vendorOf();if(!vendorId)throw new Error('Connect Sokosumi first');
 const access=await attach(c.dir,c.name,loadTemplate(c.template||'freeform'),{reuse,vendorId});
 return {...get(id),access};
}
// New display name, locally and on Sokosumi (an external write: callers confirm it first).
export async function rename(id,name){
 const c=get(id);if(!c||c.primary)throw new Error(`No extra Coworker ${id}`);
 const n=String(name??'').trim();if(!n||n.length>80)throw new Error('A name has 1 to 80 characters');
 if(c.coworkerId)await sk.renameCoworker(c.coworkerId,`${n} · lokAl`);
 writeEnv({LOKAL_COWORKER_NAME:n,LOKAL_AGENT_NAME:`${n} (lokAl)`},join(c.dir,'.env'));
 return get(id);
}
export function setTemplate(id,templateId){
 const c=get(id);if(!c)throw new Error(`No Coworker ${id}`);
 const t=loadTemplate(templateId);
 writeFileSync(join(c.dir,'agent','instructions.md'),t.prompt);
 writeEnv({LOKAL_TEMPLATE:t.id,LOKAL_AGENT_DESCRIPTION:t.description??''},join(c.dir,'.env'));
 return get(id);
}
// Local removal. With retire, the Sokosumi Coworker is renamed "(retired)" (Sokosumi has no delete).
// Registry entries and on-chain history stay; the caller stops the Coworker's processes first.
export async function remove(id,{retire=false}={}){
 const c=get(id);
 if(!c)throw new Error(`No Coworker ${id}`);
 if(c.primary)throw new Error('The main Coworker is the one the setup wizard manages; it cannot be removed here');
 if(retire&&c.coworkerId)await sk.retireCoworker(c.coworkerId,c.name).catch(e=>log('coworkers',`Could not retire on Sokosumi: ${e.message}`,'error'));
 const lock=join(c.dir,'.local','worker.lock');
 if(existsSync(lock)){const pid=Number(readFileSync(lock,'utf8'));try{process.kill(pid,0);throw new Error(`Its worker (pid ${pid}) is still running; stop it first`)}catch(e){if(e.code!=='ESRCH')throw e}}
 rmSync(c.dir,{recursive:true,force:true});
 log('coworkers',`Removed ${id}`);
 return list();
}
