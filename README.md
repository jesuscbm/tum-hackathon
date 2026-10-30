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

`npx lokal` opens a terminal UI that walks you through five steps:

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
            │                               │              ├─► quickstart agent (Eve)
            │                               │              ├─► quickstart worker  ◄── Sokosumi tasks
            │                               │              └─► quickstart agent API (MIP-003)
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
├── bin/
│   └── lokal.mjs              # entry point: `npx lokal` starts the TUI
├── tui/                       # Ink (React for terminals) UI
│   ├── app.tsx                # router: wizard ↔ dashboard
│   ├── wizard/                # 5 onboarding screens (machine, job, sokosumi, pay, live)
│   ├── dashboard/             # earnings header, job feed, health strip
│   └── components/            # progress bar, step rail, QR code, job card, links
├── core/                      # engine. The TUI talks only to this interface.
│   ├── index.mjs              # public API: steps, jobs, wallet, try(), events
│   ├── events.mjs             # typed event bus (log, progress, step, job)
│   ├── supervisor.mjs         # starts and restarts model server, agent, worker, agent API
│   ├── hardware.mjs           # OS, CPU, RAM, GPU/VRAM detection
│   ├── runtime/               # model-server setup, no sudo, under ~/.local/share/lokal/
│   │   ├── ollama.mjs         # detect existing → else download binary, serve, pull (streamed progress), digest
│   │   ├── llamacpp.mjs       # download llama-server release, fetch GGUF from Hugging Face, sha256
│   │   ├── models.json        # curated catalog: model, size, min RAM/VRAM, Ollama tag, GGUF URL
│   │   └── recommend.mjs      # hardware → best-fitting model
│   ├── backends/              # one client interface: ollama.mjs, llamacpp.mjs, openai-compatible.mjs
│   ├── steps/                 # one module per wizard step: run(), status(), fix hints
│   ├── health.mjs             # per-layer health checks
│   ├── jobs.mjs               # job feed from worker journals + on-chain state
│   └── mock.mjs               # fake core for UI development
├── pay/                       # payment setup as idempotent steps (state saved after each)
│   ├── mps.mjs                # Masumi Payment Service up and healthy
│   ├── wallet.mjs             # selling wallet, faucet, balance via Blockfrost
│   └── register.mjs           # runtime key + agent registration
├── checks/                    # deterministic result checks
│   ├── index.mjs              # check(template, input, output) → { pass, reasons }
│   ├── json.mjs  schema.mjs  regex.mjs  length.mjs
│   └── invoice.mjs            # schema + line items sum to total
├── provenance.mjs             # model digest + prompt hash → canonical result → hash
├── templates/
│   └── invoice-json/
│       ├── template.json      # input description, check config
│       ├── prompt.md          # system prompt
│       └── samples/           # demo inputs (pass and fail)
├── quickstart/                # Masumi TUM starter (agent, worker, paid flow). Our hooks: check + provenance.
│   ├── agent/                 # Eve agent; instructions.md generated from the active template
│   ├── worker.mjs             # polls Sokosumi tasks
│   ├── paid-task.mjs          # escrow flow; calls check + provenance before submit-result
│   └── agent-api.mjs          # MIP-003 agent API
├── docs/
│   ├── runbook.md             # every manual command that worked, the source for pay/ and steps/
│   ├── verify.md              # how a buyer recomputes the result hash
│   └── evidence.md            # task IDs, tx hashes and seller receipts for the submission
└── .local/                    # (ignored) runtime state, journals, payment secrets
```

## Requirements

- Node.js **24+**, npm, Git
- [Sokosumi CLI](https://github.com/masumi-network/sokosumi/tree/main/apps/cli) **1.0.4** (pinned):
  `npm install --global @masumi_network/sokosumi@1.0.4`
- A system credential vault supported by the Sokosumi CLI
- Nothing else for the model: lokal installs [Ollama](https://ollama.com) or
  [llama.cpp](https://github.com/ggml-org/llama.cpp) if no model server is found.
  Plan for 2–5 GB of disk per model.
- Docker (for the Masumi Payment Service)
- A Sokosumi **preprod** account and a free [Blockfrost](https://blockfrost.io) preprod key

## Quick start

```sh
git clone https://github.com/jesuscbm/tum-hackathon.git lokal
cd lokal
npm ci
npx lokal
```

The TUI takes it from there.

### Manual setup (what lokal automates)

Use this path if you want to run the starter without the TUI:

```sh
cd quickstart
npm ci
cp .env.example .env && chmod 600 .env   # fill in the values listed below
npm start                                # terminal 1: agent
npm run worker                           # terminal 2: worker
npm run api                              # terminal 3: agent API (paid tasks only)
npm test
```

Run only one worker per Coworker. Full manual steps are in [`docs/runbook.md`](docs/runbook.md).

## Configuration

Secrets never go into git. lokal writes these for you. Only the **names** are listed here.

| File | Variables |
|---|---|
| `quickstart/.env` | `ZAI_API_KEY`, `ZAI_BASE_URL`, `ZAI_MODEL`, `ZAI_CONTEXT_WINDOW_TOKENS`, `BLOCKFROST_API_KEY_PREPROD`, `EVE_PORT`, `EVE_URL`, `COWORKER_ID`, `SOKOSUMI_ORGANIZATION_ID`, `SOKOSUMI_ORGANIZATION_SLUG`, `AGENT_AUTHOR`, `MPS_PORT`, `MPS_URL`, `AGENT_API_PORT`, `PAID_TASKS_ENABLED` |
| `quickstart/.local/mps.env` | `ADMIN_KEY` (payment service admin) |
| `quickstart/.local/mps-runtime.env` | `MPS_RUNTIME_TOKEN` (wallet-scoped key) |
| CLI vault | Coworker runtime key (never in files) |

lokal fills in the model settings for the runtime it set up:

| Runtime | `ZAI_BASE_URL` | `ZAI_API_KEY` | `ZAI_MODEL` |
|---|---|---|---|
| Ollama | `http://127.0.0.1:11434/v1` | `ollama` | e.g. `llama3.2:3b` |
| llama.cpp | `http://127.0.0.1:8080/v1` | `lokal` | the GGUF model name |

`ZAI_CONTEXT_WINDOW_TOKENS` is set to the context size lokal starts the server with (default `32768`).

## Status

The submission checklist asks us to keep what works separate from what is pending.

- [ ] lokal installs a runtime and downloads a model on a machine without one
- [ ] Local model answers a free Sokosumi task (TUM workspace)
- [ ] Payment service running, selling wallet funded, agent registered
- [ ] Paid task completed: tx hash + seller receipt in [`docs/evidence.md`](docs/evidence.md)
- [ ] Check gate: failing output is not submitted
- [ ] Provenance: on-chain `resultHash` matches the recomputed canonical result
- [ ] TUI wizard end to end
- [ ] Fresh-machine run: time from `npx lokal` to first paid job: **__ min**

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
