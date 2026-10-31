import {existsSync,mkdirSync,writeFileSync,rmSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {HOME,LOGS,ensureDirs} from '../core/paths.mjs';
import {run,which} from '../core/exec.mjs';
// The payment service's Postgres, in one of two forms (chosen once, then kept):
//   docker: a postgres:16 container (lokal-mps-db), the default where Docker runs
//   native: a private cluster in $LOKAL_HOME/pgdata run with the machine's own Postgres binaries
//           (Homebrew on macOS: no Docker Desktop needed; postgresql packages on Linux)
// Both listen on 127.0.0.1:55432 with user/database "masumi".
export const DB_NAME=process.env.LOKAL_DB_CONTAINER||'lokal-mps-db';
export const DB_PORT=55432;
// Pinned by digest (multi-arch index of postgres:16.15, 2026-10-31): a re-pushed tag cannot change the database.
export const DB_IMAGE='postgres:16.15@sha256:1beaa3084eee2676f20a9cd9928f0bf2c5bf674f8e49f81017912183d377c61c';
export const DB_VOLUME=`${DB_NAME}-data`; // named, so a removed container can be recreated with its data
export const PGDATA=join(HOME,'pgdata');
const BREW=['/opt/homebrew/opt/postgresql@16/bin','/usr/local/opt/postgresql@16/bin','/opt/homebrew/opt/postgresql@17/bin','/usr/local/opt/postgresql@17/bin','/opt/homebrew/bin','/usr/local/bin','/Applications/Postgres.app/Contents/Versions/latest/bin'];
const DEB=['/usr/lib/postgresql/17/bin','/usr/lib/postgresql/16/bin','/usr/lib/postgresql/15/bin','/usr/pgsql-16/bin'];
let binDir;
// Directory holding initdb + pg_ctl + psql (pg_ctl is often not on PATH: Debian keeps it in /usr/lib/postgresql/N/bin).
export async function nativeBin(){
 if(binDir!==undefined)return binDir;
 const onPath=await which('pg_ctl');
 const dirs=[...(onPath?[onPath.replace(/\/pg_ctl$/,'')]:[]),...(process.platform==='darwin'?BREW:DEB)];
 binDir=dirs.find(d=>['initdb','pg_ctl','psql','pg_isready'].every(b=>existsSync(join(d,b))))??null;
 return binDir;
}
export async function dockerUsable(){return !!await which('docker')&&(await run('docker',['info'],{quiet:true,timeout:20000})).code===0;}
// Which backend to use: the recorded one, else Docker if it runs, else native binaries if present.
export async function pick(recorded){
 if(recorded==='docker'||recorded==='native')return recorded;
 if(process.env.LOKAL_DB==='native'||process.env.LOKAL_DB==='docker')return process.env.LOKAL_DB;
 if(await dockerUsable())return 'docker';
 if(await nativeBin())return 'native';
 return null;
}
export const installHint=()=>process.platform==='darwin'?'brew install postgresql@16 (or install Docker)':'Docker, or your distribution\'s PostgreSQL server (e.g. sudo apt install postgresql)';
const pgEnv=password=>({PGPASSWORD:password,PGCONNECT_TIMEOUT:'5'});
const tcp=['-h','127.0.0.1','-p',String(DB_PORT),'-U','masumi'];
export async function ready(kind,password){
 if(kind==='docker')return (await run('docker',['exec',DB_NAME,'pg_isready','-U','masumi'],{quiet:true,timeout:10000})).code===0;
 const bin=await nativeBin();if(!bin)return false;
 return (await run(join(bin,'pg_isready'),tcp.slice(0,4),{quiet:true,timeout:10000,env:pgEnv(password)})).code===0;
}
async function must(r,what){if(r.code!==0)throw new Error(`${what} failed: ${(r.stderr||r.stdout).trim().split('\n').slice(-3).join(' | ').slice(0,300)}`);return r;}
const LOST='its data (payment wallets, payments) is gone with it. To start over with new wallets: lokal uninstall, then run the installer again.';
// Creates (first time) and starts the database; idempotent. Called by setup, before every service start and by
// lokald's database watch. expectData: the install was set up already, so never create an empty database.
export async function ensureUp(kind,password,{expectData=false}={}){
 if(kind==='docker'){
  const ps=await run('docker',['ps','-a','--filter',`name=^${DB_NAME}$`,'--format','{{.Status}}'],{quiet:true});
  if(!ps.stdout.trim()){
   if(ps.code!==0)throw new Error('Docker is not running: start it, then retry.');
   if(expectData&&(await run('docker',['volume','inspect',DB_VOLUME],{quiet:true})).code!==0)throw new Error(`The database container ${DB_NAME} was deleted, and ${LOST} (A container removed without -v may have left its data in an unnamed volume: docker volume ls.)`);
   await must(await run('docker',['run','-d','--name',DB_NAME,'--restart','unless-stopped','-e','POSTGRES_USER=masumi','-e',`POSTGRES_PASSWORD=${password}`,'-e','POSTGRES_DB=masumi','-p',`127.0.0.1:${DB_PORT}:5432`,'-v',`${DB_VOLUME}:/var/lib/postgresql/data`,DB_IMAGE],{source:'mps',timeout:600000}),'docker run postgres');
  }
  else if(!ps.stdout.startsWith('Up'))await must(await run('docker',['start',DB_NAME],{source:'mps'}),'docker start');
 }else{
  const bin=await nativeBin();if(!bin)throw new Error(`No PostgreSQL found. Install ${installHint()}, then retry.`);
  ensureDirs();
  if(!existsSync(join(PGDATA,'PG_VERSION'))){
   if(expectData)throw new Error(`The database folder ${PGDATA} is missing, and ${LOST}`);
   const pw=join(HOME,'.pgpass-init');writeFileSync(pw,password+'\n',{mode:0o600});
   try{await must(await run(join(bin,'initdb'),['-D',PGDATA,'-U','masumi','-A','scram-sha-256','--pwfile',pw,'-E','UTF8','--no-locale'],{source:'mps',timeout:120000}),'initdb')}
   finally{rmSync(pw,{force:true})}
  }
  if(!(await ready('native',password))){
   // TCP on loopback only, no unix socket (its path length limit trips on deep home folders).
   await must(await run(join(bin,'pg_ctl'),['-D',PGDATA,'-l',join(LOGS,'postgres.log'),'-w','-t','60','-o',`-p ${DB_PORT} -c listen_addresses=127.0.0.1 -c unix_socket_directories=''`,'start'],{source:'mps',timeout:90000}),'pg_ctl start');
  }
 }
 for(let i=0;i<30;i++){if(await ready(kind,password))break;await new Promise(r=>setTimeout(r,1000));if(i===29)throw new Error('Postgres did not become ready');}
 if(kind==='native'){
  const has=await psql(kind,password,`SELECT 1 FROM pg_database WHERE datname='masumi'`,{db:'postgres'});
  if(!has.stdout.trim())await must(await psql(kind,password,'CREATE DATABASE masumi',{db:'postgres'}),'create database');
 }
}
export async function psql(kind,password,sql,{db='masumi',sep}={}){
 const args=['-d',db,'-qAt',...(sep?['-F',sep]:[]),'-c',sql];
 if(kind==='docker')return run('docker',['exec',DB_NAME,'psql','-U','masumi',...args],{quiet:true,timeout:20000});
 const bin=await nativeBin();if(!bin)return {code:127,stdout:'',stderr:'psql not found'};
 return run(join(bin,'psql'),[...tcp,...args],{quiet:true,timeout:20000,env:pgEnv(password)});
}
export async function stop(kind){
 if(kind==='native'&&existsSync(join(PGDATA,'postmaster.pid'))){const bin=await nativeBin();if(bin)await run(join(bin,'pg_ctl'),['-D',PGDATA,'-m','fast','stop'],{quiet:true,timeout:30000});}
}
export const pidOf=()=>{try{return Number(readFileSync(join(PGDATA,'postmaster.pid'),'utf8').split('\n')[0])}catch{return null}};
