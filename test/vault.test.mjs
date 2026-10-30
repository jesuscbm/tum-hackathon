import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,statSync,readFileSync,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
process.env.LOKAL_HOME=mkdtempSync(join(tmpdir(),'lokal-v-'));
process.env.LOKAL_VAULT='file';process.env.LOKAL_HEADLESS='1';
const v=await import('../core/vault.mjs');
test('headless: the file vault answers like secret-tool, and URLs are captured instead of opened',()=>{
 const r=v.setupHeadless();
 assert.deepEqual(r,{headless:true,vault:'file'});
 assert.ok(process.env.PATH.startsWith(v.SHIM_DIR));
 const st=(args,input)=>spawnSync('secret-tool',args,{input,encoding:'utf8'});
 // what the Sokosumi CLI probes: a missing item is exit 1 with nothing on stderr
 let x=st(['lookup','service','sokosumi-cli','account','preprod:oauth:x']);assert.equal(x.status,1);assert.equal(x.stderr,'');
 assert.equal(st(['store','--label','Sokosumi CLI','service','sokosumi-cli','account','preprod:oauth:x'],'{"token":"t"}').status,0);
 x=st(['lookup','service','sokosumi-cli','account','preprod:oauth:x']);assert.equal(x.status,0);assert.equal(x.stdout,'{"token":"t"}');
 assert.equal(st(['lookup','service','sokosumi-cli','account','other']).status,1);
 assert.equal(statSync(v.VAULT_DIR).mode&0o077,0);
 assert.equal(st(['clear','service','sokosumi-cli','account','preprod:oauth:x']).status,0);
 assert.equal(st(['lookup','service','sokosumi-cli','account','preprod:oauth:x']).status,1);
 assert.equal(spawnSync('xdg-open',['https://example.com/auth?x=1']).status,0);
 assert.equal(v.takeOpenedUrl(),'https://example.com/auth?x=1');
 assert.equal(v.takeOpenedUrl(),null);
});
test('headless detection',()=>{
 assert.equal(v.isHeadless({SSH_CONNECTION:'1 2 3 4'}),true);
 assert.equal(v.isHeadless({LOKAL_HEADLESS:'0',SSH_TTY:'/dev/pts/1'}),false);
});
