import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
process.env.LOKAL_HOME=mkdtempSync(join(tmpdir(),'lokal-d-'));
process.env.LOKAL_SOCK=join(process.env.LOKAL_HOME,'t.sock');
const d=await import('../core/daemon.mjs');
const {bus}=await import('../core/events.mjs');
test('lokald answers over its socket and streams events',async()=>{
 const calls=[];
 const sup={services:()=>[{id:'agent',status:calls.includes('start')?'running':'stopped'}],refresh:async()=>sup.services(),
  startAll:async()=>{calls.push('start');bus.emit('services',sup.services())},start:async id=>calls.push('start:'+id),stopAll:async()=>calls.push('stop'),stopCoworker:async c=>calls.push('stop:'+c),restart:async id=>calls.push('restart:'+id)};
 assert.equal((await d.status()).running,false);
 const srv=await d.serve({sup,autostart:false});
 const s=await d.status();assert.equal(s.running,true);assert.equal(s.pid,process.pid);
 const events=[];const stop=d.subscribe(e=>events.push(e));
 await new Promise(r=>setTimeout(r,200));
 await d.call('/start',{method:'POST',body:{}});
 await d.call('/start',{method:'POST',body:{id:'mps'}});
 await d.call('/stop',{method:'POST',body:{coworker:'x'}});
 await new Promise(r=>setTimeout(r,200));
 assert.deepEqual(calls,['start','start:mps','stop:x']);
 assert.ok(events.some(e=>e.type==='services'&&e.data[0].status==='running'));
 await assert.rejects(d.call('/nope'),/not found/);
 stop();
 // stop() exits the process in production; here only check the socket answers until then.
 assert.equal(typeof srv.stop,'function');
 process.exit(0);
});
