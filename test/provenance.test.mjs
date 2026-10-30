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
