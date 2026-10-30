import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {join,dirname,delimiter} from 'node:path';
import {randomBytes} from 'node:crypto';
import {HOME} from '../core/paths.mjs';
import {run,which} from '../core/exec.mjs';
import {log,progress} from '../core/events.mjs';
import {readEnv} from '../core/config.mjs';
import {files,mpsUrl,mps,readJson,writeJson,readSecretEnv} from './state.mjs';
// Masumi Payment Service: our own instance, own Postgres (docker), own wallets. Idempotent phases:
//   A (no secrets needed): Postgres, source, pnpm install, migrate
//   B (needs the Blockfrost preprod key): seed wallets + payment source
export const MPS_DIR=join(HOME,'masumi-payment-service');
const DB_NAME='lokal-mps-db',DB_PORT=55432;
const PNPM_VERSION='10.30.2'; // the service's packageManager field
// Pinned commit (tested 2026-10-30). Override with LOKAL_MPS_REF to try a newer one.
const MPS_REF=process.env.LOKAL_MPS_REF||'a846392ccfc8f5a85aee594ad9441dc90820dab0';
const GLOBAL=join(HOME,'npm-global');
// Child processes use the Node lokal runs on (the installer's private Node 24) and our private pnpm.
export function toolEnv(){return {PATH:[dirname(process.execPath),join(GLOBAL,'bin'),process.env.PATH].join(delimiter),NPM_CONFIG_UPDATE_NOTIFIER:'false',CI:'true'};}
const sh=(cmd,args,opts={})=>run(cmd,args,{source:'mps',env:toolEnv(),...opts});
export async function health(){
 try{const r=await fetch(mpsUrl()+'/api/v1/health',{signal:AbortSignal.timeout(3000)});return r.ok}catch{return false}
}
export async function status(){
 const up=await health();const secrets=readSecretEnv(files.mpsEnv);
 return {up,url:mpsUrl(),prepared:secrets.LOKAL_PREPARED==='1',installed:secrets.LOKAL_SEEDED==='1',adminKey:!!secrets.ADMIN_KEY,payment:readJson(files.payment)};
}
async function must(r,what){if(r.code!==0)throw new Error(`${what} failed: ${(r.stderr||r.stdout).trim().split('\n').slice(-3).join(' | ').slice(0,300)}`);return r;}
async function ensurePnpm(){
 const v=await sh('pnpm',['--version'],{quiet:true,timeout:20000});
 if(v.code===0&&v.stdout.trim()===PNPM_VERSION)return;
 progress('mps',`Installing pnpm ${PNPM_VERSION} (private)`,0.3);
 await must(await sh(join(dirname(process.execPath),'npm'),['install','--global','--prefix',GLOBAL,`pnpm@${PNPM_VERSION}`,'--no-audit','--no-fund'],{timeout:300000}),'pnpm install');
}
function secrets(){
 const s=readSecretEnv(files.mpsEnv);
 const next={ADMIN_KEY:s.ADMIN_KEY||randomBytes(24).toString('hex'),LOKAL_DB_PASSWORD:s.LOKAL_DB_PASSWORD||randomBytes(18).toString('hex'),LOKAL_ENCRYPTION_KEY:s.LOKAL_ENCRYPTION_KEY||randomBytes(24).toString('hex'),LOKAL_PREPARED:s.LOKAL_PREPARED||'0',LOKAL_SEEDED:s.LOKAL_SEEDED||'0'};
 return next;
}
function saveSecrets(s){mkdirSync(dirname(files.mpsEnv),{recursive:true,mode:0o700});writeFileSync(files.mpsEnv,Object.entries(s).map(([k,v])=>`${k}=${v}`).join('\n')+'\n',{mode:0o600});}
function writeServiceEnv(s){
 const env=readEnv();
 writeFileSync(join(MPS_DIR,'.env'),[`DATABASE_URL="postgresql://masumi:${s.LOKAL_DB_PASSWORD}@127.0.0.1:${DB_PORT}/masumi?schema=public"`,`ENCRYPTION_KEY="${s.LOKAL_ENCRYPTION_KEY}"`,`ADMIN_KEY="${s.ADMIN_KEY}"`,`PORT="${env.MPS_PORT||'38127'}"`,`BLOCKFROST_API_KEY_PREPROD="${env.BLOCKFROST_API_KEY_PREPROD||''}"`,'SEED_ONLY_IF_EMPTY=True','OTEL_EXPORTER_OTLP_ENDPOINT=""',''].join('\n'),{mode:0o600});
}
async function waitForDb(s){
 for(let i=0;i<30;i++){const r=await run('docker',['exec',DB_NAME,'pg_isready','-U','masumi'],{quiet:true,timeout:10000});if(r.code===0)return;await new Promise(r=>setTimeout(r,1000));}
 throw new Error('Postgres did not become ready');
}
// Phase A. Safe to run before the user has a Blockfrost key.
export async function prepare(){
 if(!await which('docker'))throw new Error('Docker is needed for the payment database. Install Docker, then retry.');
 if((await run('docker',['info'],{quiet:true,timeout:20000})).code!==0)throw new Error('Docker is installed but not running (or your user cannot use it). Start Docker, then retry.');
 if(!await which('git'))throw new Error('git is needed. Install git, then retry.');
 const s=secrets();saveSecrets(s);
 progress('mps','Starting Postgres (docker)',0.05);
 const ps=await run('docker',['ps','-a','--filter',`name=^${DB_NAME}$`,'--format','{{.Status}}'],{quiet:true});
 if(!ps.stdout.trim())await must(await sh('docker',['run','-d','--name',DB_NAME,'--restart','unless-stopped','-e','POSTGRES_USER=masumi','-e',`POSTGRES_PASSWORD=${s.LOKAL_DB_PASSWORD}`,'-e','POSTGRES_DB=masumi','-p',`127.0.0.1:${DB_PORT}:5432`,'postgres:16'],{timeout:600000}),'docker run postgres');
 else if(!ps.stdout.startsWith('Up'))await must(await sh('docker',['start',DB_NAME]),'docker start');
 await waitForDb(s);
 progress('mps','Fetching the payment service',0.15);
 if(!existsSync(join(MPS_DIR,'.git'))){
  mkdirSync(MPS_DIR,{recursive:true});
  await must(await sh('git',['init','-q'],{cwd:MPS_DIR}),'git init');
  await must(await sh('git',['remote','add','origin','https://github.com/masumi-network/masumi-payment-service.git'],{cwd:MPS_DIR}),'git remote');
 }
 const head=(await sh('git',['rev-parse','HEAD'],{cwd:MPS_DIR,quiet:true})).stdout.trim();
 if(head!==MPS_REF){
  await must(await sh('git',['fetch','--depth','1','origin',MPS_REF],{cwd:MPS_DIR,timeout:600000}),'git fetch');
  await must(await sh('git',['checkout','-q','--force',MPS_REF],{cwd:MPS_DIR}),'git checkout');
 }
 writeServiceEnv(s);
 await ensurePnpm();
 progress('mps','Installing dependencies (a few minutes)',0.4);
 await must(await sh('pnpm',['install','--frozen-lockfile'],{cwd:MPS_DIR,timeout:1800000}),'pnpm install');
 progress('mps','Migrating database',0.75);
 await must(await sh('pnpm',['run','prisma:migrate'],{cwd:MPS_DIR,timeout:300000}),'prisma migrate');
 saveSecrets({...secrets(),LOKAL_PREPARED:'1'});
 progress('mps','Payment service prepared',0.8);
 return status();
}
// Phase B. Seeding creates the wallets and the Preprod payment source; it needs Blockfrost.
export async function seed(){
 if(!readEnv().BLOCKFROST_API_KEY_PREPROD)throw new Error('A Blockfrost preprod key is needed to create the wallets.');
 const s=secrets();writeServiceEnv(s);
 progress('mps','Creating wallets and payment source',0.9);
 const r=await must(await sh('pnpm',['run','prisma:seed'],{cwd:MPS_DIR,timeout:300000,quiet:true}),'prisma seed');
 writeFileSync(join(HOME,'mps-seed.log'),r.stdout+r.stderr,{mode:0o600}); // seed may print wallet mnemonics: private file only
 saveSecrets({...secrets(),LOKAL_SEEDED:'1'});
 progress('mps','Payment service ready',1);
 return status();
}
export async function setup(){const st=await status();if(!st.prepared)await prepare();if(readEnv().BLOCKFROST_API_KEY_PREPROD&&!(await status()).installed)await seed();return status();}
// Command the supervisor runs to keep the service up.
export function command(){return {cmd:'pnpm',args:['run','dev'],cwd:MPS_DIR,env:toolEnv()};}
// After the service is up: record our Preprod V2 source + selling wallet for the coworker.
export async function recordPaymentState(){
 const existing=readJson(files.payment);if(existing?.sourceId&&existing?.walletId&&existing?.sellerAddress)return existing;
 const data=await mps('/payment-source?take=100');
 const list=data.PaymentSources??data.paymentSources??data.ExtendedPaymentSources??(Array.isArray(data)?data:[]);
 const src=list.find(s=>s.network==='Preprod'&&(s.paymentSourceType==='Web3CardanoV2'||!s.paymentSourceType));
 if(!src)throw new Error('No Preprod V2 payment source found in the payment service');
 const sw=(src.SellingWallets??[])[0];if(!sw)throw new Error('Payment source has no selling wallet');
 const state={sourceId:src.id,walletId:sw.id,sellerAddress:sw.walletAddress};
 writeJson(files.payment,state);log('pay',`Selling wallet ${sw.walletAddress}`);
 return state;
}
