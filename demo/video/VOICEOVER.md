# lokal demo: voice-over script

Read each line inside its time window; the narrator's mouth moves only inside it, so finishing a little early is fine.
Record each line as its own take and line it up at the start time.
Lines in the live demo slot (0:20.0–1:50.0) are suggestions: rewrite them to match the recording, keeping roughly the same windows.

| # | Start | End | Scene | Mood | Line | Words |
|---|---|---|---|---|---|---|
| 1 | 0:00.8 | 0:05.8 | intro | happy | Hi! My laptop runs an open AI model, like millions of others. | 12 |
| 2 | 0:06.1 | 0:11.7 | intro | normal | Teams need small AI jobs done, and want to pay only for good results. | 14 |
| 3 | 0:12.2 | 0:19.5 | chaos | stressed | But selling on Cardano means Masumi, Sokosumi, Blockfrost, wallets, keys and a database. Twenty hours later: not paid. | 18 |
| 4 | 0:20.5 | 0:28.5 | demo | happy | lokAl fixes that with one command. A fresh laptop: paste the curl line, then type lokAl. | 16 |
| 5 | 0:29.2 | 0:38.5 | demo | normal | Step one checks my hardware, installs Ollama and pulls Llama 3.2. Everything runs locally. | 14 |
| 6 | 0:39.2 | 0:48.5 | demo | normal | Step two: I pick the invoice-to-JSON job. It comes with a check, and I try it on samples. | 18 |
| 7 | 0:49.2 | 0:58.5 | demo | normal | Step three connects my Sokosumi account and creates my Coworker. | 10 |
| 8 | 0:59.2 | 1:08.5 | demo | normal | Step four installs my own Masumi payment service, gets test ADA and registers the agent on Cardano. | 17 |
| 9 | 1:09.2 | 1:18.5 | demo | happy | I'm live. A buyer hires my agent on Sokosumi and locks one USDM in the escrow. | 16 |
| 10 | 1:19.2 | 1:28.5 | demo | normal | My model answers right here. The check passes, so the result hash goes on-chain. | 14 |
| 11 | 1:29.2 | 1:38.5 | demo | normal | Had it failed, nothing would be submitted, and the buyer could take the money back. | 15 |
| 12 | 1:39.2 | 1:49.3 | demo | happy | Escrow released: paid. One curl command to a paid job. | 10 |
| 13 | 1:50.5 | 1:59.5 | proof | normal | The proof is on Cardanoscan: agent registered, funds locked, result submitted, and withdrawn to my wallet. | 16 |
| 14 | 2:00.2 | 2:09.5 | proof | normal | The money never sat with me. It waited in Masumi's escrow contract, next to my result hash. | 17 |
| 15 | 2:10.2 | 2:19.5 | proof | happy | Tamper test: the result matches the on-chain hash. Claim a bigger model, and verification fails. | 15 |
| 16 | 2:20.4 | 2:29.7 | outro | wink | Next: mainnet, more jobs, and agents hiring local agents. lokAl: your model, paid, with one command. | 16 |

To change a line or its timing, edit `src/script.mjs` and run `npm run script` again.
