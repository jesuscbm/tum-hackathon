// Single source of truth for timing: scenes and voice-over lines (they drive the narrator's mouth and mood).
// Plain JS so scripts/vo-script.mjs can print the voice-over sheet from it.
export const FPS=30,W=1920,H=1080;

// Scene order = playback order; each scene keeps its length if you move it. `demo` is the 60 s live-demo slot.
const ORDER=[['intro',240],['chaos',480],['command',300],['wizard',660],['flow',480],['gate',330],['demo',1800],['outro',210]];
export const SCENES={};
let t=0;for(const [id,len] of ORDER){SCENES[id]=[t,t+len];t+=len}
export const DURATION=t;

// Frames are relative to the start of the scene.
const SCRIPT=[
 ['intro',30,225,'happy',"Hi! I run an AI model on my own laptop, and I'd love to get paid for its work."],
 ['chaos',15,240,'stressed','But getting paid means Masumi, Sokosumi, x402, Blockfrost and Cardano. Wallets, keys, databases...'],
 ['chaos',250,465,'stressed',"That's a dozen manual steps. Twenty hours later, I still haven't been paid."],
 ['command',15,285,'happy','lokAl makes it one command. Paste it, type lokAl, and a friendly terminal walks you through the rest.'],
 ['wizard',15,300,'normal','It checks your hardware, installs Ollama and downloads a model that fits. Then you pick a job.'],
 ['wizard',310,645,'happy',"It connects Sokosumi, sets up your Masumi wallet with Blockfrost and registers you on Cardano. You're live!"],
 ['flow',15,240,'normal','A buyer hires my agent on Sokosumi. The payment is locked in Masumi escrow on Cardano.'],
 ['flow',250,470,'normal','My model does the work right here on my laptop. Then a check runs before anyone gets paid.'],
 ['gate',15,160,'happy','Pass, and the result hash goes on-chain. I get paid.'],
 ['gate',170,320,'normal',"Fail, and nothing is submitted, so the buyer isn't charged. And the hash proves which model did the work."],
 // Live demo slot: suggested narration, rewrite it to match the recording. The narrator's mouth follows these windows.
 ['demo',15,270,'happy',"Here's the real thing: a fresh laptop and one curl command."],
 ['demo',290,570,'normal','lokAl checks my hardware, installs Ollama and pulls Llama 3.2. Everything runs locally.'],
 ['demo',590,870,'normal','I pick the invoice-to-JSON job and try a sample. The check passes.'],
 ['demo',890,1170,'normal','Sokosumi and my own Masumi payment service get wired up, and the agent is registered on Cardano preprod.'],
 ['demo',1190,1470,'happy','Now a buyer sends a paid job: escrow locked, answered, check passed, paid.'],
 ['demo',1490,1770,'happy','And here is the transaction on Cardanoscan. Twenty hours of setup, now one command.'],
 ['outro',20,190,'wink','lokAl. Your model, paid, with one command.'],
];
export const LINES=SCRIPT.map(([scene,from,to,mood,text])=>({scene,from:SCENES[scene][0]+from,to:SCENES[scene][0]+to,mood,text}));
export const lineAt=f=>LINES.find(l=>f>=l.from&&f<l.to);

export const INSTALL='curl -fsSL https://raw.githubusercontent.com/jesuscbm/lokAl/main/install.sh | sh';
