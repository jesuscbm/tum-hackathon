// Job templates: built-in ones live next to this file, custom ones under $LOKAL_HOME/templates.
import {existsSync,readFileSync,readdirSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {homedir} from 'node:os';
import {fileURLToPath} from 'node:url';
export const BUILTIN_DIR=dirname(fileURLToPath(import.meta.url));
export const customDir=()=>join(process.env.LOKAL_HOME||join(homedir(),'.local','share','lokal'),'templates');
const ID=/^[a-z0-9][a-z0-9-]{0,47}$/u;
function readTemplate(dir){
 const meta=JSON.parse(readFileSync(join(dir,'template.json'),'utf8'));
 const prompt=readFileSync(join(dir,'prompt.md'),'utf8');
 const samplesDir=join(dir,'samples');
 const samples=existsSync(samplesDir)?readdirSync(samplesDir).filter(f=>f.endsWith('.txt')).sort().map(file=>({
  name:file.replace(/\.txt$/u,'').replace(/^(pass|fail)-/u,'').replace(/-/gu,' '),
  file:join(samplesDir,file),expect:file.startsWith('fail-')?'fail':'pass',text:readFileSync(join(samplesDir,file),'utf8')
 })):[];
 return {...meta,prompt,dir,samples};
}
const templateDirs=root=>existsSync(root)?readdirSync(root,{withFileTypes:true}).filter(d=>d.isDirectory()&&existsSync(join(root,d.name,'template.json'))).map(d=>join(root,d.name)):[];
export function listTemplates(root=BUILTIN_DIR){
 const builtin=templateDirs(root).map(dir=>({...readTemplate(dir),custom:false}));
 const ids=new Set(builtin.map(t=>t.id));
 const custom=templateDirs(customDir()).map(dir=>({...readTemplate(dir),custom:true})).filter(t=>!ids.has(t.id));
 return [...builtin,...custom];
}
export function loadTemplate(id){
 if(!ID.test(id))throw new Error(`Invalid template id: ${id}`);
 for(const root of [BUILTIN_DIR,customDir()]){const dir=join(root,id);if(existsSync(join(dir,'template.json')))return readTemplate(dir);}
 throw new Error(`Template not found: ${id}`);
}
export function saveCustomTemplate({id,name,prompt,check,description='',inputLabel='Describe what you need'}){
 if(!ID.test(id))throw new Error('Template id must be lowercase letters, digits and dashes');
 if(existsSync(join(BUILTIN_DIR,id)))throw new Error(`"${id}" is a built-in template`);
 if(typeof prompt!=='string'||!prompt.trim())throw new Error('Prompt must not be empty');
 const dir=join(customDir(),id);mkdirSync(dir,{recursive:true});
 writeFileSync(join(dir,'template.json'),JSON.stringify({id,name:name||id,description,inputLabel,check:check??{type:'none'},price:{amount:'1000000',unit:'USDM',display:'1 USDM'}},null,2)+'\n');
 writeFileSync(join(dir,'prompt.md'),prompt.endsWith('\n')?prompt:prompt+'\n');
 return readTemplate(dir);
}
// Passing samples first: the default demo input should succeed.
export const orderedSamples=t=>[...(t.samples??[]).filter(s=>s.expect==='pass'),...(t.samples??[]).filter(s=>s.expect!=='pass')];
