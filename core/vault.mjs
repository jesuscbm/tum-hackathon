import {existsSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {join,delimiter} from 'node:path';
import {spawnSync} from 'node:child_process';
import {HOME} from './paths.mjs';
import {loadConfig,saveConfig} from './config.mjs';
// Headless machines (SSH servers) have no browser and no desktop keyring. The Sokosumi CLI needs both:
// it stores its login and the Coworker runtime key through libsecret's `secret-tool`, and opens URLs with `xdg-open`.
// lokAl puts two small stand-ins first on PATH for itself and every process it starts:
//   secret-tool → files in $LOKAL_HOME/vault (mode 600, same trust level as coworker/.env)
//   xdg-open    → writes the URL to $LOKAL_HOME/open-url so the UI can show it as text and a QR code.
export const SHIM_DIR=join(HOME,'shim');
export const VAULT_DIR=join(HOME,'vault');
export const URL_FILE=join(HOME,'open-url');
export function isHeadless(env=process.env){
 if(env.LOKAL_HEADLESS)return env.LOKAL_HEADLESS!=='0';
 if(env.SSH_CONNECTION||env.SSH_TTY)return true;
 return process.platform==='linux'&&!env.DISPLAY&&!env.WAYLAND_DISPLAY;
}
// libsecret works when a lookup of a missing item exits 1 with nothing on stderr (what the CLI itself probes).
function systemVaultWorks(){
 if(process.platform!=='linux')return true;
 const r=spawnSync('secret-tool',['lookup','service','lokal-probe','account','probe'],{encoding:'utf8',timeout:5000,env:{...process.env,PATH:stripShim(process.env.PATH)}});
 return r.status===1&&!String(r.stderr||'').trim()||r.status===0;
}
const stripShim=p=>String(p??'').split(delimiter).filter(d=>d!==SHIM_DIR).join(delimiter);
const SECRET_TOOL=`#!/bin/sh
# lokAl file vault (stand-in for libsecret's secret-tool on machines without a desktop keyring).
D="${VAULT_DIR}"
cmd="$1"; shift
if [ "$cmd" = store ]; then while [ $# -gt 0 ]; do case "$1" in --label) shift 2 ;; --label=*) shift ;; *) break ;; esac; done; fi
k=$(printf '%s|' "$@" | { sha256sum 2>/dev/null || shasum -a 256; } | cut -c1-64)
case "$cmd" in
 lookup) [ -f "$D/$k" ] || exit 1; cat "$D/$k" ;;
 store) umask 077; mkdir -p "$D"; cat > "$D/$k.tmp" && mv "$D/$k.tmp" "$D/$k" ;;
 clear) rm -f "$D/$k" ;;
 *) echo "unsupported: $cmd" >&2; exit 2 ;;
esac
`;
const XDG_OPEN=`#!/bin/sh
# lokAl: no browser on this machine. Record the URL so lokal can show it (text + QR code).
umask 077; printf '%s\\n' "$1" > "${URL_FILE}"; exit 0
`;
// Called once at startup, before any Sokosumi CLI call. The decision is stored so credentials never "move".
export function setupHeadless(){
 const cfg=loadConfig();
 const headless=isHeadless();
 const vault=process.env.LOKAL_VAULT??cfg.vault??(systemVaultWorks()?'system':'file');
 if(cfg.vault!==vault&&!process.env.LOKAL_VAULT)saveConfig({vault});
 const shims=[];
 if(vault==='file')shims.push(['secret-tool',SECRET_TOOL]);
 if(headless)shims.push(['xdg-open',XDG_OPEN],['open',XDG_OPEN]);
 if(shims.length){
  mkdirSync(SHIM_DIR,{recursive:true,mode:0o700});
  for(const [name,body] of shims){const f=join(SHIM_DIR,name);if(!existsSync(f)||readFileSync(f,'utf8')!==body)writeFileSync(f,body,{mode:0o700});}
  for(const name of ['secret-tool','xdg-open','open'])if(!shims.some(s=>s[0]===name))rmSync(join(SHIM_DIR,name),{force:true});
  process.env.PATH=[SHIM_DIR,stripShim(process.env.PATH)].join(delimiter);
 }
 return {headless,vault};
}
// Latest URL the CLI tried to open (headless only), then forget it.
export function takeOpenedUrl(){try{const u=readFileSync(URL_FILE,'utf8').trim();rmSync(URL_FILE,{force:true});return u||null}catch{return null}}
