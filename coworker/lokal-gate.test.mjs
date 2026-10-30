import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gate,gateWith} from './lokal-gate.mjs';
import {loadTemplate} from '../templates/index.mjs';
import {verifyResult} from '../provenance.mjs';
const cfg={template:loadTemplate('invoice-json'),promptHash:'sha256:00',model:'llama3.2:3b',baseURL:'http://127.0.0.1:1/v1'};
const good=JSON.stringify({vendor:'A',invoice_number:null,date:null,currency:'EUR',line_items:[{description:'x',quantity:2,unit_price:1.5,amount:3}],subtotal:3,tax:null,total:3});
test('passing output becomes a verifiable canonical result',async()=>{
 const r=await gateWith(async()=>good,cfg)('invoice','/dev/null');
 assert.equal(r.pass,true);assert.equal(r.tries,1);
 assert.equal(verifyResult(r.text,r.hash).ok,true);
 assert.equal(JSON.parse(r.text).model,'llama3.2:3b');
});
test('retries once with the check reasons, then reports failure',async()=>{
 const prompts=[];const r=await gateWith(async p=>{prompts.push(p);return 'not json'},cfg)('invoice','/dev/null');
 assert.equal(r.pass,false);assert.equal(r.tries,2);assert.match(prompts[1],/failed the automatic check/);
});
test('second try can recover',async()=>{
 let n=0;const r=await gateWith(async()=>++n===1?'nope':good,cfg)('invoice','/dev/null');
 assert.equal(r.pass,true);assert.equal(r.tries,2);
});
test('without LOKAL_TEMPLATE the answer passes through unchanged',async()=>{
 const r=await gate(async()=>'plain text',{})('anything','/dev/null');
 assert.equal(r.text,'plain text');assert.equal(r.pass,true);
});
