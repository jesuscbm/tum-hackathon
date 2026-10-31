import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalize,canonicalResult,resultHash,verifyResult,promptHash,sha256} from '../provenance.mjs';
const input={template:'invoice-json',output:'{"total":1}',model:'llama3.2:3b',digest:'sha256:abc',promptHash:'sha256:def',check:{type:'json',pass:true,reasons:[]}};
test('canonicalize is key-order independent',()=>{
 assert.equal(canonicalize({b:1,a:{d:[1,{z:1,y:2}],c:null}}),canonicalize({a:{c:null,d:[1,{y:2,z:1}]},b:1}));
 assert.equal(canonicalize({b:1,a:'x'}),'{"a":"x","b":1}');
});
test('result hash is stable',()=>{
 const c=canonicalResult(input);
 assert.equal(c,'{"check":{"pass":true,"reasons":[],"type":"json"},"digest":"sha256:abc","model":"llama3.2:3b","output":"{\\"total\\":1}","promptHash":"sha256:def","template":"invoice-json","v":1}');
 assert.equal(resultHash(c),'44c721ecbbac234c2c2cd89dee4c4bef937d95cb708cdfcd6a34294b936b788a');
 assert.equal(promptHash('hi'),'sha256:'+sha256('hi'));
 assert.equal(JSON.parse(canonicalResult({...input,digest:undefined})).digest,null);
});
test('verifyResult detects tampering',()=>{
 const c=canonicalResult(input),h=resultHash(c);
 assert.equal(verifyResult(c,h).ok,true);
 assert.equal(verifyResult(c,'sha256:'+h.toUpperCase()).ok,true);
 assert.equal(verifyResult(c.replace('llama3.2:3b','llama3.1:8b'),h).ok,false);
 assert.equal(verifyResult(JSON.stringify(JSON.parse(c),null,2),h).ok,false);
 assert.equal(verifyResult('not json',h).ok,false);
});
test('agent-API results hash with the buyer nonce',()=>{
 const c=canonicalResult(input);const h=resultHash(c,'abcdef0123456789');
 assert.equal(h,sha256(`abcdef0123456789;${c}`));
 assert.equal(verifyResult(c,h).ok,false);
 assert.equal(verifyResult(c,h,{nonce:'abcdef0123456789'}).ok,true);
});
test('a buyer can re-run the check and catch a false pass',async()=>{
 const {recheck}=await import('../provenance.mjs');
 const {loadTemplate}=await import('../templates/index.mjs');
 const t=loadTemplate('invoice-json');
 const good=JSON.stringify({vendor:'A',invoice_number:null,date:null,currency:'EUR',line_items:[{description:'x',quantity:2,unit_price:1.5,amount:3}],subtotal:3,tax:null,total:3});
 const base={template:'invoice-json',model:'m',digest:null,promptHash:promptHash(t.prompt)};
 const honest=recheck(JSON.parse(canonicalResult({...base,output:good,check:{type:'invoice',pass:true,reasons:[]}})));
 assert.equal(honest.ok,true);assert.equal(honest.prompt,true);
 const lie=recheck(JSON.parse(canonicalResult({...base,output:good.replace('"total":3','"total":9'),promptHash:'sha256:other',check:{type:'invoice',pass:true,reasons:[]}})));
 assert.equal(lie.ok,false);assert.match(lie.reason,/claimed pass, the check says fail/);assert.equal(lie.prompt,false);
 assert.equal(recheck({template:'no-such-job'}).ok,null);
});
