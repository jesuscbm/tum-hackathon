// Pull one JSON value out of model output: whole text, a ``` fence, or the first balanced {...}/[...] block.
function tryParse(text){try{return {ok:true,value:JSON.parse(text)}}catch(e){return {ok:false,error:e.message}}}
function firstBalanced(text){
 const start=text.search(/[[{]/u);if(start<0)return null;
 const stack=[];let inString=false,escaped=false;
 for(let i=start;i<text.length;i++){
  const c=text[i];
  if(inString){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')inString=false;continue;}
  if(c==='"')inString=true;
  else if(c==='{'||c==='[')stack.push(c==='{'?'}':']');
  else if(c==='}'||c===']'){if(stack.pop()!==c)return null;if(!stack.length)return text.slice(start,i+1);}
 }
 return null;
}
export function extractJson(text){
 if(typeof text!=='string'||!text.trim())return {ok:false,error:'empty output'};
 const trimmed=text.trim();
 const whole=tryParse(trimmed);if(whole.ok)return whole;
 const fence=trimmed.match(/```(?:json|JSON)?\s*\n?([\s\S]*?)```/u);
 if(fence){const parsed=tryParse(fence[1].trim());if(parsed.ok)return parsed;}
 const block=firstBalanced(trimmed);
 if(block){const parsed=tryParse(block);if(parsed.ok)return parsed;return {ok:false,error:`invalid JSON: ${parsed.error}`};}
 return {ok:false,error:'no JSON object or array found'};
}
