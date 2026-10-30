import {readFileSync} from 'node:fs';
export const MODELS=JSON.parse(readFileSync(new URL('./models.json',import.meta.url),'utf8'));
// Largest catalog model that fits: VRAM if a GPU is known, else RAM with headroom for the OS.
export function recommend(hw){
 const vram=hw.gpu?.vramGB??0,ram=hw.ramGB??8;
 const fits=m=>(m.minVramGB&&vram>=m.minVramGB)||ram>=m.minRamGB;
 const ok=MODELS.filter(fits).filter(m=>m.minRamGB<=Math.max(ram,vram*2));
 const pick=ok.filter(m=>!m.minVramGB||vram>=m.minVramGB).at(-1)??MODELS[0];
 // Prefer a Llama for the default story when it is as large as the pick.
 const llama=ok.filter(m=>m.family==='llama'&&m.sizeGB>=pick.sizeGB*0.9&&(!m.minVramGB||vram>=m.minVramGB)).at(-1);
 return {model:llama??pick,reason:hw.gpu?.vramGB?`${hw.gpu.name} with ${hw.gpu.vramGB} GB VRAM`:`${ram} GB RAM, CPU inference`,options:MODELS.map(m=>({...m,fits:fits(m)}))};
}
