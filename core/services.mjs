import * as sup from './supervisor.mjs';
import * as daemon from './daemon.mjs';
// Service control for the UI and CLI: everything goes through lokald (started on demand), so services keep
// running after the UI exits. Without lokald, listing falls back to probing the ports and lock files.
export async function list(){const s=await daemon.status();if(s.running)try{return await daemon.call('/services')}catch{}return sup.refresh();}
export async function startAll(){await daemon.ensure();return daemon.call('/start',{method:'POST',body:{},timeout:180000});}
export async function start(id){await daemon.ensure();return daemon.call('/start',{method:'POST',body:{id},timeout:180000});}
export async function stopAll(){if((await daemon.status()).running)return daemon.call('/stop',{method:'POST',body:{},timeout:60000});return sup.stopAll();}
export async function stopCoworker(cid){if((await daemon.status()).running)return daemon.call('/stop',{method:'POST',body:{coworker:cid},timeout:60000});return sup.stopCoworker(cid);}
// A lokald that was not running starts everything by itself; restarting on top of that would only bounce it.
export async function restart(id){const was=(await daemon.status()).running;await daemon.ensure();if(!was&&!id)return list();return daemon.call('/restart',{method:'POST',body:id?{id}:{},timeout:180000});}
