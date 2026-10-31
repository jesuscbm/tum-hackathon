import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
process.env.LOKAL_HOME=mkdtempSync(join(tmpdir(),'lokal-md-'));
const {parseFrontMatter,templateFromMarkdown,importMarkdown,listTemplates,loadTemplate,parsePrice,priceFor,fundsFor}=await import('../templates/index.mjs');
test('front matter values are JSON when they parse, text otherwise',()=>{
 const {meta,body}=parseFrontMatter('---\nname: Contract summary\ncheck: regex   # comment\npattern: "^OK"\nmax: 300\nschema: {"type":"object"}\n---\nYou summarise.\n');
 assert.deepEqual(meta,{name:'Contract summary',check:'regex',pattern:'^OK',max:300,schema:{type:'object'}});
 assert.equal(body,'You summarise.\n');
 assert.deepEqual(parseFrontMatter('no front matter'),{meta:{},body:'no front matter'});
});
test('prices are USDM by default or ADA, with six decimals',()=>{
 assert.deepEqual(parsePrice('2 ADA'),{amount:'2000000',unit:'ADA',display:'2 ADA'});
 assert.deepEqual(parsePrice('1.5 usdm'),{amount:'1500000',unit:'USDM',display:'1.5 USDM'});
 assert.equal(parsePrice(3).unit,'USDM');
 for(const bad of ['0','-1','2 BTC','ADA',''])assert.throws(()=>parsePrice(bad),/price must be/);
});
test('a Coworker charges its own price, else its job\'s, as Masumi funds',async()=>{
 const {NETWORKS}=await import('../core/network.mjs');
 assert.deepEqual(priceFor({LOKAL_TEMPLATE:'invoice-json'}),{amount:'1000000',unit:'USDM',display:'1 USDM'});
 const own=priceFor({LOKAL_TEMPLATE:'invoice-json',AGENT_PRICE:'2 ADA'});
 assert.equal(own.own,true);
 assert.deepEqual(fundsFor(own,NETWORKS.mainnet),[{unit:'',amount:'2000000'}]);
 assert.deepEqual(fundsFor(priceFor({}),NETWORKS.preprod),[{unit:NETWORKS.preprod.usdm,amount:'1000000'}]);
});
test('a Markdown prompt becomes a template with a check and a price',()=>{
 const t=templateFromMarkdown('---\nname: Short\ncheck: length\nmax: 30\nprice: 2.5\n---\nBe brief.','short');
 assert.equal(t.id,'short');assert.deepEqual(t.check,{type:'length',max:30});
 assert.deepEqual(t.price,{amount:'2500000',unit:'USDM',display:'2.5 USDM'});
 assert.equal(t.prompt,'Be brief.\n');
 assert.equal(templateFromMarkdown('Just a prompt.','plain').check.type,'none');
 assert.throws(()=>templateFromMarkdown('---\ncheck: bogus\n---\nx','x'),/Unknown check type/);
 assert.throws(()=>templateFromMarkdown('---\ncheck: regex\n---\nx','x'),/pattern/);
 assert.throws(()=>templateFromMarkdown('---\nname: x\n---\n   ','x'),/empty/);
});
test('imported .md files are listed and loaded like folder templates',()=>{
 const f=join(process.env.LOKAL_HOME,'My Haiku.md');
 writeFileSync(f,'---\nname: Haiku\ncheck: length\nmax: 200\n---\nWrite a haiku.\n');
 const t=importMarkdown(f);
 assert.equal(t.id,'my-haiku');
 assert.ok(listTemplates().some(x=>x.id==='my-haiku'&&x.custom));
 assert.equal(loadTemplate('my-haiku').check.max,200);
 writeFileSync(f,'---\nid: invoice-json\n---\nx');
 assert.throws(()=>importMarkdown(f),/built-in/);
});
