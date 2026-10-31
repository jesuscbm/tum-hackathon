// Single source of truth for timing: scenes and voice-over lines (they drive the narrator's mouth and mood).
// Plain JS so scripts/vo-script.mjs can print the voice-over sheet from it.
export const FPS=30,W=1920,H=1080;

// Scene order = playback order; each scene keeps its length if you move it.
// 0:00 who + problem · 0:20 live demo (90 s slot) · 1:50 proof on Cardano · 2:20 what's next.
// command, wizard, flow and gate (src/scenes) are animated cutaways you can put back in here.
const ORDER=[['intro',360],['chaos',240],['demo',2700],['proof',900],['outro',300]];
export const SCENES={};
let t=0;for(const [id,len] of ORDER){SCENES[id]=[t,t+len];t+=len}
export const DURATION=t;

// Frames are relative to the start of the scene.
const SCRIPT=[
 ['intro',24,174,'happy','Hi! My laptop runs an open AI model, like millions of others.'],
 ['intro',182,352,'normal','Teams need small AI jobs done, and want to pay only for good results.'],
 ['chaos',6,226,'stressed','But selling on Cardano means Masumi, Sokosumi, Blockfrost, wallets, keys and a database. Twenty hours later: not paid.'],
 // Live demo slot: suggested narration, rewrite it to match the recording. The narrator's mouth follows these windows.
 ['demo',15,255,'happy','lokAl fixes that with one command. A fresh laptop: paste the curl line, then type lokAl.'],
 ['demo',275,555,'normal','Step one checks my hardware, installs Ollama and pulls Llama 3.2. Everything runs locally.'],
 ['demo',575,855,'normal','Step two: I pick the invoice-to-JSON job. It comes with a check, and I try it on samples.'],
 ['demo',875,1155,'normal','Step three connects my Sokosumi account and creates my Coworker.'],
 ['demo',1175,1455,'normal','Step four installs my own Masumi payment service, gets test ADA and registers the agent on Cardano.'],
 ['demo',1475,1755,'happy',"I'm live. A buyer hires my agent on Sokosumi and locks one USDM in the escrow."],
 ['demo',1775,2055,'normal','My model answers right here. The check passes, so the result hash goes on-chain.'],
 ['demo',2075,2355,'normal','Had it failed, nothing would be submitted, and the buyer could take the money back.'],
 ['demo',2375,2680,'happy','Escrow released: paid. One curl command to a paid job.'],
 ['proof',15,285,'normal','The proof is on Cardanoscan: agent registered, funds locked, result submitted, and withdrawn to my wallet.'],
 ['proof',305,585,'normal',"The money never sat with me. It waited in Masumi's escrow contract, next to my result hash."],
 ['proof',605,885,'happy','Tamper test: the result matches the on-chain hash. Claim a bigger model, and verification fails.'],
 ['outro',12,290,'wink','Next: mainnet, more jobs, and agents hiring local agents. lokAl: your model, paid, with one command.'],
];
export const LINES=SCRIPT.map(([scene,from,to,mood,text])=>({scene,from:SCENES[scene][0]+from,to:SCENES[scene][0]+to,mood,text}));
export const lineAt=f=>LINES.find(l=>f>=l.from&&f<l.to);

// Chapter rail next to the live demo, frames relative to the demo start. Move them to match the recording.
export const CHAPTERS=[[0,'install'],[275,'1 machine & model'],[575,'2 job + check'],[875,'3 Sokosumi'],[1175,'4 payments'],[1475,'5 paid job']];

export const INSTALL='curl -fsSL https://raw.githubusercontent.com/jesuscbm/lokAl/main/install.sh | sh';
