import {run} from '../core/exec.mjs';
import {COWORKER_DIR} from '../core/paths.mjs';
import {files,readJson,writeJson,exists} from './state.mjs';
// Wraps coworker/payment-registration.mjs (key → register → poll) and fills the fields the worker needs.
const node=args=>run(process.execPath,['--env-file-if-exists=.env','--env-file-if-exists=.local/mps.env','payment-registration.mjs',...args],{cwd:COWORKER_DIR,source:'registry',timeout:120000});
export function status(){
 const r=readJson(files.registration);
 const state=r?.registrationState??r?.registration?.state??null;
 return {registered:!!r?.registrationId,state,confirmed:state==='RegistrationConfirmed',agentIdentifier:r?.agentIdentifier??null,
  txHash:r?.registration?.CurrentTransaction?.txHash??null,runtimeKey:exists(files.runtimeEnv),complete:!!(r?.agentIdentifier&&Number.isInteger(r?.supportedPaymentSourceIndex)&&r?.sellerVkey)};
}
async function step(args){const r=await node(args);if(r.code!==0)throw new Error((r.stderr||r.stdout).trim().split('\n').at(-1)?.slice(0,300)||'registration step failed');return r.stdout;}
export async function ensureKey(){if(!exists(files.runtimeEnv))await step(['key']);}
export async function register(){await ensureKey();const s=readJson(files.registration);if(!s?.registrationId)await step(['register']);return poll();}
export async function poll(){
 await step([]);
 const s=readJson(files.registration);
 if(s?.registrationState==='RegistrationConfirmed'||s?.registration?.state==='RegistrationConfirmed'){
  // Fields README step 5 asks to fill by hand.
  if(!Number.isInteger(s.supportedPaymentSourceIndex))s.supportedPaymentSourceIndex=0;
  if(!s.sellerVkey)s.sellerVkey=s.request?.sellingWalletVkey??s.registration?.SmartContractWallet?.walletVkey;
  writeJson(files.registration,s);
 }
 return status();
}
