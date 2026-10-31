#!/usr/bin/env node
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const [cmd,...args]=process.argv.slice(2);
const mock=process.env.LOKAL_MOCK==='1'||args.includes('--mock')||cmd==='--mock';
const flag=f=>args.includes(f);
const opt=f=>{const i=args.indexOf(f);return i>=0?args[i+1]:undefined};
const pos=args.filter((a,i)=>!a.startsWith('--')&&!(i>0&&['--template','--prompt','--out','--model','--coworker'].includes(args[i-1])));
const HELP=`lokAl: your local LLM, hired and paid on Cardano

  lokal              open the setup wizard / dashboard (terminal UI); services keep running when you quit
  lokal status       print every setup step without the UI (works over SSH, in CI)
  lokal info [--json]
                     your data: wallet address, agent id, Coworker ids, links, where files live
  lokal up           start the background services (lokald) and follow their logs; Ctrl+C only detaches
  lokal down         stop lokald and every service it runs
  lokal daemon start|stop|status|logs|enable|disable|run
                     manage lokald; enable starts it at login and after reboots (systemd on Linux, launchd on macOS)
  lokal run STEP     run one setup step headless (machine, job [id], sokosumi, pay, live)
  lokal model [ollama TAG | api URL [MODEL] | llamacpp [URL]]
                     show or switch the model: any Ollama tag, or any OpenAI-compatible API (key on stdin)
  lokal login        sign in to Sokosumi with an API key (stdin), for machines without a browser
  lokal workspace [list | personal | SLUG] [--yes]
                     which Sokosumi Workspace sends tasks to the main Coworker (an organization needs a connect)
  lokal sokosumi …   the Sokosumi CLI, with lokAl's keyring stand-in (for SSH servers)
  lokal prompt add FILE.md | list
                     add a job written in Markdown (front matter: name, check, price; body: the prompt)
  lokal coworker list | add NAME [--template ID | --prompt FILE.md] [--yes] | remove ID [--retire] | paid ID
                     serve several jobs side by side, each as its own Sokosumi Coworker
  lokal network [preprod | mainnet]
                     show or switch the Cardano network (mainnet moves real money)
  lokal wallet [export [--out FILE]]
                     selling wallet address and balance; export prints its recovery phrase (asks first)
  lokal price [PRICE | default] [--coworker ID]
                     show or set what buyers pay per job: "1 USDM", "0.5 USDM", "2 ADA" (Tasks and agent API)
  lokal buy [TEXT | --file FILE] [--yes]
                     be your own buyer: hire this agent through its agent API and pay from your purchasing wallet
  lokal set NAME     save BLOCKFROST_API_KEY_PREPROD, BLOCKFROST_API_KEY_MAINNET, AGENT_AUTHOR, AGENT_PUBLIC_URL
                     or AGENT_API_HOST (value on stdin)
  lokal doctor       one line per layer: model, agent, worker, Sokosumi, payments
  lokal verify FILE [HASH]
                     check a result's canonical JSON against an on-chain resultHash
  lokal uninstall    remove everything lokAl installed [--models] [--logout] [--all]
  --mock             fake backend, for demos and UI work`;
async function core(){return mock?(await import('../core/mock.mjs')).createMockCore():(await import('../core/index.mjs')).createCore();}
const ICON={ok:'✔',todo:'○',action:'➜',input:'✎',fail:'✖',warn:'!',running:'◐',off:'·'};
const die=(m,code=1)=>{console.error(`✖ ${m}`);process.exit(code)};
// Secrets come from stdin (piped) or a masked prompt, never from argv or shell history.
async function readSecret(label,{allowEmpty=false}={}){
 let v='';
 if(process.stdin.isTTY){process.stdout.write(`${label}: `);process.stdin.setRawMode(true);for await(const ch of process.stdin){const c=String(ch);if(c==='\r'||c==='\n')break;if(c==='\u0003')process.exit(130);if(c==='\u007f'){v=v.slice(0,-1);continue}v+=c;}process.stdin.setRawMode(false);process.stdout.write('\n');}
 else for await(const ch of process.stdin)v+=ch;
 v=v.trim();if(!v&&!allowEmpty)die(`${label}: nothing entered`);return v;
}
async function ask(q){process.stdout.write(q);let v='';for await(const ch of process.stdin){v+=ch;if(v.includes('\n'))break;}return v.trim();}
const printStep=st=>{console.log(`\n${ICON[st.status]??'○'} ${st.title}${st.error?`  (${st.error})`:''}`);for(const i of st.items??[])console.log(`   ${ICON[i.status]??'○'} ${i.label.padEnd(18)} ${i.detail}${i.command?`\n     → ${i.command}`:''}`);};
const followLogs=c=>{c.bus.on('log',e=>{if(e.level!=='debug')console.log(`[${e.source}] ${e.line}`)});c.bus.on('services',s=>console.log('services: '+s.map(x=>`${x.id}=${x.status}${x.external?'(external)':''}`).join(' ')));};

