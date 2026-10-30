// Deterministic result checks. check() never throws on model output, only on a broken config.
import {extractJson} from './json.mjs';
import {validate} from './schema.mjs';
import {checkInvoice} from './invoice.mjs';
export {extractJson} from './json.mjs';
export {validate} from './schema.mjs';
export {invoiceSchema,checkInvoice} from './invoice.mjs';
export const CHECK_TYPES=[
 {type:'none',label:'No check',description:'Any answer is accepted. No payment guarantee for the buyer.'},
 {type:'json',label:'Valid JSON',description:'The answer must contain one valid JSON object or array.'},
 {type:'schema',label:'JSON schema',description:'The answer must be JSON matching a schema you provide.'},
 {type:'regex',label:'Regex',description:'The answer must match a regular expression.'},
 {type:'length',label:'Length range',description:'The answer must be between min and max characters.'},
 {type:'invoice',label:'Invoice',description:'Invoice JSON schema, and line items + tax must add up to the total (± 0.01).'}
];
const TYPES=new Set(CHECK_TYPES.map(t=>t.type));
function assertConfig(config){
 if(!config||!TYPES.has(config.type))throw new Error(`Unknown check type: ${config?.type}`);
 if(config.type==='schema'&&(typeof config.schema!=='object'||config.schema===null))throw new Error('schema check needs a schema object');
 if(config.type==='regex'){if(typeof config.pattern!=='string')throw new Error('regex check needs a pattern');new RegExp(config.pattern,config.flags??'');}
 if(config.type==='length'&&config.min===undefined&&config.max===undefined)throw new Error('length check needs min or max');
}
const result=(type,reasons,value)=>({pass:reasons.length===0,type,reasons,...(value!==undefined?{value}:{})});
export function check(config,input,output){
 assertConfig(config);
 const {type}=config;
 if(type==='none')return {pass:true,type,reasons:['no check configured']};
 if(typeof output!=='string'||!output.trim())return result(type,['empty output']);
 if(type==='regex')return result(type,new RegExp(config.pattern,config.flags??'').test(output)?[]:[`output does not match /${config.pattern}/${config.flags??''}`]);
 if(type==='length'){
  const n=output.length,reasons=[];
  if(config.min!==undefined&&n<config.min)reasons.push(`output has ${n} characters, minimum is ${config.min}`);
  if(config.max!==undefined&&n>config.max)reasons.push(`output has ${n} characters, maximum is ${config.max}`);
  return result(type,reasons);
 }
 const parsed=extractJson(output);
 if(!parsed.ok)return result(type,[`not JSON: ${parsed.error}`]);
 if(type==='json')return result(type,[],parsed.value);
 if(type==='schema')return result(type,validate(config.schema,parsed.value),parsed.value);
 return result(type,checkInvoice(parsed.value),parsed.value);
}
