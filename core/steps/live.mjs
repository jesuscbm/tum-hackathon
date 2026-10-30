import {readEnv} from '../config.mjs';
import * as services from '../services.mjs';
import * as sk from '../sokosumi.mjs';
import {listJobs} from '../jobs.mjs';
import {loadTemplate,orderedSamples} from '../../templates/index.mjs';
// Step 5: processes up (in lokald, so they outlive this terminal), then a test job sent to yourself.
export const id='live',title="You're live";
export async function status(){
 const svcs=await services.list();const env=readEnv();
 const want=['agent','worker',...(env.PAID_TASKS_ENABLED==='true'?['api']:[])];
 const items=svcs.filter(s=>want.includes(s.id)).map(s=>({label:s.label,status:s.status==='running'?'ok':s.status==='failed'?'fail':'todo',detail:s.status+(s.external?' (started outside lokAl)':'')}));
 const jobs=listJobs(5);
 items.push({label:'First job',status:jobs.length?'ok':'todo',detail:jobs.length?`${jobs[0].status} · ${jobs[0].id.slice(0,8)}`:'send yourself a test job'});
 return {id,title,status:items.every(i=>i.status==='ok')?'ok':'todo',items};
}
export async function run(){await services.startAll();return status();}
export async function sendTestJob(sampleIndex=0,coworker){
 const env=readEnv();const t=loadTemplate(coworker?.template||env.LOKAL_TEMPLATE||'freeform');
 const samples=orderedSamples(t);const sample=samples[sampleIndex%Math.max(samples.length,1)];
 return sk.createTask({coworkerId:coworker?.coworkerId||env.COWORKER_ID,name:`lokAl test: ${t.name}${sample?` · ${sample.name}`:''}`,description:sample?.text??'Say hello and describe what you can do.',organizationSlug:env.SOKOSUMI_ORGANIZATION_SLUG||undefined});
}
