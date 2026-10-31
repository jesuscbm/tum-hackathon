import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,chmodSync,cpSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
// Reusing a spare Sokosumi Coworker keeps its Workspace approval: no new registration, no new approval request.
// A fake Sokosumi CLI: two owned Coworkers besides main (one retired); connect grants cw_old, leaves new ones PENDING.
const T=mkdtempSync(join(tmpdir(),'lokal-reuse-'));const bin=join(T,'bin');mkdirSync(bin);const calls=join(T,'calls');
writeFileSync(join(bin,'sokosumi'),`#!/bin/sh
echo "$@" >> "${calls}"
case "$*" in
 *"coworkers list"*) echo '{"coworkers":[{"id":"main-id","name":"Main"},{"id":"cw_old","name":"Old · lokAl"},{"id":"cw_dead","name":"Gone (retired)"}]}';;
 *"coworkers connect cw_old"*|*"coworkers connect main-id"*) echo '{"coworkerId":"x","workspaceAccess":{"status":"GRANTED"}}';;
 *"coworkers connect"*) echo '{"coworkerId":"x","workspaceAccess":{"status":"PENDING"}}';;
 *"coworkers register"*) echo '{"coworker":{"id":"cw_new"}}';;
 *"coworkers api-key"*) echo '{"apiKey":{"token":"t"}}';;
 *"--version"*) echo '1.1.0';;
 *"auth whoami"*) echo '{"user":{"email":"you@example.com"}}';;
 *"vendors me"*) echo '{"vendor":{"id":"v1","name":"V","slug":"v"}}';;
 *"workspaces list"*) echo '{"workspaces":[{"organizationId":"org1","slug":"tum","name":"TUM"}]}';;
 *) echo '{}';;
esac
`);chmodSync(join(bin,'sokosumi'),0o755);
process.env.PATH=`${bin}:${process.env.PATH}`;
const main=join(T,'main');mkdirSync(join(main,'agent'),{recursive:true});
const repo=dirname(dirname(fileURLToPath(import.meta.url)));
for(const f of ['package.json','worker.mjs','start.mjs'])cpSync(join(repo,'coworker',f),join(main,f));
cpSync(join(repo,'coworker','agent','agent.ts'),join(main,'agent','agent.ts'));
writeFileSync(join(main,'.env'),'COWORKER_ID=main-id\nSOKOSUMI_ORGANIZATION_ID=org1\nSOKOSUMI_ORGANIZATION_SLUG=tum\n');
process.env.LOKAL_HOME=join(T,'home');process.env.LOKAL_COWORKER_DIR=main;
const {saveConfig}=await import('../core/config.mjs');saveConfig({vendorId:'v1'});
const cw=await import('../core/coworkers.mjs');const sk=await import('../core/sokosumi.mjs');
test('spare lists owned, unused, unretired Coworkers',async()=>{
 assert.deepEqual((await cw.spare()).map(c=>c.id),['cw_old']);
});
test('a reused Coworker is renamed, gets a key, and keeps its approval',async()=>{
 writeFileSync(calls,'');
 const c=await cw.add({name:'Summary',template:'freeform',reuse:'cw_old'});
 assert.equal(c.coworkerId,'cw_old');assert.equal(c.access,'GRANTED');
 const log=readFileSync(calls,'utf8');
 assert.doesNotMatch(log,/coworkers register/);
 assert.match(log,/coworkers update cw_old --name Summary · lokAl/);
 assert.match(log,/coworkers connect cw_old --vendor-id v1 --workspace-id org1/);
 assert.equal(sk.knownAccess('cw_old','org1'),'GRANTED');
 assert.deepEqual(await cw.spare(),[]); // now in use here
 await assert.rejects(cw.registerOnSokosumi('nope',{reuse:'cw_old'}),/No extra Coworker/);
});
test('a new one is registered and reports PENDING; retired ones are never reused',async()=>{
 const c=await cw.add({name:'Fresh',template:'freeform'});
 assert.equal(c.coworkerId,'cw_new');assert.equal(c.access,'PENDING');
 const failed=await cw.add({name:'Bad',template:'freeform',reuse:'cw_dead'});
 assert.equal(failed.coworkerId,null);
});
test('switching Workspace connects every Coworker and names the ones still waiting',async()=>{
 const step=await import('../core/steps/sokosumi.mjs');
 const r=await step.useWorkspace('tum');
 assert.equal(r.pending,false);
 assert.deepEqual(r.coworkers.map(c=>[c.id,c.access]),[['main','GRANTED'],['fresh','PENDING'],['summary','GRANTED']]);
 assert.deepEqual(r.waiting,['Fresh']);
});
test('setup can serve an existing Coworker as main; the old main becomes spare',async()=>{
 const step=await import('../core/steps/sokosumi.mjs');
 await assert.rejects(step.useCoworker('cw_old'),/already served here by the Coworker "Summary"/);
 await assert.rejects(step.useCoworker('cw_dead'),/retired/);
 await assert.rejects(step.useCoworker('cw_nobody'),/not one you own/);
 await cw.remove('summary');
 writeFileSync(calls,'');
 const r=await step.useCoworker('cw_old');
 assert.equal(r.coworkerId,'cw_old');assert.equal(r.access,'GRANTED');assert.equal(r.name,'Old · lokAl');
 const log=readFileSync(calls,'utf8');
 assert.match(log,/runtime key-import --coworker-id cw_old/);assert.doesNotMatch(log,/coworkers register/);
 assert.deepEqual((await cw.spare()).map(c=>c.id),['main-id']);
});
