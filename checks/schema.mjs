// Minimal JSON-schema subset validator. validate(schema, value) → list of error messages.
const typeOf=v=>v===null?'null':Array.isArray(v)?'array':Number.isInteger(v)?'integer':typeof v;
const matches=(t,v)=>{const a=typeOf(v);return t===a||(t==='number'&&a==='integer')};
export function validate(schema,value,path='$'){
 const errors=[];
 if(!schema||typeof schema!=='object')return errors;
 if(schema.type!==undefined){
  const types=Array.isArray(schema.type)?schema.type:[schema.type];
  if(!types.some(t=>matches(t,value))){errors.push(`${path}: expected ${types.join(' or ')}, got ${typeOf(value)}`);return errors;}
 }
 if(schema.enum&&!schema.enum.some(e=>JSON.stringify(e)===JSON.stringify(value)))errors.push(`${path}: must be one of ${schema.enum.map(e=>JSON.stringify(e)).join(', ')}`);
 if(typeof value==='number'){
  if(schema.minimum!==undefined&&value<schema.minimum)errors.push(`${path}: must be >= ${schema.minimum}`);
  if(schema.maximum!==undefined&&value>schema.maximum)errors.push(`${path}: must be <= ${schema.maximum}`);
 }
 if(typeof value==='string'){
  if(schema.minLength!==undefined&&value.length<schema.minLength)errors.push(`${path}: shorter than ${schema.minLength} characters`);
  if(schema.maxLength!==undefined&&value.length>schema.maxLength)errors.push(`${path}: longer than ${schema.maxLength} characters`);
  if(schema.pattern!==undefined&&!new RegExp(schema.pattern,'u').test(value))errors.push(`${path}: does not match /${schema.pattern}/`);
 }
 if(Array.isArray(value)){
  if(schema.minItems!==undefined&&value.length<schema.minItems)errors.push(`${path}: needs at least ${schema.minItems} items`);
  if(schema.maxItems!==undefined&&value.length>schema.maxItems)errors.push(`${path}: needs at most ${schema.maxItems} items`);
  if(schema.items)value.forEach((item,i)=>errors.push(...validate(schema.items,item,`${path}[${i}]`)));
 }
 if(typeOf(value)==='object'){
  for(const key of schema.required??[])if(!(key in value))errors.push(`${path}: missing required field "${key}"`);
  const props=schema.properties??{};
  for(const [key,sub] of Object.entries(props))if(key in value)errors.push(...validate(sub,value[key],`${path}.${key}`));
  if(schema.additionalProperties===false)for(const key of Object.keys(value))if(!(key in props))errors.push(`${path}: unexpected field "${key}"`);
 }
 return errors;
}
