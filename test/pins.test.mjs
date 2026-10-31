import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=f=>readFileSync(new URL(`../${f}`,import.meta.url),'utf8');
test('the Sokosumi CLI pin is the same everywhere, and its install is locked',async()=>{
 const {CLI_VERSION}=await import('../core/sokosumi.mjs');
 assert.equal(read('install.sh').match(/SOKOSUMI_VERSION="([^"]+)"/)[1],CLI_VERSION);
 assert.equal(JSON.parse(read('sokosumi-cli/package.json')).dependencies['@masumi_network/sokosumi'],CLI_VERSION);
 const lock=JSON.parse(read('sokosumi-cli/package-lock.json'));
 assert.equal(lock.packages['node_modules/@masumi_network/sokosumi'].version,CLI_VERSION);
});
