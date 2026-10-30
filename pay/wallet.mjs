import {readEnv} from '../core/config.mjs';
import {files,readJson} from './state.mjs';
export const USDM='16a55b2a349361ff88c03788f93e1e966e5d689605d044fef722ddde0014df10745553444d';
export const FAUCET='https://dispenser.masumi.network/';
export const explorer={tx:h=>`https://preprod.cardanoscan.io/transaction/${h}`,address:a=>`https://preprod.cardanoscan.io/address/${a}`};
// The official dispenser's own endpoint (no captcha on testnet). Sends test ADA to the selling wallet.
export async function requestTestAda(address){
 const r=await fetch('https://dispenser.masumi.network/submit_transaction',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({network:'testnet',receiverAddress:address,testnet_collateral:false}),signal:AbortSignal.timeout(60000)});
 const d=await r.json().catch(()=>({}));
 if(!d.success)throw new Error(`Dispenser: ${d.error??`HTTP ${r.status}`}`);
 return {txHash:d.transaction_id,url:explorer.tx(d.transaction_id)};
}
export async function balance(address){
 const key=readEnv().BLOCKFROST_API_KEY_PREPROD;if(!key||!address)return null;
 const r=await fetch(`https://cardano-preprod.blockfrost.io/api/v0/addresses/${address}`,{headers:{project_id:key},signal:AbortSignal.timeout(10000)});
 if(r.status===404)return {ada:0,usdm:0};// unused address
 if(!r.ok)throw new Error(`Blockfrost HTTP ${r.status}`);
 const amounts=(await r.json()).amount??[];
 const q=u=>Number(amounts.find(a=>a.unit===u)?.quantity??0);
 return {ada:q('lovelace')/1e6,usdm:q(USDM)/1e6};
}
export async function wallet(){
 const p=readJson(files.payment);const address=p?.sellerAddress??null;
 let bal=null,error=null;try{bal=await balance(address)}catch(e){error=e.message}
 return {address,balance:bal,error,faucet:FAUCET,explorer:address?explorer.address(address):null};
}
