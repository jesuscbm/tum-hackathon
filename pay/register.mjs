import {run} from '../core/exec.mjs';
import {COWORKER_DIR} from '../core/paths.mjs';
import {filesFor,readJson,writeJson,exists} from './state.mjs';
import {health} from './mps.mjs';
// Wraps coworker/payment-registration.mjs (key → register → poll) and fills the fields the worker needs.
// dir: the Coworker's folder (main by default); every Coworker uses the shared payment service's admin key.
const node=(args,dir)=>run(process.execPath,['--env-file-if-exists=.env',`--env-file-if-exists=${filesFor(dir).mpsEnv}`,'payment-registration.mjs',...args],{cwd:dir,source:'registry',timeout:120000});
export function status(dir=COWORKER_DIR){
 const f=filesFor(dir);const r=readJson(f.registration);
 const state=r?.registrationState??r?.registration?.state??null;
 return {registered:!!r?.registrationId,state,confirmed:state==='RegistrationConfirmed',agentIdentifier:r?.agentIdentifier??null,
  txHash:r?.registration?.CurrentTransaction?.txHash??null,runtimeKey:exists(f.runtimeEnv),complete:!!(r?.agentIdentifier&&Number.isInteger(r?.supportedPaymentSourceIndex)&&r?.sellerVkey),
  network:r?.request?.network??null,apiBaseUrl:r?.request?.apiBaseUrl??null};
}
async function step(args,dir){const r=await node(args,dir);if(r.code!==0)throw new Error((r.stderr||r.stdout).trim().split('\n').at(-1)?.slice(0,300)||'registration step failed');return r.stdout;}
export async function ensureKey(dir=COWORKER_DIR){if(!exists(filesFor(dir).runtimeEnv))await step(['key'],dir);}
export async function register(dir=COWORKER_DIR){await ensureKey(dir);const s=readJson(filesFor(dir).registration);if(!s?.registrationId)await step(['register'],dir);return poll(dir);}
export async function poll(dir=COWORKER_DIR){
 // The script crashes with ECONNREFUSED while the payment service is down or still booting.
 if(!(await health()))return status(dir);
 await step([],dir);
 const f=filesFor(dir);const s=readJson(f.registration);
 if(s?.registrationState==='RegistrationConfirmed'||s?.registration?.state==='RegistrationConfirmed'){
  // Fields README step 5 asks to fill by hand.
  if(!Number.isInteger(s.supportedPaymentSourceIndex))s.supportedPaymentSourceIndex=0;
  if(!s.sellerVkey)s.sellerVkey=s.request?.sellingWalletVkey??s.registration?.SmartContractWallet?.walletVkey;
  writeJson(f.registration,s);
 }
 return status(dir);
}
