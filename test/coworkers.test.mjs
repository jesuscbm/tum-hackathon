import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,lstatSync,existsSync,cpSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
// A scratch home and a scratch main Coworker, so nothing touches the real coworker/ folder.
const T=mkdtempSync(join(tmpdir(),'lokal-cw-'));
const main=join(T,'main');mkdirSync(join(main,'agent'),{recursive:true});
const repo=dirname(dirname(fileURLToPath(import.meta.url)));
for(const f of ['package.json','worker.mjs','start.mjs','.env.example'])cpSync(join(repo,'coworker',f),join(main,f));
cpSync(join(repo,'coworker','agent','agent.ts'),join(main,'agent','agent.ts'));
writeFileSync(join(main,'.env'),'ZAI_MODEL=llama3.2:3b\nZAI_BASE_URL=http://127.0.0.1:11434/v1\nEVE_PORT=21949\nAGENT_API_PORT=21950\nCOWORKER_ID=main-id\nLOKAL_NETWORK=preprod\n');
process.env.LOKAL_HOME=join(T,'home');process.env.LOKAL_COWORKER_DIR=main;
const cw=await import('../core/coworkers.mjs');
test('an extra Coworker gets its own folder, ports and prompt, and shares main settings',async()=>{
 const c=await cw.add({name:'Contract Summary',template:'freeform',register:false});
 assert.equal(c.id,'contract-summary');
 assert.deepEqual(c.ports,{eve:21951,api:21952});
 assert.ok(lstatSync(join(c.dir,'worker.mjs')).isSymbolicLink());
 assert.ok(lstatSync(join(c.dir,'package.json')).isFile());
 assert.ok(readFileSync(join(c.dir,'agent','instructions.md'),'utf8').length>0);
 assert.equal(c.env.LOKAL_TEMPLATE,'freeform');
 assert.equal(c.coworkerId,null);
 const shared=cw.sharedEnv(c);
 assert.equal(shared.ZAI_MODEL,'llama3.2:3b');assert.equal(shared.COWORKER_ID,undefined);
 assert.deepEqual(cw.sharedEnv(cw.get('main')),{});
 const d=await cw.add({name:'Second',template:'invoice-json',register:false});
 assert.deepEqual(d.ports,{eve:21953,api:21954});
 await assert.rejects(cw.add({name:'Second',template:'freeform',register:false}),/already exists/);
 await assert.rejects(cw.add({name:'main',template:'freeform',register:false}),/not "main"/);
 assert.deepEqual(cw.list().map(x=>x.id),['main','contract-summary','second']);
});
test('a per-Coworker model in its own .env wins over main',()=>{
 const c=cw.get('second');writeFileSync(join(c.dir,'.env'),readFileSync(join(c.dir,'.env'),'utf8')+'ZAI_MODEL=qwen2.5:32b\n');
 assert.equal(cw.sharedEnv(cw.get('second')).ZAI_MODEL,undefined);
});
test('templates can change and Coworkers can be removed, but not main',async()=>{
 assert.equal(cw.setTemplate('second','freeform').template,'freeform');
 await assert.rejects(cw.remove('main'),/main Coworker/);
 await cw.remove('second');
 assert.ok(!existsSync(join(process.env.LOKAL_HOME,'coworkers','second')));
 assert.deepEqual(cw.list().map(x=>x.id),['main','contract-summary']);
});
