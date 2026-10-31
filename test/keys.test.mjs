import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
// The view keys (w d c i l, and q) are handled before any view's own keys, so a view must not reuse them.
test('no view or step key is shadowed by a global key',()=>{
 const src=readFileSync(new URL('../tui/app.mjs',import.meta.url),'utf8');
 const globals=[...Object.keys(Function(`return ${src.match(/const VIEWS=(\{[^}]*\})/)[1]}`)()),'q'];
 const handler=src.slice(src.indexOf('useInput('));
 const body=handler.slice(handler.indexOf("if(VIEWS[input])"));
 for(const k of globals)assert.ok(!body.includes(`input==='${k}'`),`key ${k} is a global view key but a view also uses it`);
 for(const [,k] of src.matchAll(/\['([a-z])','[^']+'\]/g))if(globals.includes(k)&&!['d'].includes(k))assert.fail(`hint advertises global key ${k} for a local action`);
});
