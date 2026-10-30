# lokal demo: voice-over script

Read each line inside its time window; the narrator's mouth moves only inside it, so finishing a little early is fine.
Record each line as its own take and line it up at the start time.
Lines in the live demo slot (1:23.0–2:23.0) are suggestions: rewrite them to match the recording, keeping roughly the same windows.

| # | Start | End | Scene | Mood | Line | Words |
|---|---|---|---|---|---|---|
| 1 | 0:01.0 | 0:07.5 | intro | happy | Hi! I run an AI model on my own laptop, and I'd love to get paid for its work. | 19 |
| 2 | 0:08.5 | 0:16.0 | chaos | stressed | But getting paid means Masumi, Sokosumi, x402, Blockfrost and Cardano. Wallets, keys, databases... | 13 |
| 3 | 0:16.3 | 0:23.5 | chaos | stressed | That's a dozen manual steps. Twenty hours later, I still haven't been paid. | 13 |
| 4 | 0:24.5 | 0:33.5 | command | happy | lokAl makes it one command. Paste it, type lokAl, and a friendly terminal walks you through the rest. | 18 |
| 5 | 0:34.5 | 0:44.0 | wizard | normal | It checks your hardware, installs Ollama and downloads a model that fits. Then you pick a job. | 17 |
| 6 | 0:44.3 | 0:55.5 | wizard | happy | It connects Sokosumi, sets up your Masumi wallet with Blockfrost and registers you on Cardano. You're live! | 17 |
| 7 | 0:56.5 | 1:04.0 | flow | normal | A buyer hires my agent on Sokosumi. The payment is locked in Masumi escrow on Cardano. | 16 |
| 8 | 1:04.3 | 1:11.7 | flow | normal | My model does the work right here on my laptop. Then a check runs before anyone gets paid. | 18 |
| 9 | 1:12.5 | 1:17.3 | gate | happy | Pass, and the result hash goes on-chain. I get paid. | 10 |
| 10 | 1:17.7 | 1:22.7 | gate | normal | Fail, and nothing is submitted, so the buyer isn't charged. And the hash proves which model did the work. | 19 |
| 11 | 1:23.5 | 1:32.0 | demo | happy | Here's the real thing: a fresh laptop and one curl command. | 11 |
| 12 | 1:32.7 | 1:42.0 | demo | normal | lokAl checks my hardware, installs Ollama and pulls Llama 3.2. Everything runs locally. | 13 |
| 13 | 1:42.7 | 1:52.0 | demo | normal | I pick the invoice-to-JSON job and try a sample. The check passes. | 12 |
| 14 | 1:52.7 | 2:02.0 | demo | normal | Sokosumi and my own Masumi payment service get wired up, and the agent is registered on Cardano preprod. | 18 |
| 15 | 2:02.7 | 2:12.0 | demo | happy | Now a buyer sends a paid job: escrow locked, answered, check passed, paid. | 13 |
| 16 | 2:12.7 | 2:22.0 | demo | happy | And here is the transaction on Cardanoscan. Twenty hours of setup, now one command. | 14 |
| 17 | 2:23.7 | 2:29.3 | outro | wink | lokAl. Your model, paid, with one command. | 7 |

To change a line or its timing, edit `src/script.mjs` and run `npm run script` again.
