# lokAl

lokAl turns a language model running on your own machine into a paid agent on [Sokosumi](https://preprod.sokosumi.com). Buyers pay into Masumi escrow on Cardano (preprod by default), your model does the job, and you get paid when the result passes a check. Setup and monitoring happen in a single terminal UI, so it works the same on a laptop as on a server over SSH.

The point: if you have spare compute (a gaming PC, a lab GPU server) you can sell agent work without a cloud API. And since the model runs locally, a buyer's data stays on the seller's machine. An invoice sent to lokAl never goes to OpenAI or any other provider.

## What it does

1. **Runs your model.** Ollama with a model picked for your hardware, any Ollama tag, a llama.cpp server, or an OpenAI-compatible API (OpenAI, OpenRouter, Groq, Mistral, vLLM, LM Studio).
2. **Takes jobs from Sokosumi.** Your model is registered as a Sokosumi Coworker and answers the Tasks sent to it. Buyers can also call it through the MIP-003 agent API.
3. **Checks results before getting paid.** Each job comes with a deterministic check (JSON schema, regex, length, invoice totals). If a result fails, lokAl retries once. If it fails again it is never submitted, so the buyer is not charged and can reclaim the escrow after the deadline.
4. **Commits to what produced the result.** The hash stored on-chain covers the output, the check verdict, the prompt hash, the model name and the model weights digest. Anyone can recompute it with `lokal verify`.

The included `invoice-json` job turns an invoice into JSON and checks the schema and totals. You can also write your own jobs as Markdown files.

## Install

You need Linux or macOS (x64 or arm64), `curl`, `tar`, a [Sokosumi preprod account](https://preprod.sokosumi.com) and a [Blockfrost](https://blockfrost.io) preprod key. Plan for 2–5 GB of disk per model.

```sh
curl -fsSL https://raw.githubusercontent.com/jesuscbm/lokAl/main/install.sh | sh
```

The installer sets up a private Node.js, and offers to install Ollama if you don't have it. The payment service needs a database: if neither Docker nor PostgreSQL is installed, it asks before installing Docker (Linux) or `postgresql@16` through Homebrew (macOS). That's the only step that uses sudo.

When it finishes, the setup wizard opens in the same terminal.

## Setup wizard

| Step | What you do |
|---|---|
| 1. Machine & model | Accept the suggested model, or press `b` to pick another backend |
| 2. Job | Choose `invoice-json` or import your own prompt (`f`); set the price with `p` |
| 3. Sokosumi | Sign in and create or reuse a Coworker; `o` picks an organization Workspace |
| 4. Payments | Paste the Blockfrost key; lokAl sets up the payment service and wallets, gets test ADA and registers the agent |
| 5. Live | Send yourself a test task (`t`) and watch the dashboard |

**Over SSH:** in step 3, paste an API key from <https://preprod.sokosumi.com/connections>, or press `b` to get a sign-in link you can open on your laptop through an SSH tunnel. Servers don't need a browser or a desktop keyring. Without a keyring, credentials go to `~/.local/share/lokal/vault/` (mode 600).

**Background services:** the agent, worker, agent API and payment service run under `lokald`, a small supervisor. Closing the UI or dropping the SSH connection doesn't stop them. Run `lokal` to reopen the dashboard and `lokal down` to stop everything. `lokal daemon enable` starts it at login (systemd on Linux, launchd on macOS).

The dashboard shows earnings, recent jobs, CPU/RAM/GPU load and a health map of every service. Press `i` (or run `lokal info`) for your wallet address, agent ID, Coworker IDs and explorer links.

## Usage

### Your own jobs

A job is a Markdown file. The front matter sets `name`, `price` and `check` (`none`, `json`, `schema`, `regex`, `length` or `invoice`, plus `schema`, `pattern`, `min` or `max` where needed). The body is the prompt.

```sh
lokal prompt add my-job.md       # or f in step 2
```

Examples are in [docs/examples](docs/examples).

### Several jobs at once

Each job can run as its own Coworker. All of them share the model and the wallet.

```sh
lokal coworker add NAME --prompt my-job.md   # or c in the UI
lokal coworker remove ID [--retire]
```

### Commands

```sh
lokal                  # setup wizard, or the dashboard once set up
lokal status           # setup status
lokal doctor           # diagnose services
lokal up               # start lokald and follow its logs (Ctrl+C detaches)
lokal down             # stop lokald and its services
lokal info             # wallet, agent and Coworker IDs, links
lokal verify FILE HASH [--recheck]   # check a result against its on-chain hash
lokal price 2 ADA      # price per job (USDM or ADA)
lokal workspace        # which Sokosumi Workspace sends you tasks
lokal model api URL MODEL   # use an OpenAI-compatible API (key on stdin)
lokal login            # Sokosumi API-key sign-in (key on stdin)
lokal buy "…"          # buy a job from yourself through the agent API
lokal wallet export    # selling wallet recovery phrase (asks first)
lokal network mainnet  # switch networks (asks first)
lokal run machine|job ID|sokosumi|pay   # run a single setup step
lokal uninstall
```

For scripted setups, secrets go through stdin:

```sh
echo "$BLOCKFROST_API_KEY_PREPROD" | lokal set BLOCKFROST_API_KEY_PREPROD
```

More detail in [docs/runbook.md](docs/runbook.md).

## Payments and verification

The worker runs the job's check on every result before it submits anything. A passing result goes to Masumi escrow and the seller can withdraw after the unlock time. A failing result is retried once and then withheld.

The buyer doesn't have to trust the seller's check. The check is deterministic and the job definition is public, so `lokal verify result.json HASH --recheck` runs it again. A seller who committed "pass" for a failing result gets caught, and the output is evidence for a Masumi dispute.

Two caveats. The model name and weights digest are what the seller *claims*: they are binding (they're in the hash), but not proof of which hardware ran what. And checks validate format and constraints, not whether the answer is factually right. See [docs/verify.md](docs/verify.md).

**On preprod so far:** a Llama 3.2 3B agent, running on CPU, was registered ([27d3b0f8…](https://preprod.cardanoscan.io/transaction/27d3b0f8af44874537ef4a5fbccb15c9338996279f80a231351fec342303af11)) and completed a paid invoice task: funds locked in [bc6d593b…](https://preprod.cardanoscan.io/transaction/bc6d593bb5dd5f62c84b611d577c38ea31a70297dbf2ae0b7fdf2da177c8b6e1), result submitted in [7332dccf…](https://preprod.cardanoscan.io/transaction/7332dccf8073bf45c3d69430bbdae30837ed67f116fa3b16c45e8d21af3107bb), and `lokal verify` matches the on-chain hash. Details in [docs/evidence.md](docs/evidence.md).

## Limitations

- Preprod by default. Mainnet support is written but hasn't been run with real funds. Sokosumi Tasks are preprod-only, so on mainnet buyers use the agent API, which needs a public URL (`lokal set AGENT_PUBLIC_URL`). See [docs/mainnet.md](docs/mainnet.md).
- The payment service needs PostgreSQL, either in a Docker container or as a private cluster in `~/.local/share/lokal/pgdata` using your own PostgreSQL binaries.
- macOS hasn't been tried on real hardware. Apple GPU load isn't shown (it needs `sudo powermetrics`), and over SSH you need to run `security unlock-keychain` once per session for the Sokosumi CLI.
- No Windows support. Refunds follow the Masumi escrow deadlines.

## Future work

- **Mainnet testing.** Run registration, paid jobs, withdrawals and `lokal buy` against mainnet with real funds, and the same for ADA prices.
- **Full payment cycle on preprod.** Confirm the seller's withdrawal, and run a paid task that fails its check through to the buyer's refund.
- **Modular Coworkers.** Today extra Coworkers share the main one's model and wallet. The goal is Coworkers as self-contained modules, each with its own model, backend, wallet and pricing, that can be packaged, shared and installed from others.
- **Proxy layer in front of the agent.** The agent API has a basic cap on new jobs (60 per minute, 20 open payment requests). A proper proxy would add banning of abusive buyers, per-buyer rate limits, and rejecting new jobs when the machine is too busy (based on queue length and load) instead of accepting work it can't finish before the deadline.
- **More backends tested for real.** The OpenAI-compatible API and llama.cpp backends, and the Ollama auto-install, are written but have only been tested with mocks.
- **Time to first paid job.** Measure a from-scratch install on a fresh machine.

## Run from source

Requires Node.js 24.

```sh
git clone https://github.com/jesuscbm/lokAl.git lokal
cd lokal
npm ci
(cd coworker && npm ci)
node bin/lokal.mjs          # real
node bin/lokal.mjs --mock   # full UI with fake data, touches nothing
npm test && (cd coworker && npm test)
```

Built at the TUM Blockchain & AI Hackathon 2026 with [Sokosumi](https://preprod.sokosumi.com), [Masumi](https://masumi.network) and [Blockfrost](https://blockfrost.io).
