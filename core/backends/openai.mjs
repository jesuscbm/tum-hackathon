// Minimal OpenAI-compatible chat client (Ollama, llama.cpp, LM Studio, vLLM, cloud).
export async function* streamChat({baseURL,apiKey='lokal',model,system,user,json=false,timeout=600000}){
 const res=await fetch(baseURL.replace(/\/$/,'')+'/chat/completions',{method:'POST',signal:AbortSignal.timeout(timeout),
  headers:{'content-type':'application/json',authorization:`Bearer ${apiKey}`},
  body:JSON.stringify({model,stream:true,temperature:0,messages:[...(system?[{role:'system',content:system}]:[]),{role:'user',content:user}],...(json?{response_format:{type:'json_object'}}:{})})});
 if(!res.ok)throw new Error(`Model endpoint HTTP ${res.status}: ${(await res.text()).slice(0,200)}`);
 let buf='';const dec=new TextDecoder();
 for await(const chunk of res.body){
  buf+=dec.decode(chunk,{stream:true});let i;
  while((i=buf.indexOf('\n'))>=0){
   const line=buf.slice(0,i).trim();buf=buf.slice(i+1);
   if(!line.startsWith('data:'))continue;const data=line.slice(5).trim();if(data==='[DONE]')return;
   const delta=JSON.parse(data).choices?.[0]?.delta?.content;if(delta)yield delta;
  }
 }
}
export async function chat(opts){let out='';for await(const d of streamChat(opts))out+=d;return out;}
export async function listModels({baseURL,apiKey='lokal'}){
 const r=await fetch(baseURL.replace(/\/$/,'')+'/models',{headers:{authorization:`Bearer ${apiKey}`},signal:AbortSignal.timeout(5000)});
 if(!r.ok)throw new Error(`HTTP ${r.status}`);return (await r.json()).data?.map(m=>m.id)??[];
}
