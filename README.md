# lokal

**Your local LLM, hired and paid on Cardano, set up from one terminal.**

Start with nothing, or with a model you already run. `lokal` installs the model runtime
(Ollama or llama.cpp), downloads a model that fits your machine, and turns it into a paid agent on
[Sokosumi](https://preprod.sokosumi.com): buyers pay through Masumi escrow on Cardano
preprod, every answer is checked before the agent asks to be paid, and the on-chain result
hash proves which model weights and which instructions produced it.

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

## What lokal does

One command installs lokal. Typing `lokal` opens a terminal UI that walks you through five steps:

| # | Step | What happens |
|---|---|---|
| 1 | **Your machine & model** | Detects OS, CPU, RAM, GPU and any model server already running. If none is found, **installs one for you**: Ollama by default, or llama.cpp's `llama-server`. Both use prebuilt binaries in `~/.local/share/lokal/`, with no sudo. Recommends a model that fits your hardware (for example Llama 3.2 3B on a laptop CPU, or Llama 3.1 8B with 8 GB+ VRAM), downloads it with a live progress bar, starts the server, and runs a test prompt. You can also point lokal at an existing OpenAI-compatible endpoint (LM Studio, vLLM, a cloud key). |
| 2 | **Pick a job** | Choose a job template, or write your own system prompt in `$EDITOR`. Paste a sample input to try the model live and see the check pass or fail. |
| 3 | **Connect Sokosumi** | Creates the Vendor and Coworker, connects the workspace and imports the runtime key. Any step that needs a human (one login) is shown as one command, and lokal detects when it is done. |
| 4 | **Get paid** | Sets up the payment service and selling wallet, shows the wallet address as a QR code, tracks the balance live, and registers the agent with an explorer link. |
| 5 | **You're live** | Sends you a test job. The job card moves through escrow locked → answered → check passed → paid, with transaction links. |

After setup, the same TUI becomes a dashboard showing:
- earnings and jobs done;
- each job with its check verdict and on-chain state;
- a health strip with one dot per layer: model, agent, worker, Sokosumi, payment service, wallet and registry.

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
For Ollama the digest comes from the model manifest. For llama.cpp, lokal computes the sha256
of the GGUF file it downloaded. Remote or third-party endpoints don't expose their weights,
so they are marked *model unverified*.
See [`docs/verify.md`](docs/verify.md).

## Demo job: invoice → JSON

The built-in template turns a pasted invoice or receipt into structured JSON. The check
validates the schema and confirms that the line items add up to the total (± 0.01). A 3B
model on a laptop CPU (Llama 3.2 3B or Qwen 2.5 3B) handles it well inside Masumi's result window.
Sample inputs, both passing and failing, live in `templates/invoice-json/samples/`.

---

## Architecture

```
            ┌──────────────── lokal (one process) ─────────────────┐
  you  ───► │  tui/  (Ink)  ◄── events ──  core/                    │
            │                               ├─ runtime/  (install Ollama or llama.cpp, fetch model)
            │                               ├─ supervisor ─┬─► model server (Ollama / llama-server / external)
            │                               │              ├─► coworker agent (Eve)
            │                               │              ├─► coworker worker   ◄── Sokosumi tasks
            │                               │              └─► coworker agent API (MIP-003)
            │                               ├─ steps/  (onboarding wizard)
            │                               ├─ pay/    (payment service, wallet, registry)
            │                               └─ checks/ + provenance
            └───────────────────────────────────────────────────────┘
                                            │
  buyer ─► Sokosumi paid Task ─► Masumi escrow (Cardano preprod) ─► result hash ─► release / refund
```

- **Sokosumi** is the marketplace where the buyer hires the agent.
- **Masumi** provides the escrow, agent identity and registry, and the on-chain result hash.
- **Blockfrost** is used to read wallet balances and verify the seller's receipt.
- Everything runs locally. Only settlement goes on-chain.

## Project structure

```
.
├── install.sh                 # one-line installer: private Node 24, deps, Sokosumi CLI, `lokal` command
├── bin/
│   └── lokal.mjs              # CLI entry: TUI (default), status, doctor, verify, uninstall, --mock
├── tui/                       # Ink (React for terminals), no build step: components via htm
│   ├── app.mjs                # wizard (5 steps), dashboard, logs, keyboard handling
│   ├── components.mjs         # spinner, progress bar, check badge, cards, text input
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
│   ├── supervisor.mjs         # starts/restarts agent, worker, agent API, payment service; never doubles one
│   ├── sokosumi.mjs           # wrapper over the pinned Sokosumi CLI (--preprod --json)
│   ├── jobs.mjs               # job feed from the worker journals + on-chain state
│   ├── health.mjs             # one dot per layer for the dashboard
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
- A system credential vault supported by the Sokosumi CLI (GNOME Keyring / KWallet on Linux,
  Keychain on macOS)
- Nothing else for the model: lokal installs [Ollama](https://ollama.com) or
  [llama.cpp](https://github.com/ggml-org/llama.cpp) if no model server is found.
  Plan for 2–5 GB of disk per model.
- Docker, only for step 4. The Masumi Payment Service needs its own Postgres database, and lokal
  starts it in a container. If Docker is missing, the TUI shows the install command for your OS.
- A Sokosumi **preprod** account and a free [Blockfrost](https://blockfrost.io) preprod key

## Install

```sh
curl -fsSL https://raw.githubusercontent.com/jesuscbm/tum-hackathon/main/install.sh | sh
lokal
```

Then the TUI takes over. The installer:
- doesn't need sudo and writes only to `~/.local/share/lokal/` and `~/.local/bin/lokal`;
- uses your Node if it is 24 or newer. Otherwise it downloads a pinned Node 24 from nodejs.org
  into `~/.local/share/lokal/node` and checks its SHA-256;
- installs lokal's dependencies and the pinned Sokosumi CLI **1.0.4** with that private Node;
  you never run npm yourself;
- adds `~/.local/bin` to your `PATH` if it is missing, and tells you so.

You can [read the installer first](install.sh) before running it. To remove everything:
`lokal uninstall`, or `rm -rf ~/.local/share/lokal ~/.local/bin/lokal`.

### For contributors: run from source

```sh
git clone https://github.com/jesuscbm/tum-hackathon.git lokal && cd lokal
npm ci && (cd coworker && npm ci)
node bin/lokal.mjs            # real setup
node bin/lokal.mjs --mock     # fake backend: the whole flow in 30 seconds, nothing touched
node bin/lokal.mjs status     # plain-text status of every step
npm test && (cd coworker && npm test)
```

Point lokal at another coworker folder or state folder with `LOKAL_COWORKER_DIR` and `LOKAL_HOME`.

### Headless (servers, SSH, CI)

```sh
lokal run machine                 # install/detect runtime, pull model, smoke test
lokal run job invoice-json        # pick the job template
lokal run sokosumi                # account, Vendor, Coworker, runtime key
echo "$KEY" | lokal set BLOCKFROST_API_KEY_PREPROD
lokal run pay                     # payment service, wallet + test ADA, registry
lokal up                          # keep agent, worker and agent API running; logs to stdout
```

The commands lokal runs underneath are listed in [`docs/runbook.md`](docs/runbook.md).

## Configuration

**You never edit a config file.** `coworker/.env` is created from `coworker/.env.example` and filled in by
the wizard; it is git-ignored and never leaves your machine. The only values lokal cannot find on its own:

| Value | Where lokal asks | Headless alternative |
|---|---|---|
| Blockfrost preprod key (free, [blockfrost.io](https://blockfrost.io)) | step 4, masked input | `lokal set BLOCKFROST_API_KEY_PREPROD` (reads stdin) or the `BLOCKFROST_API_KEY_PREPROD` env var |
| Registry author name | defaults to your Sokosumi Vendor name | `lokal set AGENT_AUTHOR` or the `AGENT_AUTHOR` env var |
| Sokosumi sign-in | step 3 opens your browser | `sokosumi --preprod auth login` |

Everything else is detected or created: the model settings (`ZAI_*`), `COWORKER_ID`, the organization Workspace
(step 3, key `o`), the payment service secrets, wallet and registration state.

| Where secrets live | What |
|---|---|
| `coworker/.env` | model endpoint, Coworker and Workspace IDs, Blockfrost key, ports (names in `.env.example`) |
| `coworker/.local/mps.env` | payment service `ADMIN_KEY`, database password, encryption key (generated) |
| `coworker/.local/mps-runtime.env` | `MPS_RUNTIME_TOKEN` (wallet-scoped key, generated) |
| Sokosumi CLI vault | Coworker runtime key (never in files) |
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
- [ ] lokal installs Ollama on a machine without one (code written, untested)
- [ ] Local model answers a free Sokosumi task through the gate (TUM workspace)
- [ ] Payment service phase B (wallets, needs Blockfrost key), automatic test ADA, agent registered (code written, untested)
- [ ] Paid task completed: tx hash + seller receipt in [`docs/evidence.md`](docs/evidence.md)
- [ ] Check gate on a real paid task: failing output is not submitted
- [ ] Fresh-machine run: time from the install command to the first paid job: **__ min**

## Cardano tools used

Masumi escrow (Cardano preprod, `Web3CardanoV2` payment source) · Masumi registry (agent identity) ·
Masumi Payment Service · Sokosumi marketplace and CLI 1.0.4 · Blockfrost preprod API ·
test USDM · `dispenser.masumi.network`.

## Limits

- Preprod only, no mainnet.
- The buyer refund relies on Masumi's escrow deadlines. The agent withholds a failing
  result, and the buyer reclaims the funds after the deadline.
- The check proves the output is well-formed and internally consistent, not that it is correct.
- The weights digest is available only for models lokal runs locally (Ollama or llama.cpp).
- Runtime auto-install targets Linux and macOS. On Windows, install Ollama yourself and lokal detects it.

## Team

J · T · M · F, TUM Blockchain & AI Hackathon 2026, Munich.

## Credits

Built on [`masumi-network/tum-hackathon-quickstart`](https://github.com/masumi-network/tum-hackathon-quickstart).
