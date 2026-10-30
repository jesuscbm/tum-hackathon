// Cardano network lokAl works on. Preprod is the default; mainnet is opt-in (LOKAL_NETWORK=mainnet in coworker/.env).
// Shared by core/, pay/ and coworker/ (the coworker gets the variable through --env-file).
export const NETWORKS={
 preprod:{id:'preprod',name:'Preprod',mps:'Preprod',test:true,sokosumiArgs:['--preprod'],sokosumiWeb:'https://preprod.sokosumi.com',
  blockfrost:'https://cardano-preprod.blockfrost.io/api/v0',bfKey:'BLOCKFROST_API_KEY_PREPROD',bfPrefix:'preprod',
  explorer:'https://preprod.cardanoscan.io',addressPrefix:'addr_test',faucet:'https://dispenser.masumi.network/',
  usdm:'16a55b2a349361ff88c03788f93e1e966e5d689605d044fef722ddde0014df10745553444d',coin:'tADA'},
 mainnet:{id:'mainnet',name:'Mainnet',mps:'Mainnet',test:false,sokosumiArgs:[],sokosumiWeb:'https://sokosumi.com',
  blockfrost:'https://cardano-mainnet.blockfrost.io/api/v0',bfKey:'BLOCKFROST_API_KEY_MAINNET',bfPrefix:'mainnet',
  explorer:'https://cardanoscan.io',addressPrefix:'addr1',faucet:null,
  usdm:'c48cbb3d5e57ed56e276bc45f99ab39abe94e6cd7ac39fb402da47ad0014df105553444d',coin:'ADA'},
};
export const networkOf=(env=process.env)=>NETWORKS[env.LOKAL_NETWORK==='mainnet'?'mainnet':'preprod'];
export const explorerTx=(net,h)=>`${net.explorer}/transaction/${h}`;
export const explorerAddress=(net,a)=>`${net.explorer}/address/${a}`;
export const explorerToken=(net,unit)=>`${net.explorer}/token/${unit}`;
// Blockfrost project ids carry their network as a prefix; a key for the wrong network silently breaks every call.
export const bfKeyOk=(net,k)=>!!k&&k.startsWith(net.bfPrefix);