if(cmd==='help'||cmd==='--help'||cmd==='-h'){console.log(HELP);}
else if(cmd==='status'){
 const c=await core();
 for(const s of await c.statusAll())printStep(s);
 const d=await c.daemon();console.log(`\n${d.running?'✔':'·'} lokald ${d.running?`running (pid ${d.pid})`:'not running (lokal up starts it)'}`);
 process.exit(0);
}
else if(cmd==='info'){
 const c=await core();const i=await c.info();
 if(flag('--json'))console.log(JSON.stringify(i,null,1));else{const {infoLines}=await import('../core/info.mjs');console.log(infoLines(i).join('\n'));}
 process.exit(0);
}
else if(cmd==='doctor'){
 const c=await core();
 for(const h of await c.health())console.log(`${ICON[h.status]} ${h.label.padEnd(10)} ${h.status==='fail'?`${h.detail} → ${h.fix}`:h.status==='off'?'not enabled':h.detail}`);
 process.exit(0);
}
else if(cmd==='verify'){
 const {verifyResult,resultHash}=await import('../provenance.mjs');
 if(!args[0])die('usage: lokal verify FILE [HASH]',2);
 const text=readFileSync(args[0],'utf8').replace(/\n$/,'');
 if(!args[1]){console.log(resultHash(text));process.exit(0);}
 const r=verifyResult(text,args[1]);
 if(r.ok){const p=r.parsed;console.log(`✔ hash matches\n  model   ${p.model}\n  weights ${p.digest??'unverified'}\n  prompt  ${p.promptHash}\n  check   ${p.check?.type}: ${p.check?.pass?'passed':'failed'}`);process.exit(0);}
 console.log(`✖ ${r.reason??'hash does not match'}`);process.exit(1);
}
else if(cmd==='up'){
 // Services run in lokald; this terminal only shows their logs. Closing it (or the SSH session) changes nothing.
 const c=await core();
 if(mock){followLogs(c);await c.startServices();console.log('mock services started');process.exit(0);}
 await c.startServices();
 const d=await c.daemon();console.log(`lokald running (pid ${d.pid}). Ctrl+C stops following; services keep running. Stop them with: lokal down\n`);
 followLogs(c);await c.attach();
 process.on('SIGINT',()=>process.exit(0));
 setInterval(()=>{},1<<30);
}
else if(cmd==='down'){const c=await core();console.log(await c.stopDaemon()?'✔ lokald and its services stopped':'· lokald was not running');process.exit(0);}
else if(cmd==='daemon'){
 const sub=args[0]??'status';
 const d=await import('../core/daemon.mjs');
 if(sub==='run'){
  // Foreground supervisor (what `start` spawns, and what systemd runs).
  const {setupHeadless}=await import('../core/vault.mjs');setupHeadless();
  const sup=await import('../core/supervisor.mjs');
  const {bus}=await import('../core/events.mjs');
  bus.on('log',e=>{if(e.level!=='debug')console.log(`${new Date(e.at).toISOString()} [${e.source}] ${e.line}`)});
  await d.serve({sup,autostart:!flag('--idle')});
 }
 else if(sub==='start'){const c=await core();await c.startServices();const s=await d.status();console.log(`✔ lokald running (pid ${s.pid})`);process.exit(0);}
 else if(sub==='stop'){console.log(await d.shutdown()?'✔ lokald stopped':'· lokald was not running');process.exit(0);}
 else if(sub==='logs'){const c=await core();if(!(await d.status()).running)die('lokald is not running');followLogs(c);await c.attach();process.on('SIGINT',()=>process.exit(0));setInterval(()=>{},1<<30);}
 else if(sub==='enable'||sub==='disable'){
  const {spawnSync}=await import('node:child_process');const {homedir}=await import('node:os');const {existsSync,rmSync}=await import('node:fs');
  const mac=process.platform==='darwin',f=d.autostartFile(),sh=(c,a)=>spawnSync(c,a,{stdio:'inherit'}).status===0;
  const uid=process.getuid?.();
  if(sub==='disable'){
   if(mac)spawnSync('launchctl',['bootout',`gui/${uid}/${d.LAUNCHD_LABEL}`],{stdio:'ignore'});
   else spawnSync('systemctl',['--user','disable','--now','lokald.service'],{stdio:'ignore'});
   if(existsSync(f))rmSync(f);console.log('✔ lokald no longer starts on its own (lokal up still starts it)');process.exit(0);
  }
  const bin=process.env.LOKAL_BIN||resolve(homedir(),'.local','bin','lokal');
  if(!existsSync(bin))die(`${bin} not found: enable works for an installed lokal (install.sh)`);
  const {setupHeadless}=await import('../core/vault.mjs');setupHeadless(); // the unit's PATH keeps the headless stand-ins
  await d.shutdown();
  d.writeAutostart({lokalBin:bin});console.log(`✔ wrote ${f}`);
  if(mac){
   spawnSync('launchctl',['bootout',`gui/${uid}/${d.LAUNCHD_LABEL}`],{stdio:'ignore'});
   if(!sh('launchctl',['bootstrap',`gui/${uid}`,f])&&!sh('launchctl',['load','-w',f]))die('launchctl could not load it; run `lokal daemon start` instead');
   console.log('lokald now starts when you log in to this Mac, and restarts if it crashes.');
  }else{
   if(!sh('systemctl',['--user','daemon-reload']))die('systemctl --user is not available here; use `lokal daemon start` instead');
   sh('systemctl',['--user','enable','--now','lokald.service']);
   console.log('lokald now starts with your user session. To keep it running after you log out of SSH:\n  sudo loginctl enable-linger $USER');
  }
  process.exit(0);
 }
 else{const s=await d.status();console.log(s.running?`✔ lokald running (pid ${s.pid}, since ${new Date(s.startedAt).toLocaleString()})\n${s.services.map(x=>`   ${ICON[x.status==='running'?'ok':x.status==='failed'?'fail':'todo']} ${x.id.padEnd(16)} ${x.status}${x.pid?` pid ${x.pid}`:''}`).join('\n')}`:'· lokald not running');process.exit(0);}
}
else if(cmd==='run'){
 // Headless step runner: lokal run machine|job|sokosumi|pay|live  (prints the step status afterwards)
 const c=await core();c.bus.on('log',e=>console.log(`[${e.source}] ${e.line}`));
 let last='';c.bus.on('progress',e=>{if(e.label!==last){last=e.label;console.log('…',e.label)}});
 if(args[0]==='job'&&args[1])await c.selectTemplate(args[1]);
 const s=args[0]==='pay'?await c.runPay():await c.runStep(args[0]);
 printStep({...await c.status(args[0]),error:s?.error});
 process.exit(s?.error?1:0);
}
else if(cmd==='model'){
 const c=await core();c.bus.on('progress',e=>e.label&&process.stdout.write(`\r… ${e.label}`.padEnd(70)));
 const [kind,a,b]=pos;
 try{
  if(kind==='ollama'){if(a)await c.chooseModel(a);else await c.useOllama();const s=await c.runStep('machine');if(s?.error)throw new Error(s.error);}
  else if(kind==='api'){if(!a)die('usage: lokal model api URL [MODEL]   (API key on stdin; empty for none)',2);const key=await readSecret('API key (empty if none)',{allowEmpty:true});await c.useExternal({baseURL:a,apiKey:key,model:b});}
  else if(kind==='llamacpp')await c.useLlamacpp({baseURL:a});
  else if(kind)die('usage: lokal model [ollama TAG | api URL [MODEL] | llamacpp [URL]]',2);
 }catch(e){die(e.message)}
 console.log('');printStep(await c.status('machine'));
 if(kind&&(await c.daemon()).running)console.log('\nRestart services to use it: lokal down && lokal up');
 process.exit(0);
}
else if(cmd==='login'){
 const c=await core();
 const key=await readSecret('Sokosumi API key (soko_preprod_…, from https://preprod.sokosumi.com/connections)');
 try{await c.loginWithKey(key);console.log('✔ Signed in to Sokosumi');}catch(e){die(e.message)}
 process.exit(0);
}
else if(cmd==='workspace'||cmd==='workspaces'){
 const c=await core();const s=await c.status('sokosumi');const to=pos[0];
 if(!to||to==='list'){
  if(!s.workspaces)die('Sign in and create the Coworker first: lokal run sokosumi');
  for(const w of s.workspaces)console.log(`${w.id===s.workspace?'●':' '} ${w.id.padEnd(24)} ${w.name} · ${w.hint}`);
  process.exit(0);
 }
 if(to!=='personal'&&!flag('--yes')&&!mock){
  if(!process.stdin.isTTY)die('Connecting the Coworker to a Workspace writes to Sokosumi: pass --yes to confirm',2);
  if(!/^y/i.test(await ask(`Connect your Coworker to the Workspace ${to}? Its members can then send it tasks. [y/N] `)))process.exit(1);
 }
 try{const r=await c.useWorkspace(to);console.log(r.pending?`… Waiting for a ${r.org.name} admin to approve (${r.access}). Run this again afterwards.`:`✔ Workspace: ${r.org?.name??'Personal Workspace'}. Restart services to apply: lokal down && lokal up`);}catch(e){die(e.message)}
 process.exit(0);
}
else if(cmd==='prompt'){
 const c=await core();
 if(args[0]==='add'){if(!args[1])die('usage: lokal prompt add FILE.md',2);try{const s=await c.importPrompt(resolve(args[1]));console.log(`✔ ${s.items[0].detail} is now the main Coworker's job`);}catch(e){die(e.message)}}
 else for(const t of c.templates())console.log(`${t.id.padEnd(22)} ${t.name.padEnd(26)} check: ${t.check?.type??'none'}${t.custom?'  (custom)':''}`);
 process.exit(0);
}
else if(cmd==='coworker'||cmd==='coworkers'){
 const c=await core();const sub=pos[0]??'list';
 try{
  if(sub==='add'){
   const name=pos[1];if(!name)die('usage: lokal coworker add NAME [--template ID | --prompt FILE.md] [--yes]',2);
   let template=opt('--template')??'freeform';
   if(opt('--prompt')){const {importMarkdown}=await import('../templates/index.mjs');template=importMarkdown(resolve(opt('--prompt'))).id;}
   if(!flag('--yes')&&!mock){if(!process.stdin.isTTY)die('Creating a Coworker writes to Sokosumi: pass --yes to confirm');if(!/^y/i.test(await ask(`Create the Sokosumi Coworker "${name}" (job: ${template})? [y/N] `)))process.exit(1);}
   c.bus.on('log',e=>e.source==='coworkers'&&console.log(`  ${e.line}`));
   const x=await c.addCoworker({name,template});
   console.log(`✔ Coworker ${x.name} (${x.id})${x.coworkerId?` · Sokosumi ${x.coworkerId}`:' · not on Sokosumi yet'}\n  folder ${x.dir}\n  start it with: lokal up`);
  }
  else if(sub==='remove'||sub==='rm'){
   const id=pos[1];if(!id)die('usage: lokal coworker remove ID [--retire]',2);
   if(!flag('--yes')&&process.stdin.isTTY&&!/^y/i.test(await ask(`Stop and delete Coworker ${id}${flag('--retire')?' and rename it "(retired)" on Sokosumi':''}? [y/N] `)))process.exit(1);
   await c.removeCoworker(id,{retire:flag('--retire')});console.log(`✔ Removed ${id}`);
  }
  else if(sub==='paid'){const id=pos[1];if(!id)die('usage: lokal coworker paid ID',2);await c.registerCoworkerPaid(id);console.log(`✔ Registration for ${id} submitted; lokal info shows its state`);}
  else if(sub==='register'){const x=await c.registerCoworkerOnSokosumi(pos[1]);console.log(`✔ ${x.name}: Sokosumi ${x.coworkerId}`);}
  else if(sub==='job'){const x=await c.setCoworkerTemplate(pos[1],pos[2]);console.log(`✔ ${x.name} now does ${x.template}. Restart services to apply.`);}
  else for(const x of c.coworkers())console.log(`${x.id.padEnd(16)} ${String(x.name).padEnd(22)} job: ${String(x.template??'—').padEnd(16)} ${x.coworkerId?`sokosumi ${x.coworkerId}`:'not on Sokosumi'}${x.paid?` · paid, ${x.price}`:''}  ports ${x.ports.eve}/${x.ports.api}`);
 }catch(e){die(e.message)}
 process.exit(0);
}
else if(cmd==='network'){
 const c=await core();const to=pos[0];
 if(!to){console.log(c.network());process.exit(0);}
 if(to==='mainnet'&&!flag('--yes')){
  if(!process.stdin.isTTY)die('Mainnet moves real ADA and USDM: pass --yes to confirm',2);
  console.log('Mainnet: registration and every payment use real ADA/USDM. Your preprod wallet and registration are kept\nand come back when you switch to preprod again.');
  if(await ask('Type "mainnet" to switch: ')!=='mainnet')process.exit(1);
 }
 try{await c.setNetwork(to);}catch(e){die(e.message)}
 console.log(`✔ Network: ${to}. Next: lokal run pay (it creates the ${to} wallet), then restart services.`);process.exit(0);
}
else if(cmd==='wallet'){
 const c=await core();
 if(args[0]==='export'){
  if(!process.stdin.isTTY)die('Run this in an interactive terminal: the recovery phrase is only shown on screen or written to --out',2);
  console.log('The recovery phrase gives full control of the selling wallet. Anyone who sees it can take the funds.');
  if(!/^y/i.test(await ask('Show it now? [y/N] ')))process.exit(1);
  try{
   const w=await c.exportWallet();const out=opt('--out');
   if(out){writeFileSync(out,`${w.address}\n${w.mnemonic}\n`,{mode:0o600});console.log(`✔ Written to ${out} (mode 600)`);}
   else console.log(`\naddress  ${w.address}\nphrase   ${w.mnemonic}\n\nImport it into any Cardano wallet (Eternl, Lace, …) to move your earnings.`);
  }catch(e){die(e.message)}
  process.exit(0);
 }
 const w=await c.wallet();
 console.log(w.address?`address  ${w.address}\nbalance  ${w.balance?`${w.balance.ada} ${w.coin??'ADA'} · ${w.balance.usdm} USDM`:w.error??'unknown'}\nexplorer ${w.explorer}${w.faucet?`\ntest ADA ${w.faucet}`:''}`:'No selling wallet yet: run setup step 4 (lokal run pay).');
 process.exit(0);
}
else if(cmd==='price'){
 const c=await core();const cid=opt('--coworker')??'main';const v=pos.join(' ');
 if(!v){for(const x of c.coworkers())console.log(`${x.id.padEnd(16)} ${String(x.name).padEnd(22)} ${x.price??'1 USDM'} per job`);process.exit(0);}
 try{const p=await c.setPrice(v==='default'?'':v,cid);console.log(`✔ ${cid}: ${p.display} per job${p.own?'':" (the job's default)"}. Paid jobs use it from now on.`);}catch(e){die(e.message)}
 process.exit(0);
}
else if(cmd==='buy'){
 // A real purchase from your own agent (pay/buy.mjs); the way to test the paid path end to end, also on mainnet.
 if(mock)die('lokal buy pays your real agent from your real payment service; it has no mock mode',2);
 const b=await import('../pay/buy.mjs');const {networkOf}=await import('../core/network.mjs');const {readEnv}=await import('../core/config.mjs');
 const text=opt('--file')?readFileSync(opt('--file'),'utf8'):pos.join(' ');
 if(!text.trim())die('usage: lokal buy TEXT | --file FILE [--yes]',2);
 const net=networkOf(readEnv());const p=b.price();
 let w;try{w=await b.buyer()}catch(e){die(e.message)}
 console.log(`network  ${net.name}\nprice    ${p.display}\nbuyer    ${w.address}\n         ${w.balance?`${w.balance.ada} ${w.coin} · ${w.balance.usdm} USDM`:'balance unknown'}`);
 const miss=b.shortfall(w,p);
 if(miss)die(`The purchasing wallet ${miss}. Send that to the address above${net.test?` (test ADA: ${w.faucet})`:''}, then run this again.`);
 if(!flag('--yes')){
  if(!process.stdin.isTTY)die(`Buying locks ${net.test?'test':'REAL'} funds in escrow: pass --yes to confirm`,2);
  if(!/^y/i.test(await ask(`Lock ${p.display}${net.test?' (test funds)':' of REAL money'} in escrow for this job? [y/N] `)))process.exit(1);
 }
 let job;try{job=await b.start(text)}catch(e){die(e.message)}
 console.log(`✔ Job ${job.jobId}: purchase requested, result due by ${new Date(Number(job.submitResultTime)).toLocaleTimeString()}.\n  Following it (Ctrl+C stops following; the purchase goes on):`);
 let last='';const seen=new Set();
 while(Date.now()<Number(job.submitResultTime)+10*60000){
  const s=await b.poll(job);
  for(const t of s.txs)if(!seen.has(t.hash)){seen.add(t.hash);console.log(`  tx ${t.url}`);}
  const line=`  agent: ${s.job} · escrow: ${s.onChain??'not on chain yet'}${s.action?` · buyer: ${s.action}`:''}${s.error?` (${s.error})`:''}`;
  if(line!==last){console.log(line);last=line;}
  if(s.job==='completed'&&s.result!=null){console.log(`\n${s.result}\n\n${s.verified?'✔ the result matches the on-chain resultHash':s.verified===false?'✖ the result does NOT match the on-chain resultHash':'· no on-chain resultHash yet'}`);process.exit(s.verified?0:1);}
  if(s.job==='failed'){console.log(`\n✖ The agent submitted no result (its check failed or the deadline passed), so the seller cannot withdraw.\n  The escrow stays refundable to the purchasing wallet after the result deadline (escrow: ${s.onChain}).`);process.exit(1);}
  await new Promise(r=>setTimeout(r,10000));
 }
 die('Not finished yet. The purchase goes on: see the tx links above or lokal info.');
}
else if(cmd==='set'){
 const ALLOWED=['BLOCKFROST_API_KEY_PREPROD','BLOCKFROST_API_KEY_MAINNET','AGENT_AUTHOR','AGENT_PUBLIC_URL','AGENT_API_HOST'];
 if(!ALLOWED.includes(args[0]))die(`usage: lokal set ${ALLOWED.join('|')}  (value on stdin)`,2);
 const v=await readSecret(args[0]);
 const c=await core();try{await c.setValue(args[0],v)}catch(e){die(e.message)}
 console.log(`✔ ${args[0]} saved to coworker/.env`);process.exit(0);
}
else if(cmd==='sokosumi'){
 // The Sokosumi CLI with lokAl's headless stand-ins on PATH (file vault, captured sign-in links).
 const {setupHeadless,takeOpenedUrl}=await import('../core/vault.mjs');setupHeadless();
 const {spawnSync}=await import('node:child_process');
 const r=spawnSync('sokosumi',args,{stdio:'inherit'});
 const u=takeOpenedUrl();if(u)console.log(`\nOpen on a machine with a browser (tunnel: ssh -N -L 53682:127.0.0.1:53682 this-host):\n${u}`);
 process.exit(r.status??1);
}
else if(cmd==='uninstall'){
 // Same as uninstall.sh: lokal uninstall [--models] [--logout] [--all]
 const {spawnSync}=await import('node:child_process');const {fileURLToPath}=await import('node:url');
 try{await (await import('../core/daemon.mjs')).shutdown()}catch{}
 const script=fileURLToPath(new URL('../uninstall.sh',import.meta.url));
 process.exit(spawnSync('sh',[script,...args],{stdio:'inherit'}).status??1);
}
else if(cmd&&cmd!=='--mock'){console.error(`unknown command: ${cmd}\n\n${HELP}`);process.exit(2);}
else{
 if(!process.stdin.isTTY)die('lokAl needs an interactive terminal. Use `lokal status` for plain output.');
 const c=await core();
 await c.attach?.().catch(()=>{});
 const {start}=await import('../tui/app.mjs');
 const app=start(c);
 await app.finished;
 process.exit(0);
}
