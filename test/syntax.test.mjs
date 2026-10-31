import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Entry points like coworker/agent-api.mjs are never imported by a test; a parse error only shows at service start.
const root=fileURLToPath(new URL('..',import.meta.url));
const files=execFileSync('git',['ls-files','*.mjs'],{cwd:root,encoding:'utf8'}).split('\n').filter(Boolean);

test('every tracked .mjs file parses',()=>{
 assert.ok(files.length>20);
 const bad=[];
 for(const f of files){try{execFileSync(process.execPath,['--check',f],{cwd:root,stdio:'pipe'})}catch(e){bad.push(`${f}: ${String(e.stderr).split('\n').find(l=>/Error/.test(l))}`)}}
 assert.deepEqual(bad,[]);
});
