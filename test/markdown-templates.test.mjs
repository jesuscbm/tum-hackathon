import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
process.env.LOKAL_HOME=mkdtempSync(join(tmpdir(),'lokal-md-'));
const {parseFrontMatter,templateFromMarkdown,importMarkdown,listTemplates,loadTemplate}=await import('../templates/index.mjs');
test('front matter values are JSON when they parse, text otherwise',()=>{
 const {meta,body}=parseFrontMatter('---\nname: Contract summary\ncheck: regex   # comment\npattern: "^OK"\nmax: 300\nschema: {"type":"object"}\n---\nYou summarise.\n');
 assert.deepEqual(meta,{name:'Contract summary',check:'regex',pattern:'^OK',max:300,schema:{type:'object'}});
 assert.equal(body,'You summarise.\n');
 assert.deepEqual(parseFrontMatter('no front matter'),{meta:{},body:'no front matter'});
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
