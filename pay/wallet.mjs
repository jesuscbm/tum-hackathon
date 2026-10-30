import {readEnv} from '../core/config.mjs';
import {networkOf,explorerTx,explorerAddress} from '../core/network.mjs';
import {files,readJson,mps} from './state.mjs';
export const USDM=networkOf({}).usdm; // preprod unit, kept for older imports
export const FAUCET='https://dispenser.masumi.network/';
const net=()=>networkOf(readEnv());
export const explorer={tx:h=>explorerTx(net(),h),address:a=>explorerAddress(net(),a)};
// The official dispenser's own endpoint (no captcha on testnet). Sends test ADA to the selling wallet. Preprod only.
export async function requestTestAda(address){
 if(!net().test)throw new Error('There is no dispenser on mainnet: send real ADA to the selling wallet');
 const r=await fetch('https://dispenser.masumi.network/submit_transaction',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({network:'testnet',receiverAddress:address,testnet_collateral:false}),signal:AbortSignal.timeout(60000)});
 const d=await r.json().catch(()=>({}));
 if(!d.success)throw new Error(`Dispenser: ${d.error??`HTTP ${r.status}`}`);
 return {txHash:d.transaction_id,url:explorer.tx(d.transaction_id)};
}
export async function balance(address){
 const env=readEnv();const n=networkOf(env);const key=env[n.bfKey];if(!key||!address)return null;
 const r=await fetch(`${n.blockfrost}/addresses/${address}`,{headers:{project_id:key},signal:AbortSignal.timeout(10000)});
 if(r.status===404)return {ada:0,usdm:0};// unused address
 if(!r.ok)throw new Error(`Blockfrost HTTP ${r.status}`);
 const amounts=(await r.json()).amount??[];
 const q=u=>Number(amounts.find(a=>a.unit===u)?.quantity??0);
 return {ada:q('lovelace')/1e6,usdm:q(n.usdm)/1e6};
}
export async function wallet(){
 const p=readJson(files.payment);const address=p?.sellerAddress??null;const n=net();
 let bal=null,error=null;try{bal=await balance(address)}catch(e){error=e.message}
 return {address,balance:bal,error,faucet:n.faucet,explorer:address?explorer.address(address):null,network:n.id,coin:n.coin};
}
// The selling wallet's 24-word recovery phrase, from the payment service (admin key). Only for the user's own
// terminal: callers must never log it. Lets you move earnings with any Cardano wallet (Eternl, Lace, …).
export async function exportMnemonic(){
 const p=readJson(files.payment);if(!p?.walletId)throw new Error('No selling wallet yet (setup step 4)');
 const w=await mps(`/wallet?walletType=Selling&id=${encodeURIComponent(p.walletId)}&includeSecret=true`);
 if(!w?.Secret?.mnemonic)throw new Error('The payment service did not return the recovery phrase');
 return {address:w.walletAddress,mnemonic:w.Secret.mnemonic};
}
