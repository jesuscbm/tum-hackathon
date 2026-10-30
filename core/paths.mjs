import {homedir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdirSync} from 'node:fs';
export const REPO=dirname(dirname(fileURLToPath(import.meta.url)));
export const HOME=process.env.LOKAL_HOME||join(homedir(),'.local','share','lokal');
export const BIN=join(HOME,'bin');
// The Sokosumi Coworker processes (agent, worker, agent API), adapted from the Masumi TUM starter.
export const COWORKER_DIR=process.env.LOKAL_COWORKER_DIR||join(REPO,'coworker');
export const CONFIG=join(HOME,'config.json');
export const LOGS=join(HOME,'logs');
export function ensureDirs(){for(const d of [HOME,BIN,LOGS])mkdirSync(d,{recursive:true,mode:0o700});}
