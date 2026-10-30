import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {listTemplates,loadTemplate,saveCustomTemplate} from '../templates/index.mjs';
import {check} from '../checks/index.mjs';
process.env.LOKAL_HOME=mkdtempSync(join(tmpdir(),'lokal-test-'));
test('built-in templates load with samples',()=>{
 const t=loadTemplate('invoice-json');
 assert.equal(t.check.type,'invoice');
 assert.ok(t.prompt.includes('JSON'));
 assert.equal(t.samples.length,5);
 assert.deepEqual(t.samples.map(s=>s.expect).sort(),['fail','fail','pass','pass','pass']);
 assert.ok(listTemplates().some(x=>x.id==='freeform'));
 assert.throws(()=>loadTemplate('../etc'));
});
test('custom templates are saved and listed',()=>{
 const saved=saveCustomTemplate({id:'haiku',name:'Haiku',prompt:'Write a haiku.',check:{type:'length',max:200}});
 assert.equal(saved.check.type,'length');
 assert.ok(listTemplates().some(x=>x.id==='haiku'&&x.custom));
 assert.equal(loadTemplate('haiku').prompt,'Write a haiku.\n');
 assert.throws(()=>saveCustomTemplate({id:'invoice-json',prompt:'x'}));
 assert.throws(()=>saveCustomTemplate({id:'Bad Id',prompt:'x'}));
});
test('a correct extraction of the bad-total sample fails the check',()=>{
 const output=JSON.stringify({vendor:'Green Leaf Catering',invoice_number:'GLC-7702',date:'2026-10-20',currency:'EUR',
  line_items:[{description:'Vegetarian lunch box',quantity:20,unit_price:8.5,amount:170},{description:'Fresh juice 1L',quantity:10,unit_price:3,amount:30},{description:'Delivery',quantity:1,unit_price:15,amount:15}],
  subtotal:215,tax:15.05,total:250.05});
 const r=check({type:'invoice'},'',output);
 assert.equal(r.pass,false);
 assert.ok(r.reasons[0].startsWith('$.total'));
});
