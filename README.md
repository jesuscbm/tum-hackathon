# lokAl

**Your local LLM, hired and paid on Cardano, set up from one terminal.**

*The project is **lokAl**; the command you type is `lokal` (all lowercase).*

Start with nothing, or with a model you already run. `lokal` installs the model runtime
(Ollama or llama.cpp), downloads a model that fits your machine (from a 1B model on a laptop CPU to a 70B
model on a GPU server), or uses any OpenAI-compatible API, and turns it into a paid agent on
[Sokosumi](https://preprod.sokosumi.com): buyers pay through Masumi escrow on Cardano
(preprod by default, mainnet opt-in), every answer is checked before the agent asks to be paid, and the
on-chain result hash proves which model weights and which instructions produced it.

It works the same on a laptop and on a fresh server you reach over SSH: no browser, no desktop keyring.
Services run in a background process (`lokald`), so you can close the terminal and come back to the
dashboard at any time.

> Built in 30 hours at the TUM Blockchain & AI Hackathon 2026, Cardano track
> ("Agentic Commerce on Cardano").
> **Status: in progress.** See [Status](#status) for what works today and what is still planned.

---

## The problem

Going from "I want to run Llama" to "someone paid my agent" takes more than a dozen
manual steps today:

- installing a model runtime, then choosing and downloading a model that fits your RAM/VRAM
- Sokosumi CLI login
- Vendor and Coworker creation, plus the runtime key
- an agent process and a worker process
- the Masumi Payment Service, with its own database and a selling wallet
- test ADA from the dispenser
- registry registration
- a seller receipt check

Each step has its own gotchas, and most people give up at the payment step.

## What lokAl does

One command installs lokal. Typing `lokal` opens a terminal UI that walks you through five steps:

| # | Step | What happens |
|---|---|---|
| 1 | **Your machine & model** | Detects OS, CPU, RAM, GPU and any model server already running. If none is found, **installs Ollama for you** (prebuilt binary in `~/.local/share/lokal/`, no sudo). Recommends a model that fits your hardware: Llama 3.2 3B on a laptop CPU, Qwen 2.5 14B on a 12 GB GPU, Qwen 2.5 32B on a 24 GB GPU, Llama 3.3 70B on an 80 GB GPU. Downloads it with a live progress bar, starts the server and runs a test prompt. Press `b` for any other source: **any Ollama tag** (`qwen2.5:32b`, `hf.co/…:Q4_K_M`), **any OpenAI-compatible API** (OpenAI, OpenRouter, Groq, Mistral, your own vLLM or LM Studio, an Ollama on a GPU box) or a running **llama.cpp** server. |
| 2 | **Pick a job** | Choose a job template, write your own system prompt in `$EDITOR`, or **import a Markdown file** (`i`): front matter for the name, check and price, the body is the prompt. Paste a sample input to try the model live and see the check pass or fail. |
| 3 | **Connect Sokosumi** | Creates the Vendor and Coworker, connects the workspace and imports the runtime key. On a laptop you sign in once in the browser. **Over SSH** you paste a Sokosumi API key instead, or get a sign-in link to open on your laptop. |
| 4 | **Get paid** | Sets up the payment service and selling wallet, shows the wallet address as a QR code, tracks the balance live, and registers the agent with an explorer link. `n` switches between preprod and **mainnet**. |
| 5 | **You're live** | Starts the services in the background (`lokald`) and sends you a test job. The job card moves through escrow locked → answered → check passed → paid, with transaction links. |

After setup, the same TUI becomes a dashboard (`d`) showing:
- earnings, jobs done and the check pass rate;
- **machine load**: CPU history, RAM, GPU and VRAM (NVIDIA), and what each service uses;
- **health**: a small map of how the parts connect (Sokosumi → worker → agent → model, worker → payments → wallet,
  registry → agent API → agent), with a light per part (green fine, red broken, grey not enabled) and a pulse on a
  link while traffic passes; below it, the fix for whatever is red;
- each job with its check verdict and on-chain state.

Other views: `c` Coworkers (add, remove, change job), `i` your data (wallet, agent ids, links), `l` logs.

### Pay only if the check passes

Each job template is three things: a **system prompt**, an **input description**, and a
**deterministic check**. The check can be valid JSON, a JSON schema, a regex, or a length range.
The worker runs the check *before* it submits a result to the escrow:

- **Pass:** the result hash is submitted on-chain and the escrow releases to the seller.
- **Fail:** the agent retries once. If the check fails again, it does **not** submit. The escrow
  deadline passes and the buyer can reclaim the funds.

A template without a check still works, but the TUI tells you it carries no payment guarantee.

### Provenance on-chain

The result that gets hashed is a canonical JSON object:

```json
{ "output": "...", "model": "qwen2.5:3b", "digest": "sha256:…", "promptHash": "sha256:…", "check": { "pass": true } }
```

That hash is what goes on-chain as Masumi's `resultHash`. A buyer can recompute it and confirm
which exact weights (the Ollama model digest) and which system prompt produced the answer.
For Ollama the digest comes from the model manifest. For llama.cpp, lokAl computes the sha256
of the GGUF file it downloaded. Remote or third-party endpoints don't expose their weights,
so they are marked *model unverified*.
See [`docs/verify.md`](docs/verify.md).

### Jobs written in Markdown

Write prompts ahead of time as `.md` files and import them (`i` in step 2, or `lokal prompt add FILE.md`), or drop
them into `~/.local/share/lokal/templates/`. The front matter sets the job; the body is the system prompt:

```markdown
---
name: Contract summary
description: Summarises a contract as JSON. Paid only if every field is there.
check: schema                 # none | json | schema | regex | length | invoice
schema: {"type":"object","required":["parties","risks"]}
price: 1                      # USDM
---
You read contracts and return a short, factual summary as a single JSON object, nothing else. …
```

`pattern:` (regex) and `min:`/`max:` (length) configure the other checks. Examples:
[`docs/examples/contract-summary.md`](docs/examples/contract-summary.md), [`docs/examples/haiku.md`](docs/examples/haiku.md).

### Several Coworkers

One machine can serve several jobs, each as its own Sokosumi Coworker with its own prompt and check. They share the
model, the Sokosumi account, the payment service and the selling wallet:

```sh
lokal coworker add "Contract summary" --prompt docs/examples/contract-summary.md
lokal coworker add "Haiku" --template freeform
lokal coworker list
lokal coworker paid contract-summary     # its own registry entry, so it can take paid jobs
lokal coworker remove haiku --retire     # stops it, deletes its folder, renames it "(retired)" on Sokosumi
```

Or press `c` in the UI. Each extra Coworker lives in `~/.local/share/lokal/coworkers/<id>/` (its own `.env`, journals,
prompt and ports; code is linked from `coworker/`). A model set in its own `.env` overrides the shared one.
Sokosumi has no delete for Coworkers, so a removed one stays on Sokosumi unless you retire (rename) it.

### Your data

`i` in the UI, or `lokal info` (`--json` for scripts): network, model and weights digest, Sokosumi account, Vendor
and Workspace, every Coworker's Sokosumi id, prompt hash, agent identifier and registration transaction, the selling
wallet address, balance and explorer link, and where every file lives. No secrets are printed.
`lokal wallet export` shows the selling wallet's recovery phrase (after asking), so you can move your earnings with
any Cardano wallet.

### Mainnet

Preprod is the default. `n` in step 4 (or `lokal network mainnet`) switches to mainnet after you type `mainnet` to
confirm. Your preprod wallet and registration are kept and come back when you switch back. Mainnet needs a mainnet
Blockfrost key (plus the free preprod one: the payment service always seeds preprod), real ADA in the selling wallet
for the registration, and a public URL for the agent API (`AGENT_PUBLIC_URL`), because mainnet buyers hire the agent
through the Masumi registry (MIP-003). Sokosumi Tasks stay on preprod: the Sokosumi CLI's Coworker runtime is
preprod-only. The mainnet code path has not been run with real money yet.

## Demo job: invoice → JSON

The built-in template turns a pasted invoice or receipt into structured JSON. The check
validates the schema and confirms that the line items add up to the total (± 0.01). A 3B
model on a laptop CPU (Llama 3.2 3B or Qwen 2.5 3B) handles it well inside Masumi's result window.
Sample inputs, both passing and failing, live in `templates/invoice-json/samples/`.

---

## Architecture

```
            ┌──── lokal (UI, any time) ────┐   unix socket   ┌──── lokald (background) ─────────────────────┐
  you  ───► │  tui/ (Ink) ◄─ events ─ core/ │ ◄────────────► │  supervisor ─┬─► coworker agent (Eve)  × N   │
  (ssh ok)  │  steps/ (wizard), runtime/,   │  logs, status, │              ├─► coworker worker      × N ◄── Sokosumi tasks
            │  pay/, checks/, provenance    │  start / stop  │              ├─► agent API (MIP-003)  × N ◄── registry buyers
            └───────────────────────────────┘                │              └─► Masumi payment service    │
                                                             └───────────────────────────────────────────────┘
  model server: Ollama / llama-server / any OpenAI-compatible API          N = one per Coworker
  buyer ─► Sokosumi paid Task or MIP-003 job ─► Masumi escrow (Cardano) ─► result hash ─► release / refund
```

- **Sokosumi** is the marketplace where the buyer hires the agent.
- **Masumi** provides the escrow, agent identity and registry, and the on-chain result hash.
- **Blockfrost** is used to read wallet balances and verify the seller's receipt.
- Everything runs locally. Only settlement goes on-chain.

## Project structure

```
.
├── install.sh                 # one-line installer: private Node 24, deps, Sokosumi CLI, PATH, starts the wizard
├── uninstall.sh               # removes everything lokal installed (flags: --models --logout --all)
├── bin/
│   └── lokal.mjs              # CLI entry: TUI (default), status, info, up/down, daemon, model, coworker, prompt, network, wallet, …
├── tui/                       # Ink (React for terminals), no build step: components via htm
│   ├── app.mjs                # wizard (5 steps), dashboard, logs, keyboard handling
│   ├── components.mjs         # spinner, progress bar, check badge, cards, text input
│   ├── vitals.mjs             # dashboard: the health map (a light per part) and CPU/RAM/GPU meters
│   ├── theme.mjs              # colours, icons, clickable terminal links
│   └── html.mjs               # htm binding (JSX-free)
├── core/                      # engine. The TUI talks only to createCore() in index.mjs
│   ├── index.mjs              # public API: status/run steps, tryIt, jobs, health, services
│   ├── mock.mjs               # same API with fake data (LOKAL_MOCK=1 / --mock)
│   ├── steps/                 # one module per wizard step: status() + run()
│   │   ├── machine.mjs        # hardware → runtime → model → smoke test → writes ZAI_* env
│   │   ├── job.mjs            # job templates, custom prompts, writes agent/instructions.md
│   │   ├── sokosumi.mjs       # account, Vendor, Coworker, runtime key, Workspace
│   │   ├── pay.mjs            # Blockfrost key, payment service, wallet, registry, paid tasks
│   │   └── live.mjs           # services up, test job
│   ├── runtime/               # model-server setup, no sudo, under ~/.local/share/lokal/
│   │   ├── ollama.mjs         # detect → install release binary → serve → pull (streamed) → digest
│   │   ├── llamacpp.mjs       # detect a running llama-server, sha256 of GGUF weights
│   │   ├── models.json        # curated catalog: size, min RAM/VRAM, context
│   │   └── recommend.mjs      # hardware → best-fitting model (Llama preferred)
│   ├── backends/openai.mjs    # streaming client for any OpenAI-compatible endpoint
│   ├── supervisor.mjs         # starts/restarts agent, worker, agent API (per Coworker) and the payment service
│   ├── daemon.mjs             # lokald: the supervisor in the background, controlled over a unix socket
│   ├── services.mjs           # service control for UI/CLI (through lokald)
│   ├── coworkers.mjs          # extra Coworkers: folders, ports, shared settings, add/remove
│   ├── network.mjs            # preprod / mainnet constants (Blockfrost, explorer, USDM, MPS network)
│   ├── vault.mjs              # headless: file vault for the Sokosumi CLI, captured sign-in links
│   ├── info.mjs               # `lokal info`: ids, addresses, links, paths
│   ├── resources.mjs          # CPU, RAM, GPU and per-service usage
│   ├── sokosumi.mjs           # wrapper over the pinned Sokosumi CLI (--preprod --json)
│   ├── jobs.mjs               # job feed from the worker journals + on-chain state
│   ├── health.mjs             # one entry per layer (the dashboard's lights), with detail and fix
│   ├── hardware.mjs  config.mjs  events.mjs  exec.mjs  paths.mjs
├── pay/                       # payment setup as idempotent steps
│   ├── mps.mjs                # own Masumi Payment Service: Postgres (docker), clone, migrate, seed
│   ├── wallet.mjs             # selling wallet balance via Blockfrost, faucet, explorer links
│   ├── register.mjs           # wraps coworker/payment-registration.mjs (key → register → poll)
│   └── state.mjs              # shared paths + payment service client
├── checks/                    # deterministic result checks
│   ├── index.mjs              # check(config, input, output) → { pass, type, reasons }
│   ├── json.mjs  schema.mjs   # JSON extraction, JSON-schema subset validator
│   └── invoice.mjs            # schema + line items and tax sum to total
├── provenance.mjs             # canonical result {model, digest, promptHash, check, output} → hash
├── templates/
│   ├── index.mjs              # list/load built-in + custom templates
│   ├── invoice-json/          # template.json, prompt.md, samples/ (3 pass, 2 fail)
│   └── freeform/              # no check
├── coworker/                  # the Sokosumi Coworker processes, adapted from the Masumi TUM starter
│   ├── lokal-gate.mjs         # our hook: check + retry + canonical result (active when LOKAL_TEMPLATE is set)
│   ├── worker.mjs             # polls Sokosumi tasks; answers go through the gate
│   ├── paid-task.mjs          # escrow flow; a failed check is never submitted (stage check-failed)
│   └── agent-api.mjs          # MIP-003 agent API
├── test/                      # node:test suites for checks, provenance, templates
└── docs/
    ├── verify.md              # how a buyer recomputes the result hash
    └── evidence.md            # task IDs, tx hashes and seller receipts for the submission
```

## Requirements

- Linux or macOS (x64 or arm64), `curl` and `tar`. **You don't need Node or npm.** The installer
  brings its own private copy.
- Nothing for credentials: the Sokosumi CLI uses your desktop keyring when there is one; on a server without one,
  lokAl keeps its login and runtime keys in `~/.local/share/lokal/vault/` (mode 600)
- Nothing else for the model: lokAl installs [Ollama](https://ollama.com) or
  [llama.cpp](https://github.com/ggml-org/llama.cpp) if no model server is found.
  Plan for 2–5 GB of disk per model.
- Docker, only for step 4. The Masumi Payment Service needs its own Postgres database, and lokAl
  starts it in a container. If Docker is missing, the TUI shows the install command for your OS.
- A Sokosumi **preprod** account and a free [Blockfrost](https://blockfrost.io) preprod key

## Install

One command does the whole ride: install, then the setup wizard starts in the same terminal.

```sh
curl -fsSL https://raw.githubusercontent.com/jesuscbm/lokAl/main/install.sh | sh
```

Afterwards, `lokal` reopens the dashboard from any new terminal. The installer:
- needs no sudo and writes only to `~/.local/share/lokal/` and `~/.local/bin/` (plus one marked PATH line in
  `~/.profile`, `~/.bashrc`, `~/.zshrc` when `~/.local/bin` isn't on your PATH yet);
- uses your Node if it is 24.x, otherwise a pinned Node 24 from nodejs.org (SHA-256 verified), kept private;
- installs lokAl's dependencies and the pinned Sokosumi CLI **1.0.4** with that Node; you never run npm yourself.

Set `LOKAL_NO_START=1` to install without starting the wizard (CI, provisioning). [Read the installer](install.sh) first if you like.

### Uninstall (and start over)

```sh
lokal uninstall            # or: curl -fsSL https://raw.githubusercontent.com/jesuscbm/lokAl/main/uninstall.sh | sh
lokal uninstall --all      # also delete downloaded models, sign Sokosumi out, remove the postgres image
```

It stops every lokAl process, removes the payment database container, `~/.local/share/lokal`, the `lokal` command
and the PATH lines. Online records (Sokosumi Vendor/Coworker, registry entry, preprod transactions) stay, and a
reinstall reuses your Vendor and the Coworker lokAl registered. A reinstall creates a fresh selling wallet, which
gets new test ADA from the dispenser automatically.

### For contributors: run from source

```sh
git clone https://github.com/jesuscbm/lokAl.git && cd lokAl
npm ci && (cd coworker && npm ci)
node bin/lokal.mjs            # real setup
node bin/lokal.mjs --mock     # fake backend: the whole flow in 30 seconds, nothing touched
node bin/lokal.mjs status     # plain-text status of every step
npm test && (cd coworker && npm test)
```

Point lokAl at another coworker folder or state folder with `LOKAL_COWORKER_DIR` and `LOKAL_HOME`.

### On a server over SSH

The UI works over SSH as it is: `ssh you@server`, install, `lokal`. Differences from a laptop:
- **Sign-in (step 3):** press enter and paste a Sokosumi API key (create one on your laptop at
  <https://preprod.sokosumi.com/connections>), or press `b` for a sign-in link plus the `ssh -L` tunnel command that
  lets your laptop's browser finish it.
- **No keyring needed:** see Requirements.
- **Leave any time:** quit with `q` or just disconnect; `lokald` keeps the agent, worker, agent API and payment
  service running. `lokal` brings the dashboard back. `lokal daemon enable` adds a systemd user unit so it also
  survives reboots (`sudo loginctl enable-linger $USER` keeps it running without a login session).

Everything also works without the UI (CI, provisioning scripts):

```sh
lokal run machine                 # install/detect runtime, pull model, smoke test
lokal model api https://api.groq.com/openai/v1 llama-3.3-70b-versatile   # or a cloud/self-hosted model (key on stdin)
lokal prompt add docs/examples/contract-summary.md   # or: lokal run job invoice-json
echo "$SOKOSUMI_KEY" | lokal login
lokal run sokosumi                # Vendor, Coworker, runtime key
echo "$KEY" | lokal set BLOCKFROST_API_KEY_PREPROD
lokal run pay                     # payment service, wallet + test ADA, registry
lokal up                          # start lokald and follow its logs (Ctrl+C only detaches)
lokal info                        # wallet address, agent id, Coworker ids, explorer links
lokal down                        # stop everything
```

The commands lokAl runs underneath are listed in [`docs/runbook.md`](docs/runbook.md).

## Configuration

**You never edit a config file.** `coworker/.env` is created from `coworker/.env.example` and filled in by
the wizard; it is git-ignored and never leaves your machine. The only values lokAl cannot find on its own:

| Value | Where lokAl asks | Headless alternative |
|---|---|---|
| Blockfrost preprod key (free, [blockfrost.io](https://blockfrost.io)) | step 4, masked input | `lokal set BLOCKFROST_API_KEY_PREPROD` (reads stdin) or the `BLOCKFROST_API_KEY_PREPROD` env var |
| Blockfrost mainnet key (mainnet only) | step 4 | `lokal set BLOCKFROST_API_KEY_MAINNET` |
| Public agent API URL (mainnet only) | step 4 | `lokal set AGENT_PUBLIC_URL` (bind with `AGENT_API_HOST=0.0.0.0` or put a reverse proxy in front) |
| Registry author name | defaults to your Sokosumi Vendor name | `lokal set AGENT_AUTHOR` or the `AGENT_AUTHOR` env var |
| Sokosumi sign-in | step 3: browser, or API key / sign-in link over SSH | `lokal login` (API key on stdin) |
| Model API key (API backend only) | step 1, `b` → API | `lokal model api URL MODEL` (key on stdin) |

Everything else is detected or created: the model settings (`ZAI_*`), `COWORKER_ID`, the organization Workspace
(step 3, key `o`), the payment service secrets, wallet and registration state.

| Where secrets live | What |
|---|---|
| `coworker/.env` | model endpoint, Coworker and Workspace IDs, Blockfrost key, ports (names in `.env.example`) |
| `coworker/.local/mps.env` | payment service `ADMIN_KEY`, database password, encryption key (generated) |
| `coworker/.local/mps-runtime.env` | `MPS_RUNTIME_TOKEN` (wallet-scoped key, generated) |
| Sokosumi CLI vault | Coworker runtime keys and the Sokosumi login: the desktop keyring, or `~/.local/share/lokal/vault/` on servers |
| `~/.local/share/lokal/` | private Node, Ollama, payment service checkout, `config.json`, logs |

## Status

The submission checklist asks us to keep what works separate from what is pending.

- [x] Llama 3.2 3B via Ollama passes the 3 passing invoice samples and fails the 2 failing ones (CPU, 15–35 s each)
- [x] The coworker's Eve agent runs on the local model (Ollama OpenAI-compatible endpoint)
- [x] Steps 1–2 run end to end against a scratch coworker copy (model detected, smoke test, template selected, try-it passed)
- [x] TUI wizard + dashboard (real and `--mock`), `lokal status`, `lokal verify`
- [x] Installer tested from a local checkout into an empty home (private Node 24, sha256 verified)
- [x] `npm run smoke`: clean-room install + CLI + tests with no accounts or keys (also in CI)
- [x] Payment service phase A for real: Postgres in Docker, pinned checkout, install, migrate
- [ ] lokAl installs Ollama on a machine without one (code written, untested)
- [ ] Local model answers a free Sokosumi task through the gate (TUM workspace)
- [ ] Payment service phase B (wallets, needs Blockfrost key), automatic test ADA, agent registered (code written, untested)
- [ ] Paid task completed: tx hash + seller receipt in [`docs/evidence.md`](docs/evidence.md)
- [ ] Check gate on a real paid task: failing output is not submitted
- [ ] Fresh-machine run: time from the install command to the first paid job: **__ min**

Added on 30 Oct (evening), tested with unit tests and `--mock`/scratch folders, not yet on a fresh server:
- [x] `lokald` background service + reattaching UI (`lokal up`/`down`, `daemon start|stop|status|enable`)
- [x] Headless Sokosumi: file vault stand-in for `secret-tool` (CLI login + status verified against it), API-key
      login, captured sign-in link
- [x] Extra Coworkers: folder + links + ports; an extra Coworker's Eve agent answered through the gate
- [x] Markdown prompts with front matter; `lokal info`; dashboard health map and machine load
- [ ] Model backends other than local Ollama (API presets, llama.cpp) against a real endpoint
- [ ] Registering an extra Coworker on Sokosumi and on the registry
- [ ] Mainnet (written, never run with real money)

## Cardano tools used

Masumi escrow (Cardano preprod, `Web3CardanoV2` payment source) · Masumi registry (agent identity) ·
Masumi Payment Service · Sokosumi marketplace and CLI 1.0.4 · Blockfrost preprod API ·
test USDM · `dispenser.masumi.network`.

## Limits

- Preprod by default. Mainnet support is written but untested with real funds, and Sokosumi Tasks stay on preprod
  (the CLI's Coworker runtime is preprod-only); mainnet buyers come through the MIP-003 agent API.
- The buyer refund relies on Masumi's escrow deadlines. The agent withholds a failing
  result, and the buyer reclaims the funds after the deadline.
- The check proves the output is well-formed and internally consistent, not that it is correct.
- The weights digest is available only for models lokAl runs locally (Ollama or llama.cpp).
- Runtime auto-install targets Linux and macOS. On Windows, install Ollama yourself and lokAl detects it.

## Team

J · T · M · F, TUM Blockchain & AI Hackathon 2026, Munich.

## Credits

Built on [`masumi-network/tum-hackathon-quickstart`](https://github.com/masumi-network/tum-hackathon-quickstart).
