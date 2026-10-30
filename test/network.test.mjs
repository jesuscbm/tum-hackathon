import test from 'node:test';
import assert from 'node:assert/strict';
import {networkOf,bfKeyOk,NETWORKS,explorerTx} from '../core/network.mjs';
test('preprod is the default; mainnet only when asked for',()=>{
 assert.equal(networkOf({}).id,'preprod');
 assert.equal(networkOf({LOKAL_NETWORK:'Mainnet'}).id,'preprod');
 assert.equal(networkOf({LOKAL_NETWORK:'mainnet'}).mps,'Mainnet');
 assert.equal(NETWORKS.mainnet.faucet,null);
 assert.notEqual(NETWORKS.mainnet.usdm,NETWORKS.preprod.usdm);
 assert.equal(explorerTx(NETWORKS.mainnet,'ab'),'https://cardanoscan.io/transaction/ab');
});
test('Blockfrost keys must match the network',()=>{
 assert.ok(bfKeyOk(NETWORKS.preprod,'preprodABC'));
 assert.ok(!bfKeyOk(NETWORKS.preprod,'mainnetABC'));
 assert.ok(bfKeyOk(NETWORKS.mainnet,'mainnetABC'));
 assert.ok(!bfKeyOk(NETWORKS.mainnet,''));
});
