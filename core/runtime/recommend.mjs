import {readFileSync} from 'node:fs';
export const MODELS=JSON.parse(readFileSync(new URL('./models.json',import.meta.url),'utf8'));
// Largest catalog model that fits: on the GPU when its VRAM is enough, else in RAM with headroom for the OS.
// Models that list minVramGB are only recommended with such a GPU (on a CPU they answer too slowly for escrow deadlines).
export function recommend(hw){
 const vram=hw.gpu?.vramGB??0,ram=hw.ramGB??8;
 const onGpu=m=>!!m.minVramGB&&vram>=m.minVramGB;
 const fits=m=>onGpu(m)||ram>=m.minRamGB;
 const good=MODELS.filter(m=>fits(m)&&(!m.minVramGB||onGpu(m)));
 const pick=good.at(-1)??MODELS[0];
 // Prefer a Llama for the default story when it is as large as the pick.
 const llama=good.filter(m=>m.family==='llama'&&m.sizeGB>=pick.sizeGB*0.9).at(-1);
 return {model:llama??pick,reason:hw.gpu?.vramGB?`${hw.gpu.name} with ${hw.gpu.vramGB} GB VRAM`:`${ram} GB RAM, CPU inference`,options:MODELS.map(m=>({...m,fits:fits(m),gpu:onGpu(m)}))};
}
