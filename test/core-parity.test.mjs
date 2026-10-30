import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
// The TUI only talks to createCore(); core/mock.mjs must offer exactly the same functions.
const T=mkdtempSync(join(tmpdir(),'lokal-p-'));mkdirSync(join(T,'cw'));
process.env.LOKAL_HOME=join(T,'home');process.env.LOKAL_COWORKER_DIR=join(T,'cw');process.env.LOKAL_VAULT='file';
test('real and mock core expose the same interface',async()=>{
 const real=(await import('../core/index.mjs')).createCore();
 const mock=(await import('../core/mock.mjs')).createMockCore();
 assert.deepEqual(Object.keys(real).sort(),Object.keys(mock).sort());
 for(const k of Object.keys(real))assert.equal(typeof real[k],typeof mock[k],k);
});
