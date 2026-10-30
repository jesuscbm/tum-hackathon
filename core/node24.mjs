import {existsSync,mkdirSync,rmSync,createWriteStream,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join,dirname} from 'node:path';
import {pipeline} from 'node:stream/promises';
import {Readable} from 'node:stream';
import {HOME} from './paths.mjs';
import {run} from './exec.mjs';
import {log,progress} from './events.mjs';
// The Masumi payment service requires Node >=24.22.1 <25. lokal itself runs on any Node >=24, so the
// service gets this exact version: the one lokAl runs on if it matches, else a private, checksum-verified copy.
export const NODE_VERSION='v24.22.1';
const DIR=join(HOME,'node');
const ok=v=>{const [a,b,c]=v.replace(/^v/,'').split('.').map(Number);return a===24&&(b>22||b===22&&c>=1);};
export async function node24Bin(){
 if(ok(process.version))return dirname(process.execPath);
 const own=join(DIR,'bin','node');
 if(existsSync(own)){const r=await run(own,['-v'],{quiet:true,timeout:10000});if(ok(r.stdout.trim()))return dirname(own);}
 const os={linux:'linux',darwin:'darwin'}[process.platform],arch={x64:'x64',arm64:'arm64'}[process.arch];
 if(!os||!arch)throw new Error(`No Node ${NODE_VERSION} build for ${process.platform}-${process.arch}`);
 const name=`node-${NODE_VERSION}-${os}-${arch}.tar.gz`,base=`https://nodejs.org/dist/${NODE_VERSION}`;
 log('node',`Downloading Node ${NODE_VERSION} for the payment service`);
 const sums=await (await fetch(`${base}/SHASUMS256.txt`)).text();
 const expected=sums.split('\n').find(l=>l.endsWith(' '+name))?.split(/\s+/)[0];
 if(!expected)throw new Error('Node checksum not found');
 mkdirSync(HOME,{recursive:true});const file=join(HOME,name);
 const res=await fetch(`${base}/${name}`);if(!res.ok)throw new Error(`Node download HTTP ${res.status}`);
 const total=Number(res.headers.get('content-length'))||0;let got=0;
 const body=Readable.fromWeb(res.body);body.on('data',c=>{got+=c.length;if(total)progress('node',`Downloading Node ${NODE_VERSION}`,got/total)});
 await pipeline(body,createWriteStream(file));
 const actual=createHash('sha256').update(readFileSync(file)).digest('hex');
 if(actual!==expected){rmSync(file);throw new Error('Node checksum mismatch; refusing to use it');}
 rmSync(DIR,{recursive:true,force:true});mkdirSync(DIR,{recursive:true});
 const r=await run('tar',['-xzf',file,'-C',DIR,'--strip-components=1'],{quiet:true,timeout:300000});
 rmSync(file);if(r.code!==0)throw new Error('Unpacking Node failed');
 progress('node',`Node ${NODE_VERSION} ready`,1);
 return join(DIR,'bin');
}
