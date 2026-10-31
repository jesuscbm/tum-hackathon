# lokal demo: voice-over script

Read each line inside its time window; the narrator's mouth moves only inside it, so finishing a little early is fine.
Record each line as its own take and line it up at the start time.
Lines in the live demo slot (0:20.0–1:50.0) are timed to public/live-demo.mp4.

| # | Start | End | Scene | Mood | Line | Words |
|---|---|---|---|---|---|---|
| 1 | 0:00.8 | 0:05.8 | intro | happy | Hey! My laptop runs an open AI model, like millions of others. | 12 |
| 2 | 0:06.1 | 0:11.7 | intro | normal | And teams have small AI jobs they'd pay for, if the result is good. | 14 |
| 3 | 0:12.2 | 0:19.5 | chaos | stressed | But selling on Cardano means Masumi, Sokosumi, Blockfrost, wallets, a database... Twenty hours in, still not paid. | 17 |
| 4 | 0:20.5 | 0:26.5 | demo | happy | So I built lokAl. One curl line, and it installs itself. | 11 |
| 5 | 0:27.3 | 0:39.3 | demo | normal | Step one looks at my hardware and picks a model that fits, Llama 3.2. It installs Ollama for me, no sudo needed. | 22 |
| 6 | 0:40.3 | 0:54.3 | demo | normal | Step two is the job. I write my own prompt, cheer the user up, and try it right away. This one has no check, so buyers don't get the pay-only-if-it-passes guarantee. | 31 |
| 7 | 0:55.3 | 1:03.3 | demo | normal | Step three signs into Sokosumi and creates my Coworker. | 9 |
| 8 | 1:04.3 | 1:19.3 | demo | normal | Step four sets up my own Masumi payment service, gets test ADA from the faucet and registers my agent on Cardano. That part takes a few minutes. | 27 |
| 9 | 1:20.3 | 1:29.3 | demo | happy | Now I'm live. On Sokosumi, I give my agent a task, like any buyer would. | 15 |
| 10 | 1:30.0 | 1:39.3 | demo | normal | The buyer locks one test USDM in escrow, and my model answers right here on my laptop. | 17 |
| 11 | 1:40.0 | 1:49.3 | demo | happy | The answer shows up on Sokosumi, and its hash goes on-chain. The money waits in escrow until I withdraw it. | 20 |
| 12 | 1:50.5 | 1:59.5 | proof | normal | Here's an earlier paid job on Cardanoscan. Registration, locked funds, my result, and the withdrawal to my wallet. | 18 |
| 13 | 2:00.2 | 2:09.5 | proof | normal | I never held the buyer's money. It sat in Masumi's escrow contract, right next to my result hash. | 18 |
| 14 | 2:10.2 | 2:19.5 | proof | happy | Anyone can check my result against that hash. If I lie and claim a bigger model, it fails. | 18 |
| 15 | 2:20.4 | 2:29.7 | outro | wink | Next up: mainnet, more jobs, and other agents hiring local ones. That's lokAl. Thanks for watching! | 16 |

To change a line or its timing, edit `src/script.mjs` and run `npm run script` again.
