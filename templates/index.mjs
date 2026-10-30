// Job templates: built-in ones live next to this file, custom ones under $LOKAL_HOME/templates.
// A custom template is either a folder (template.json + prompt.md + samples/) or one Markdown file with
// front matter, which is the easy way to write prompts ahead of time:
//   ---
//   name: Contract summary
//   description: Summarises a contract as JSON
//   check: json                  # none | json | schema | regex | length | invoice (or a JSON object)
//   pattern: ^OK                 # regex check;  min/max: length check;  schema: {...} for schema
//   price: 1                     # USDM
//   ---
//   You are ... (the system prompt)
import {existsSync,readFileSync,readdirSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,dirname,basename} from 'node:path';
import {check} from '../checks/index.mjs';
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
// Front matter: one `key: value` per line; values are JSON when they parse as JSON, else plain text.
export function parseFrontMatter(text){
 const m=String(text).replace(/^\uFEFF/u,'').match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/u);
 if(!m)return {meta:{},body:String(text)};
 const meta={};
 for(const line of m[1].split(/\r?\n/u)){
  const kv=line.match(/^\s*([A-Za-z][\w-]*)\s*:\s*(.*?)\s*$/u);if(!kv)continue;
  let v=kv[2].replace(/\s+#.*$/u,'');try{v=JSON.parse(v)}catch{}
  meta[kv[1]]=v;
 }
 return {meta,body:m[2].replace(/^\s*\n/u,'')};
}
function checkFromMeta(meta){
 const c=meta.check;
 if(c&&typeof c==='object')return c;
 const type=c?String(c):'none';
 const cfg={type};
 for(const k of ['pattern','flags','min','max','schema'])if(meta[k]!==undefined)cfg[k]=meta[k];
 return cfg;
}
export function templateFromMarkdown(text,fallbackId){
 const {meta,body}=parseFrontMatter(text);
 const id=String(meta.id??fallbackId??'').toLowerCase();
 if(!ID.test(id))throw new Error(`Template id must be lowercase letters, digits and dashes (got "${id}")`);
 if(!body.trim())throw new Error('The prompt (the text after the front matter) is empty');
 const cfg=checkFromMeta(meta);
 check(cfg,'','x'); // throws on a broken check config
 const amount=Number(meta.price??1);
 if(!(amount>0))throw new Error('price must be a positive number of USDM');
 return {id,name:String(meta.name??id),description:String(meta.description??''),inputLabel:String(meta.input??meta.inputLabel??'Describe what you need'),
  check:cfg,price:{amount:String(Math.round(amount*1e6)),unit:'USDM',display:`${amount} USDM`},prompt:body.endsWith('\n')?body:body+'\n',samples:[]};
}
const mdFiles=root=>existsSync(root)?readdirSync(root).filter(f=>f.endsWith('.md')&&ID.test(f.slice(0,-3))).map(f=>join(root,f)):[];
function readMd(file){return {...templateFromMarkdown(readFileSync(file,'utf8'),basename(file,'.md')),id:basename(file,'.md'),dir:dirname(file),file};}
export function listTemplates(root=BUILTIN_DIR){
 const builtin=templateDirs(root).map(dir=>({...readTemplate(dir),custom:false}));
 const ids=new Set(builtin.map(t=>t.id));
 const custom=templateDirs(customDir()).map(dir=>({...readTemplate(dir),custom:true})).filter(t=>!ids.has(t.id));
 for(const t of custom)ids.add(t.id);
 const md=[];for(const f of mdFiles(customDir())){try{const t=readMd(f);if(!ids.has(t.id))md.push({...t,custom:true})}catch{}}
 return [...builtin,...custom,...md];
}
export function loadTemplate(id){
 if(!ID.test(id))throw new Error(`Invalid template id: ${id}`);
 for(const root of [BUILTIN_DIR,customDir()]){const dir=join(root,id);if(existsSync(join(dir,'template.json')))return readTemplate(dir);}
 const md=join(customDir(),`${id}.md`);if(existsSync(md))return readMd(md);
 throw new Error(`Template not found: ${id}`);
}
// Copies a Markdown prompt into the custom templates folder (validated first). Returns the template.
export function importMarkdown(file){
 const text=readFileSync(file,'utf8');
 const t=templateFromMarkdown(text,basename(file).replace(/\.md$/iu,'').toLowerCase().replace(/[^a-z0-9-]+/gu,'-').replace(/^-+|-+$/gu,'').slice(0,48));
 if(existsSync(join(BUILTIN_DIR,t.id)))throw new Error(`"${t.id}" is a built-in template; set another id: in the front matter`);
 mkdirSync(customDir(),{recursive:true});
 writeFileSync(join(customDir(),`${t.id}.md`),text);
 return loadTemplate(t.id);
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
