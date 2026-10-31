import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
const dir=mkdtempSync(join(tmpdir(),'lokal-hard-'));
process.env.LOKAL_HOME=join(dir,'home');process.env.LOKAL_COWORKER_DIR=join(dir,'cw');
const {writeEnv,readEnv,envValue}=await import('../core/config.mjs');
const {takeLock}=await import('../core/daemon.mjs');
const {earnings}=await import('../core/jobs.mjs');
test('settings survive Node\'s --env-file parser, and a line break cannot add a setting',()=>{
 const f=join(dir,'t.env');
 writeEnv({NAME:'Invoices #1',DESC:"it's fine",PRICE:'2 ADA'},f);
 assert.deepEqual(readEnv(f),{NAME:'Invoices #1',DESC:"it's fine",PRICE:'2 ADA'});
 const seen=JSON.parse(execFileSync(process.execPath,[`--env-file=${f}`,'-e','console.log(JSON.stringify([process.env.NAME,process.env.DESC]))'],{encoding:'utf8'}));
 assert.deepEqual(seen,['Invoices #1',"it's fine"]);
 assert.throws(()=>writeEnv({AGENT_PUBLIC_URL:'https://x\nPAID_TASKS_ENABLED=true'},f),/line break/);
 assert.ok(!readFileSync(f,'utf8').includes('PAID_TASKS_ENABLED'));
 assert.equal(envValue('plain'),'plain');
});
test('only one lokald per home: a live lock refuses, a stale one is taken over',()=>{
 const f=join(dir,'lokald.lock');
 writeFileSync(f,String(process.ppid));
 assert.throws(()=>takeLock(f),/already running/);
 writeFileSync(f,'999999999');
 assert.equal(takeLock(f),true);assert.equal(readFileSync(f,'utf8'),String(process.pid));
});
test('earnings add up each settled job at its own price',()=>{
 const usdm={unit:'16a5',amount:'500000'},ada={unit:'',amount:'2000000'};
 const e=earnings([{status:'paid',funds:[usdm]},{status:'x',settled:true,funds:[ada]},{status:'withheld',funds:[ada]},{status:'paid'}]);
 assert.deepEqual([e.paidJobs,e.usdm,e.ada],[3,1.5,2]);
});
