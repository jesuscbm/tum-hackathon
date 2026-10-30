#!/usr/bin/env node
import {readFileSync,rmSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {homedir} from 'node:os';
const [cmd,...args]=process.argv.slice(2);
const mock=process.env.LOKAL_MOCK==='1'||args.includes('--mock')||cmd==='--mock';
const HELP=`lokal: your local LLM, hired and paid on Cardano

  lokal              open the setup wizard / dashboard (terminal UI)
  lokal status       print every setup step without the UI (works over SSH, in CI)
  lokal up           start all services headless and stream logs
  lokal run STEP     run one setup step headless (machine, job [id], sokosumi, pay, live)
  lokal set NAME     save BLOCKFROST_API_KEY_PREPROD or AGENT_AUTHOR (value on stdin)
  lokal doctor       one line per layer: model, agent, worker, Sokosumi, payments
  lokal verify FILE [HASH]
                     check a result's canonical JSON against an on-chain resultHash
  lokal uninstall    remove ~/.local/share/lokal and the lokal command
  --mock             fake backend, for demos and UI work`;
async function core(){return mock?(await import('../core/mock.mjs')).createMockCore():(await import('../core/index.mjs')).createCore();}
const ICON={ok:'✔',todo:'○',action:'➜',input:'✎',fail:'✖',warn:'!',running:'◐',off:'·'};

if(cmd==='help'||cmd==='--help'||cmd==='-h'){console.log(HELP);}
else if(cmd==='status'){
 const c=await core();
 for(const s of await c.statusAll()){
  console.log(`\n${ICON[s.status]??'○'} ${s.title}${s.error?`  (${s.error})`:''}`);
  for(const i of s.items??[])console.log(`   ${ICON[i.status]??'○'} ${i.label.padEnd(18)} ${i.detail}${i.command?`\n     → ${i.command}`:''}`);
 }
 process.exit(0);
}
else if(cmd==='doctor'){
 const c=await core();
 for(const h of await c.health())console.log(`${ICON[h.status]} ${h.label.padEnd(10)} ${h.status==='fail'?h.fix:h.status==='off'?'not enabled':'ok'}`);
 process.exit(0);
}
else if(cmd==='verify'){
 const {verifyResult,resultHash}=await import('../provenance.mjs');
 if(!args[0]){console.error('usage: lokal verify FILE [HASH]');process.exit(2);}
 const text=readFileSync(args[0],'utf8').replace(/\n$/,'');
 if(!args[1]){console.log(resultHash(text));process.exit(0);}
 const r=verifyResult(text,args[1]);
 if(r.ok){const p=r.parsed;console.log(`✔ hash matches\n  model   ${p.model}\n  weights ${p.digest??'unverified'}\n  prompt  ${p.promptHash}\n  check   ${p.check?.type}: ${p.check?.pass?'passed':'failed'}`);process.exit(0);}
 console.log(`✖ ${r.reason??'hash does not match'}`);process.exit(1);
}
else if(cmd==='up'){
 // Headless: start every service and stream logs (servers, SSH, tmux). Ctrl+C stops what lokal started.
 const c=await core();
 c.bus.on('log',e=>console.log(`[${e.source}] ${e.line}`));
 c.bus.on('services',s=>console.log('services: '+s.map(x=>`${x.id}=${x.status}${x.external?'(external)':''}`).join(' ')));
 await c.startServices();
 const stop=async()=>{await c.stopServices();process.exit(0)};
 process.on('SIGINT',stop);process.on('SIGTERM',stop);
 setInterval(()=>{},1<<30);
}
else if(cmd==='run'){
 // Headless step runner: lokal run machine|job|sokosumi|pay|live  (prints the step status afterwards)
 const c=await core();c.bus.on('log',e=>console.log(`[${e.source}] ${e.line}`));
 let last='';c.bus.on('progress',e=>{if(e.label!==last){last=e.label;console.log('…',e.label)}});
 if(args[0]==='job'&&args[1])await c.selectTemplate(args[1]);
 const s=args[0]==='pay'?await c.runPay():await c.runStep(args[0]);
 const st=await c.status(args[0]);
 console.log(`\n${ICON[st.status]??'○'} ${st.title}${s?.error?`  (${s.error})`:''}`);for(const i of st.items??[])console.log(`   ${ICON[i.status]??'○'} ${i.label.padEnd(18)} ${i.detail}`);
 process.exit(s?.error?1:0);
}
else if(cmd==='set'){
 // lokal set BLOCKFROST_API_KEY_PREPROD   (value read from stdin so it stays out of shell history)
 const ALLOWED=['BLOCKFROST_API_KEY_PREPROD','AGENT_AUTHOR'];
 if(!ALLOWED.includes(args[0])){console.error(`usage: lokal set ${ALLOWED.join('|')}  (value on stdin)`);process.exit(2);}
 let v='';
 if(process.stdin.isTTY){process.stdout.write(`${args[0]}: `);process.stdin.setRawMode(true);for await(const ch of process.stdin){const c=String(ch);if(c==='\r'||c==='\n')break;if(c==='\u0003')process.exit(130);v+=c;}process.stdin.setRawMode(false);process.stdout.write('\n');}
 else for await(const ch of process.stdin)v+=ch;
 const {writeEnv}=await import('../core/config.mjs');writeEnv({[args[0]]:v.trim()});console.log(`✔ ${args[0]} saved to coworker/.env`);process.exit(0);
}
else if(cmd==='uninstall'){
 const home=process.env.LOKAL_HOME||join(homedir(),'.local','share','lokal');
 for(const p of [home,join(homedir(),'.local','bin','lokal')])if(existsSync(p)){rmSync(p,{recursive:true,force:true});console.log('removed',p);}
 console.log('Sokosumi account, Coworker and on-chain records are not touched.');
}
else if(cmd&&cmd!=='--mock'){console.error(`unknown command: ${cmd}\n\n${HELP}`);process.exit(2);}
else{
 if(!process.stdin.isTTY){console.error('lokal needs an interactive terminal. Use `lokal status` for plain output.');process.exit(1);}
 const {start}=await import('../tui/app.mjs');
 const app=start(await core());
 await app.waitUntilExit();
 process.exit(0);
}
