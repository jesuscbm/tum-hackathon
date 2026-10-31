import test from 'node:test';
import assert from 'node:assert/strict';
import {busy} from './job-limit.mjs';
const limit={perMinute:3,open:2};
test('the public agent API refuses floods but not expired or paid jobs',()=>{
 const now=1e12,times=[];
 assert.equal(busy([],times,now,limit),null);
 const open={status:'awaiting_payment',payment:{payByTime:now+60000}};
 assert.match(busy([open,open],[],now,limit),/waiting for payment/);
 assert.equal(busy([open,{...open,payment:{payByTime:now-1}},{status:'completed'}],[],now,limit),null);
 assert.match(busy([],[now-1000,now-2000,now-3000],now,limit),/this minute/);
 const old=[now-61000,now-62000,now-1000];assert.equal(busy([],old,now,limit),null);assert.equal(old.length,1);
});
