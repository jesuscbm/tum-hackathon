import test from 'node:test';
import assert from 'node:assert/strict';
import {check,extractJson,validate,checkInvoice,CHECK_TYPES} from '../checks/index.mjs';
const invoice={vendor:'Bakery Rose',invoice_number:'881',date:'2026-03-12',currency:'EUR',
 line_items:[{description:'Croissant',quantity:2,unit_price:1.8,amount:3.6},{description:'Coffee',quantity:1,unit_price:2.4,amount:2.4}],
 subtotal:6,tax:0.42,total:6.42};
test('extractJson handles plain, fenced and embedded JSON',()=>{
 assert.deepEqual(extractJson('{"a":1}').value,{a:1});
 assert.deepEqual(extractJson('```json\n{"a":2}\n```').value,{a:2});
 assert.deepEqual(extractJson('Sure! Here it is: {"a":{"b":"}"}} hope that helps').value,{a:{b:'}'}});
 assert.equal(extractJson('no json here').ok,false);
 assert.equal(extractJson('').ok,false);
});
test('schema validator reports paths',()=>{
 const schema={type:'object',required:['n','s'],additionalProperties:false,properties:{n:{type:'integer',minimum:1},s:{type:'string',pattern:'^a'},l:{type:'array',items:{enum:['x','y']}}}};
 assert.deepEqual(validate(schema,{n:2,s:'abc',l:['x']}),[]);
 const errors=validate(schema,{n:0.5,s:'b',l:['z'],extra:1});
 assert.ok(errors.some(e=>e.startsWith('$.n: expected integer')));
 assert.ok(errors.some(e=>e.startsWith('$.s: does not match')));
 assert.ok(errors.some(e=>e.startsWith('$.l[0]: must be one of')));
 assert.ok(errors.some(e=>e.includes('unexpected field "extra"')));
 assert.ok(validate(schema,{}).some(e=>e.includes('missing required field "n"')));
});
test('invoice arithmetic passes and fails',()=>{
 assert.deepEqual(checkInvoice(invoice),[]);
 assert.ok(checkInvoice({...invoice,total:7}).some(r=>r.startsWith('$.total')));
 assert.ok(checkInvoice({...invoice,subtotal:5}).some(r=>r.startsWith('$.subtotal')));
 assert.ok(checkInvoice({...invoice,line_items:[{...invoice.line_items[0],amount:4},invoice.line_items[1]]}).some(r=>r.startsWith('$.line_items[0]')));
 assert.ok(checkInvoice({...invoice,line_items:[]}).length>0);
 assert.ok(checkInvoice({...invoice,currency:'euro'}).some(r=>r.startsWith('$.currency')));
 assert.ok(checkInvoice({error:'not an invoice'}).length>0);
});
test('check() covers every type and never throws on bad output',()=>{
 assert.equal(check({type:'none'},'','').pass,true);
 assert.equal(check({type:'json'},'','{"x":1}').pass,true);
 assert.equal(check({type:'json'},'','nope').pass,false);
 assert.equal(check({type:'schema',schema:{type:'object',required:['x']}},'','{"y":1}').pass,false);
 assert.equal(check({type:'regex',pattern:'^hello',flags:'i'},'','Hello world').pass,true);
 assert.equal(check({type:'regex',pattern:'^hello'},'','bye').pass,false);
 assert.equal(check({type:'length',min:3,max:5},'','abcd').pass,true);
 assert.equal(check({type:'length',max:2},'','abcd').pass,false);
 const ok=check({type:'invoice'},'',`\`\`\`json\n${JSON.stringify(invoice)}\n\`\`\``);
 assert.equal(ok.pass,true);assert.deepEqual(ok.value,invoice);
 assert.equal(check({type:'invoice'},'',undefined).pass,false);
 assert.equal(CHECK_TYPES.length,6);
});
test('check() throws only on bad config',()=>{
 assert.throws(()=>check({type:'magic'},'',''));
 assert.throws(()=>check({type:'schema'},'',''));
 assert.throws(()=>check({type:'regex',pattern:'('},'',''));
 assert.throws(()=>check({type:'length'},'',''));
});
