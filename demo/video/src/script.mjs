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
 ['intro',24,174,'happy','Hey! My laptop runs an open AI model, like millions of others.'],
 ['intro',182,352,'normal',"And teams have small AI jobs they'd pay for, if the result is good."],
 ['chaos',6,226,'stressed','But selling on Cardano means Masumi, Sokosumi, Blockfrost, wallets, a database... Twenty hours in, still not paid.'],
 // Live demo slot, timed to public/live-demo.mp4 (25 min recording cut to 90 s). The narrator's mouth follows these windows.
 ['demo',15,195,'happy','So I built lokAl. One curl line, and it installs itself.'],
 ['demo',220,580,'normal','Step one looks at my hardware and picks a model that fits, Llama 3.2. It installs Ollama for me, no sudo needed.'],
 ['demo',610,1030,'normal',"Step two is the job. I write my own prompt, cheer the user up, and try it right away. This one has no check, so buyers don't get the pay-only-if-it-passes guarantee."],
 ['demo',1060,1300,'normal','Step three signs into Sokosumi and creates my Coworker.'],
 ['demo',1330,1780,'normal','Step four sets up my own Masumi payment service, gets test ADA from the faucet and registers my agent on Cardano. That part takes a few minutes.'],
 ['demo',1810,2080,'happy',"Now I'm live. On Sokosumi, I give my agent a task, like any buyer would."],
 ['demo',2100,2380,'normal','The buyer locks one test USDM in escrow, and my model answers right here on my laptop.'],
 ['demo',2400,2680,'happy','The answer shows up on Sokosumi, and its hash goes on-chain. The money waits in escrow until I withdraw it.'],
 ['proof',15,285,'normal',"Here's an earlier paid job on Cardanoscan. Registration, locked funds, my result, and the withdrawal to my wallet."],
 ['proof',305,585,'normal',"I never held the buyer's money. It sat in Masumi's escrow contract, right next to my result hash."],
 ['proof',605,885,'happy','Anyone can check my result against that hash. If I lie and claim a bigger model, it fails.'],
 ['outro',12,290,'wink',"Next up: mainnet, more jobs, and other agents hiring local ones. That's lokAl. Thanks for watching!"],
];
export const LINES=SCRIPT.map(([scene,from,to,mood,text])=>({scene,from:SCENES[scene][0]+from,to:SCENES[scene][0]+to,mood,text}));
export const lineAt=f=>LINES.find(l=>f>=l.from&&f<l.to);

// Chapter rail next to the live demo, frames relative to the demo start. Move them to match the recording.
export const CHAPTERS=[[0,'install'],[210,'1 machine & model'],[600,'2 job'],[1050,'3 Sokosumi'],[1320,'4 payments'],[1800,'5 paid job']];

export const INSTALL='curl -fsSL https://raw.githubusercontent.com/jesuscbm/lokAl/main/install.sh | sh';
