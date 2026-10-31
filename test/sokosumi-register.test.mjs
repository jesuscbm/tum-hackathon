import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,chmodSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
// A fake Sokosumi CLI on PATH: every name is "taken" (409) except ones with a suffix.
const bin=mkdtempSync(join(tmpdir(),'lokal-soko-'));const calls=join(bin,'calls');
writeFileSync(join(bin,'sokosumi'),`#!/bin/sh
echo "$@" >> "${calls}"
case "$*" in *"--name Taken by you --"*) echo '{"error":"Core API request failed with status 409: coworker slug already exists"}' >&2; exit 1;; esac
echo '{"coworker":{"id":"cw_new"}}'
`);chmodSync(join(bin,'sokosumi'),0o755);
process.env.PATH=`${bin}:${process.env.PATH}`;
process.env.LOKAL_HOME=mkdtempSync(join(tmpdir(),'lokal-soko-home-')); // logs go here, not to the real lokal.log
const sk=await import('../core/sokosumi.mjs');
test('a Coworker name that is taken on Sokosumi gets a short suffix instead of failing',async()=>{
 const c=await sk.registerCoworker({vendorId:'v',name:'Taken by you',description:'d'});
 assert.equal(c.id,'cw_new');assert.match(c.name,/^Taken by you [0-9a-f]{4}$/);
 assert.equal(readFileSync(calls,'utf8').trim().split('\n').length,2);
});
test('renaming to a taken name explains it',async()=>{
 writeFileSync(join(bin,'sokosumi'),`#!/bin/sh\necho '{"error":"Core API request failed with status 409: coworker slug already exists"}' >&2; exit 1\n`);
 await assert.rejects(sk.renameCoworker('cw','Taken'),/taken on Sokosumi/);
});
