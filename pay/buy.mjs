import {randomBytes} from 'node:crypto';
import {readEnv} from '../core/config.mjs';
import {networkOf,explorerAddress,explorerTx} from '../core/network.mjs';
import {priceFor} from '../templates/index.mjs';
import {resultHash} from '../coworker/standard-hash.mjs';
import {mps} from './state.mjs';
import {balance} from './wallet.mjs';
import * as reg from './register.mjs';
// Be your own buyer: hire the main Coworker through its MIP-003 agent API and pay from the payment service's
// own purchasing wallet (seeded next to the selling wallet). Runs the whole Masumi flow on one machine:
// escrow lock → gated answer → submit-result, the same path an outside buyer takes on mainnet.
const net=()=>networkOf(readEnv());
const api=()=>`http://127.0.0.1:${readEnv().AGENT_API_PORT||21950}`;
async function source(){
 const n=net();
 const src=((await mps('/payment-source-extended?take=100')).ExtendedPaymentSources??[]).find(s=>s.network===n.mps&&s.paymentSourceType==='Web3CardanoV2');
 if(!src)throw new Error(`No ${n.name} payment source: finish setup step 4 (lokal run pay)`);
 return src;
}
export const price=()=>priceFor(readEnv());
export async function buyer(){
 const n=net();const src=await source();
 const w=((await mps(`/wallet/list?walletType=Purchasing&paymentSourceId=${encodeURIComponent(src.id)}&take=10`)).Wallets??[])[0];
 if(!w)throw new Error('The payment service has no purchasing wallet');
 return {address:w.walletAddress,balance:await balance(w.walletAddress).catch(()=>null),explorer:explorerAddress(n,w.walletAddress),network:n.id,coin:n.coin,faucet:n.faucet};
}
// What the purchasing wallet needs: the price plus ~5 ADA for fees, collateral and the escrow output's min-ADA.
export function shortfall(b,p=price()){
 if(!b.balance)return 'balance unknown (Blockfrost)';
 const amount=Number(p.amount)/1e6,needAda=5+(p.unit==='ADA'?amount:0);
 const miss=[];
 if(b.balance.ada<needAda)miss.push(`${needAda} ${b.coin} (has ${b.balance.ada})`);
 if(p.unit==='USDM'&&b.balance.usdm<amount)miss.push(`${amount} USDM (has ${b.balance.usdm})`);
 return miss.length?`needs ${miss.join(' and ')}`:null;
}
export async function start(prompt){
 const r=reg.status();if(!r.confirmed)throw new Error('The agent is not registered yet: finish setup step 4 (lokal run pay)');
 const n=net();const nonce=randomBytes(12).toString('hex');
 const res=await fetch(api()+'/start_job',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({identifier_from_purchaser:nonce,input_data:{prompt}}),signal:AbortSignal.timeout(60000)}).catch(()=>null);
 if(!res)throw new Error(`The agent API is not answering on ${api()}: lokal up starts it (it runs once paid jobs are enabled)`);
 const job=await res.json().catch(()=>({}));
 if(!res.ok)throw new Error(`Agent API: ${job.error??`HTTP ${res.status}`}`);
 const purchase=await mps('/purchase',{body:{network:n.mps,paymentSourceType:'Web3CardanoV2',blockchainIdentifier:job.blockchainIdentifier,
  sellerVkey:job.sellerVKey,agentIdentifier:job.agentIdentifier,inputHash:job.input_hash,identifierFromPurchaser:nonce,
  supportedPaymentSourceIndex:job.supportedPaymentSourceIndex,payByTime:String(job.payByTime),submitResultTime:String(job.submitResultTime),
  unlockTime:String(job.unlockTime),externalDisputeUnlockTime:String(job.externalDisputeUnlockTime),metadata:'lokal buy'}});
 return {jobId:job.id,nonce,blockchainIdentifier:job.blockchainIdentifier,submitResultTime:job.submitResultTime,purchaseId:purchase?.id};
}
// One poll: the agent's view (job status, result) and the buyer's on-chain view of the same escrow.
export async function poll(b){
 const n=net();
 const j=await fetch(`${api()}/status?job_id=${b.jobId}`,{signal:AbortSignal.timeout(10000)}).then(r=>r.json()).catch(()=>null);
 const p=await mps('/purchase/resolve-blockchain-identifier',{body:{network:n.mps,blockchainIdentifier:b.blockchainIdentifier,includeHistory:'true'}}).catch(()=>null);
 const txs=[...(p?.TransactionHistory??[]),p?.CurrentTransaction].filter(t=>t?.txHash).map(t=>({hash:t.txHash,status:t.status,url:explorerTx(n,t.txHash)}));
 const result=j?.result??null;
 const verified=result!=null&&p?.resultHash?resultHash(result,b.nonce)===p.resultHash:null;
 return {job:j?.status??'unknown',onChain:p?.onChainState??null,action:p?.NextAction?.requestedAction??null,error:p?.NextAction?.errorNote??null,result,resultHash:p?.resultHash??null,verified,txs:[...new Map(txs.map(t=>[t.hash,t])).values()]};
}
