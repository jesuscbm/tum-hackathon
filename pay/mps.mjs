import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {join,dirname,delimiter} from 'node:path';
import {randomBytes,createHash} from 'node:crypto';
import {HOME} from '../core/paths.mjs';
import {run,which} from '../core/exec.mjs';
import {log,progress} from '../core/events.mjs';
import {readEnv} from '../core/config.mjs';
import {node24Bin} from '../core/node24.mjs';
import {networkOf,NETWORKS} from '../core/network.mjs';
import {files,mpsUrl,mps,readJson,writeJson,readSecretEnv} from './state.mjs';
import * as db from './db.mjs';
// Masumi Payment Service: our own instance, own Postgres (Docker or native, see db.mjs), own wallets. Idempotent phases:
//   A (no secrets needed): Postgres, source, pnpm install, migrate
//   B (needs the Blockfrost preprod key): seed wallets + payment source
//     The service's seed always needs the preprod key; a mainnet key in addition seeds mainnet wallets too.
export const MPS_DIR=join(HOME,'masumi-payment-service');
const DB_PORT=db.DB_PORT;
const PNPM_VERSION='10.30.2'; // the service's packageManager field
// Pinned commit (tested 2026-10-30). Override with LOKAL_MPS_REF to try a newer one.
const MPS_REF=process.env.LOKAL_MPS_REF||'a846392ccfc8f5a85aee594ad9441dc90820dab0';
const GLOBAL=join(HOME,'npm-global');
// Everything for the service runs on Node 24.22.x (see core/node24.mjs) with our private pnpm first on PATH.
let nodeDir=null;
export async function toolEnv(){nodeDir??=await node24Bin();return {PATH:[nodeDir,join(GLOBAL,'bin'),process.env.PATH].join(delimiter),NPM_CONFIG_UPDATE_NOTIFIER:'false',CI:'true'};}
const sh=async(cmd,args,opts={})=>run(cmd,args,{source:'mps',env:await toolEnv(),...opts});
export async function health(){
 try{const r=await fetch(mpsUrl()+'/api/v1/health',{signal:AbortSignal.timeout(3000)});return r.ok}catch{return false}
}
const seededFlag=net=>net.id==='mainnet'?'LOKAL_SEEDED_MAINNET':'LOKAL_SEEDED';
export async function status(){
 const up=await health();const secrets=readSecretEnv(files.mpsEnv);const net=networkOf(readEnv());
 return {up,url:mpsUrl(),prepared:secrets.LOKAL_PREPARED==='1',installed:secrets[seededFlag(net)]==='1',adminKey:!!secrets.ADMIN_KEY,payment:readJson(files.payment),network:net.id};
}
async function must(r,what){if(r.code!==0)throw new Error(`${what} failed: ${(r.stderr||r.stdout).trim().split('\n').slice(-3).join(' | ').slice(0,300)}`);return r;}
async function ensurePnpm(){
 const v=await sh('pnpm',['--version'],{quiet:true,timeout:20000});
 if(v.code===0&&v.stdout.trim()===PNPM_VERSION)return;
 progress('mps',`Installing pnpm ${PNPM_VERSION} (private)`,0.3);
 await must(await sh('npm',['install','--global','--prefix',GLOBAL,`pnpm@${PNPM_VERSION}`,'--no-audit','--no-fund'],{timeout:300000}),'pnpm install');
}
function secrets(){
 const s=readSecretEnv(files.mpsEnv);
 const next={...s,ADMIN_KEY:s.ADMIN_KEY||randomBytes(24).toString('hex'),LOKAL_DB_PASSWORD:s.LOKAL_DB_PASSWORD||randomBytes(18).toString('hex'),LOKAL_ENCRYPTION_KEY:s.LOKAL_ENCRYPTION_KEY||randomBytes(24).toString('hex'),LOKAL_PREPARED:s.LOKAL_PREPARED||'0',LOKAL_SEEDED:s.LOKAL_SEEDED||'0'};
 return next;
}
function saveSecrets(s){mkdirSync(dirname(files.mpsEnv),{recursive:true,mode:0o700});writeFileSync(files.mpsEnv,Object.entries(s).map(([k,v])=>`${k}=${v}`).join('\n')+'\n',{mode:0o600});}
function writeServiceEnv(s){
 const env=readEnv();
 writeFileSync(join(MPS_DIR,'.env'),[`DATABASE_URL="postgresql://masumi:${s.LOKAL_DB_PASSWORD}@127.0.0.1:${DB_PORT}/masumi?schema=public"`,`ENCRYPTION_KEY="${s.LOKAL_ENCRYPTION_KEY}"`,`ADMIN_KEY="${s.ADMIN_KEY}"`,`PORT="${env.MPS_PORT||'38127'}"`,`BLOCKFROST_API_KEY_PREPROD="${env.BLOCKFROST_API_KEY_PREPROD||''}"`,`BLOCKFROST_API_KEY_MAINNET="${env.BLOCKFROST_API_KEY_MAINNET||''}"`,
  // The seed skips sources that already exist per address; "only if empty" would also skip mainnet after preprod.
  `SEED_ONLY_IF_EMPTY=${s.LOKAL_SEEDED==='1'?'False':'True'}`,
  // Default is 300 s: after a restart the old sync lock would block registration for 5 minutes.
  'SYNC_LOCK_TIMEOUT_INTERVAL="30"','OTEL_EXPORTER_OTLP_ENDPOINT=""',''].join('\n'),{mode:0o600});
}
// Installs from before db.mjs used Docker and recorded nothing.
const dbKind=s=>s.LOKAL_DB_BACKEND||(s.LOKAL_PREPARED==='1'?'docker':null);
const psql=(sql,opts)=>{const s=secrets();return db.psql(dbKind(s),s.LOKAL_DB_PASSWORD,sql,opts);};
// Before every service start: a native cluster does not come back on its own after a reboot (Docker's does).
export async function ensureDb(){const s=secrets();const k=dbKind(s);if(k)await db.ensureUp(k,s.LOKAL_DB_PASSWORD);}
export const dbInfo=()=>{const s=readSecretEnv(files.mpsEnv);return {kind:dbKind(s)};};
// Phase A. Safe to run before the user has a Blockfrost key.
export async function prepare(){
 if(!await which('git'))throw new Error('git is needed. Install git, then retry.');
 const s=secrets();
 const kind=await db.pick(dbKind(s));
 if(!kind)throw new Error(await which('docker')?`Docker is installed but not running (or your user cannot use it). Start it, or install ${db.installHint()}.`:`The payment database needs ${db.installHint()}. Install it, then retry.`);
 saveSecrets({...s,LOKAL_DB_BACKEND:kind});
 progress('mps',`Starting Postgres (${kind==='docker'?'Docker':'native'})`,0.05);
 await db.ensureUp(kind,s.LOKAL_DB_PASSWORD);
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
 const env=readEnv();const net=networkOf(env);
 if(!env.BLOCKFROST_API_KEY_PREPROD)throw new Error('A Blockfrost preprod key is needed to create the wallets (the payment service seeds preprod first, even for mainnet).');
 if(!net.test&&!env.BLOCKFROST_API_KEY_MAINNET)throw new Error('A Blockfrost mainnet key is needed to create the mainnet wallets.');
 const s=secrets();writeServiceEnv(s);
 progress('mps','Creating wallets and payment source',0.9);
 const r=await must(await sh('pnpm',['run','prisma:seed'],{cwd:MPS_DIR,timeout:300000,quiet:true}),'prisma seed');
 writeFileSync(join(HOME,'mps-seed.log'),r.stdout+r.stderr,{mode:0o600}); // seed may print wallet mnemonics: private file only
 saveSecrets({...secrets(),LOKAL_SEEDED:'1',...(env.BLOCKFROST_API_KEY_MAINNET?{LOKAL_SEEDED_MAINNET:'1'}:{})});
 progress('mps','Payment service ready',1);
 return status();
}
export async function setup(){const st=await status();if(!st.prepared)await prepare();if(readEnv().BLOCKFROST_API_KEY_PREPROD&&!(await status()).installed)await seed();return status();}
// Called right before lokal starts the (single) service: a lock left by a killed instance would block
// registration and payments until it times out, and nobody else can be holding it.
export async function clearStaleLocks(){
 const sql='UPDATE "PaymentSource" SET "syncInProgress"=false WHERE "syncInProgress"=true; UPDATE "HotWallet" SET "lockedAt"=NULL WHERE "lockedAt" IS NOT NULL AND "pendingTransactionId" IS NULL;';
 const r=await psql(sql);
 if(r.code!==0)log('mps','Could not clear stale locks: '+r.stderr.trim().slice(0,160),'error');
}
// Command the supervisor runs to keep the service up.
// Plain tsx, not the `dev` script's `tsx watch`: watch mode restarts the service (and drops its locks) on file changes.
export async function command(){if(existsSync(MPS_DIR))writeServiceEnv(secrets());return {cmd:'pnpm',args:['exec','tsx','./src/index.ts'],cwd:MPS_DIR,env:await toolEnv()};}
// A new payment source would replay the shared escrow contract's whole history (every team's txs, ~30 min on a
// free Blockfrost key) before it registers anything. Our wallets are new, so none of it concerns us: start the
// sync checkpoint at the contract's newest tx instead. Runs only while the service is stopped.
export async function skipContractHistory(){
 const q=await psql(`SELECT id,"smartContractAddress",network FROM "PaymentSource" WHERE "lastIdentifierChecked" IS NULL AND "deletedAt" IS NULL`,{sep:'|'});
 const env=readEnv();
 for(const line of q.stdout.trim().split('\n').filter(Boolean)){
  const [id,address,network]=line.split('|');
  const net=network==='Mainnet'?NETWORKS.mainnet:NETWORKS.preprod;const key=env[net.bfKey];
  if(!key||!address)continue;
  const r=await fetch(`${net.blockfrost}/addresses/${address}/transactions?order=desc&count=1`,{headers:{project_id:key},signal:AbortSignal.timeout(15000)});
  if(!r.ok){log('mps',`Could not read the contract's latest tx (Blockfrost HTTP ${r.status}); the first sync will take a while`,'error');continue;}
  const hash=(await r.json())[0]?.tx_hash;if(!hash||!/^[0-9a-f]{64}$/.test(hash))continue;
  await psql(`UPDATE "PaymentSource" SET "lastIdentifierChecked"='${hash}' WHERE id='${id.replace(/'/g,'')}' AND "lastIdentifierChecked" IS NULL`);
  log('mps',`Skipping the escrow contract's history: sync starts at ${hash.slice(0,12)}…`);
 }
}
// The seed copies the Blockfrost key into the payment source; push a changed key there too.
export async function syncBlockfrostKey(){
 const net=networkOf(readEnv());const key=readEnv()[net.bfKey];if(!key)return false;
 const flag=net.test?'LOKAL_BF_SYNCED':'LOKAL_BF_SYNCED_MAINNET';
 const h=createHash('sha256').update(key).digest('hex').slice(0,16);
 const s=secrets();if(s[flag]===h)return false;
 const src=((await mps('/payment-source-extended?take=100')).ExtendedPaymentSources??[]).find(x=>x.network===net.mps&&x.paymentSourceType==='Web3CardanoV2');
 if(!src)return false;
 await mps('/payment-source-extended',{method:'PATCH',body:{id:src.id,PaymentSourceConfig:{rpcProviderApiKey:key,rpcProvider:'Blockfrost'}}});
 saveSecrets({...secrets(),[flag]:h});log('pay','Blockfrost key updated in the payment service');
 return true;
}
// After the service is up: record our V2 source + selling wallet (current network) for the coworker.
export async function recordPaymentState(){
 const net=networkOf(readEnv());
 const existing=readJson(files.payment);if(existing?.sourceId&&existing?.walletId&&existing?.sellerAddress&&(existing.network??'preprod')===net.id)return existing;
 // Shapes checked against MPS a846392: sources list their wallet counts only; wallets come from /wallet/list.
 const data=await mps('/payment-source-extended?take=100');
 const src=(data.ExtendedPaymentSources??[]).find(s=>s.network===net.mps&&s.paymentSourceType==='Web3CardanoV2');
 if(!src)throw new Error(`No ${net.name} V2 payment source found in the payment service`);
 const wallets=(await mps(`/wallet/list?walletType=Selling&paymentSourceId=${encodeURIComponent(src.id)}&take=10`)).Wallets??[];
 const sw=wallets[0];if(!sw)throw new Error('Payment source has no selling wallet');
 const state={sourceId:src.id,walletId:sw.id,sellerAddress:sw.walletAddress,network:net.id};
 writeJson(files.payment,state);log('pay',`Selling wallet ${sw.walletAddress}`);
 return state;
}
