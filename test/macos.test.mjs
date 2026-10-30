import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
process.env.LOKAL_HOME=mkdtempSync(join(tmpdir(),'lokal-mac-'));
const {availableFromVmStat}=await import('../core/resources.mjs');
const d=await import('../core/daemon.mjs');
const db=await import('../pay/db.mjs');
test('macOS available memory counts free, inactive, speculative and purgeable pages',()=>{
 const t='Mach Virtual Memory Statistics: (page size of 16384 bytes)\nPages free:      100.\nPages active:    999.\nPages inactive:  50.\nPages speculative: 10.\nPages wired down: 777.\nPages purgeable: 5.\n';
 assert.equal(availableFromVmStat(t),165*16384);
 assert.equal(availableFromVmStat('garbage'),null);
});
test('autostart: a launchd agent on macOS, a systemd unit elsewhere, both with PATH',()=>{
 const plist=d.autostartUnit({lokalBin:'/Users/a&b/.local/bin/lokal',path:'/opt/homebrew/bin:/usr/bin',home:'/h',platform:'darwin'});
 assert.match(plist,/<string>network\.lokal\.lokald<\/string>/);
 assert.match(plist,/<string>\/Users\/a&amp;b\/\.local\/bin\/lokal<\/string><string>daemon<\/string><string>run<\/string>/);
 assert.match(plist,/<key>PATH<\/key><string>\/opt\/homebrew\/bin:\/usr\/bin<\/string>/);
 const unit=d.autostartUnit({lokalBin:'/home/u/.local/bin/lokal',path:'/a:/b',home:'/h',platform:'linux'});
 assert.match(unit,/ExecStart=\/home\/u\/\.local\/bin\/lokal daemon run/);
 assert.match(unit,/Environment="PATH=\/a:\/b"/);
});
test('the database backend, once recorded, never switches',async()=>{
 assert.equal(await db.pick('docker'),'docker');
 assert.equal(await db.pick('native'),'native');
 assert.match(db.installHint(),/postgres/i);
});
