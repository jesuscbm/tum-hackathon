import {createServer,request} from 'node:http';
import {spawn} from 'node:child_process';
import {existsSync,rmSync,openSync,writeFileSync,readFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {homedir,tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {HOME,LOGS,REPO,ensureDirs} from './paths.mjs';
import {bus,log,recentLogs} from './events.mjs';
// lokald: one background process that owns the agent, worker, agent API and payment service.
// The UI (or `lokal up`) talks to it over a Unix socket, so you can close the terminal or drop the SSH
// session and come back to the same running services with `lokal`.
// Unix socket paths are limited to ~107 bytes; a deep LOKAL_HOME gets a short per-home path instead.
export const SOCK=()=>{if(process.env.LOKAL_SOCK)return process.env.LOKAL_SOCK;const p=join(HOME,'lokald.sock');return Buffer.byteLength(p)<100?p:join(process.env.XDG_RUNTIME_DIR||tmpdir(),`lokald-${createHash('sha256').update(HOME).digest('hex').slice(0,12)}.sock`);};
const PIDF=()=>join(HOME,'lokald.pid');
// ---- client ----
export function call(path,{method='GET',body,timeout=10000}={}){
 return new Promise((res,rej)=>{
  const req=request({socketPath:SOCK(),path,method,headers:{'content-type':'application/json'},timeout},r=>{
   let d='';r.on('data',c=>d+=c);r.on('end',()=>{let j=null;try{j=JSON.parse(d)}catch{}if(r.statusCode>=400)rej(new Error(j?.error??`lokald HTTP ${r.statusCode}`));else res(j)});
  });
  req.on('error',rej);req.on('timeout',()=>req.destroy(new Error('lokald did not answer')));
  req.end(body===undefined?undefined:JSON.stringify(body));
 });
}
export async function status(){
 if(!existsSync(SOCK()))return {running:false};
 try{return {running:true,...await call('/status',{timeout:3000})}}catch{return {running:false,stale:true}}
}
// Starts lokald in the background (its own session, so it survives the terminal and SSH logout).
export async function ensure(){
 const s=await status();if(s.running)return s;
 ensureDirs();
 const out=openSync(join(LOGS,'lokald.log'),'a');
 const child=spawn(process.execPath,[join(REPO,'bin','lokal.mjs'),'daemon','run'],{detached:true,stdio:['ignore',out,out],env:process.env,cwd:HOME});
 child.unref();
 for(let i=0;i<60;i++){await new Promise(r=>setTimeout(r,250));const t=await status();if(t.running)return t;}
 throw new Error(`lokald did not start; see ${join(LOGS,'lokald.log')}`);
}
export async function shutdown(){const s=await status();if(!s.running)return false;await call('/shutdown',{method:'POST',timeout:30000}).catch(()=>{});for(let i=0;i<80&&(await status()).running;i++)await new Promise(r=>setTimeout(r,250));return true;}
// Server-sent events from lokald re-emitted on the local bus (log, services, job). Reconnects on its own.
export function subscribe(onEvent){
 let stopped=false,req=null;
 const connect=()=>{
  if(stopped)return;
  req=request({socketPath:SOCK(),path:'/events',method:'GET'},r=>{
   let buf='';r.setEncoding('utf8');
   r.on('data',c=>{buf+=c;let i;while((i=buf.indexOf('\n\n'))>=0){const chunk=buf.slice(0,i);buf=buf.slice(i+2);const line=chunk.split('\n').find(l=>l.startsWith('data:'));if(line)try{onEvent(JSON.parse(line.slice(5)))}catch{}}});
   r.on('end',()=>setTimeout(connect,2000));
  });
  req.on('error',()=>setTimeout(connect,2000));req.end();
 };
 connect();
 return ()=>{stopped=true;req?.destroy()};
}
// ---- server ----
export async function serve({sup,autostart=true}){
 ensureDirs();
 if((await status()).running)throw new Error('lokald is already running');
 rmSync(SOCK(),{force:true});
 const clients=new Set();
 const send=(type,data)=>{const msg=`data: ${JSON.stringify({type,data})}\n\n`;for(const c of clients)c.write(msg)};
 bus.on('log',e=>{if(e.level!=='debug')send('log',e)});
 bus.on('services',s=>send('services',s));
 const startedAt=Date.now();
 const json=(res,code,v)=>{res.writeHead(code,{'content-type':'application/json'});res.end(JSON.stringify(v??{}))};
 const routes={
  'GET /status':()=>({pid:process.pid,startedAt,services:sup.services()}),
  'GET /services':async()=>sup.refresh(),
  'GET /logs':(q)=>recentLogs(Number(q.get('n')||200)),
  'POST /start':async(q,b)=>{if(b?.id)await sup.start(b.id);else await sup.startAll();return sup.services()},
  'POST /stop':async(q,b)=>{if(b?.coworker)await sup.stopCoworker(b.coworker);else await sup.stopAll();return sup.services()},
  'POST /restart':async(q,b)=>{if(b?.id)await sup.restart(b.id);else{await sup.stopAll();await sup.startAll()}return sup.services()},
  'POST /shutdown':async()=>{setTimeout(()=>stop(),50);return {ok:true}},
 };
 const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://lokald');
  if(req.method==='GET'&&url.pathname==='/events'){
   res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-cache'});res.write(': hi\n\n');
   clients.add(res);req.on('close',()=>clients.delete(res));return;
  }
  const h=routes[`${req.method} ${url.pathname}`];if(!h)return json(res,404,{error:'not found'});
  let body='';for await(const c of req)body+=c;
  try{json(res,200,await h(url.searchParams,body?JSON.parse(body):undefined))}catch(e){json(res,500,{error:e.message})}
 });
 await new Promise((res,rej)=>{server.once('error',rej);server.listen(SOCK(),res)});
 writeFileSync(PIDF(),String(process.pid),{mode:0o600});
 log('lokald',`Running (pid ${process.pid}); socket ${SOCK()}`);
 let stopping=false;
 async function stop(){
  if(stopping)return;stopping=true;
  log('lokald','Stopping services');
  await sup.stopAll();
  for(const c of clients)c.end();
  server.close();rmSync(SOCK(),{force:true});rmSync(PIDF(),{force:true});
  process.exit(0);
 }
 process.on('SIGTERM',stop);process.on('SIGINT',stop);process.on('SIGHUP',()=>{});
 if(autostart)sup.startAll().catch(e=>log('lokald',e.message,'error'));
 return {stop};
}
// systemd --user unit so lokald also comes back after a reboot. Linger keeps it running without a login session.
export function systemdUnit({lokalBin}){
 const dir=join(process.env.XDG_CONFIG_HOME||join(homedir(),'.config'),'systemd','user');
 mkdirSync(dir,{recursive:true});
 const file=join(dir,'lokald.service');
 writeFileSync(file,`[Unit]\nDescription=lokAl: local LLM agent services (Sokosumi + Masumi)\nAfter=network-online.target\n\n[Service]\nExecStart=${lokalBin} daemon run\nRestart=on-failure\nRestartSec=5\nKillMode=mixed\nTimeoutStopSec=30\n\n[Install]\nWantedBy=default.target\n`);
 return file;
}
export const pidFile=PIDF;
export const readPid=()=>{try{return Number(readFileSync(PIDF(),'utf8'))}catch{return null}};
