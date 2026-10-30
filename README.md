# lokAl

Run a local language model (or any OpenAI-compatible API) as a paid agent on Sokosumi using Masumi escrow on Cardano preprod (mainnet opt-in). Works the same on a laptop and on a server over SSH.

## Setup

Requirements: Linux or macOS (x64 or arm64), `curl`, `tar`, Docker, a Sokosumi preprod account, and a Blockfrost preprod key. Lokal installs Node.js and can install Ollama if needed. Allow 2–5 GB per model. No browser or desktop keyring is needed on servers.

One command does the whole ride: install, then the setup wizard starts in the same terminal.

```sh
curl -fsSL https://raw.githubusercontent.com/jesuscbm/lokAl/main/install.sh | sh
```

Follow the terminal prompts to choose a model and job, sign in to Sokosumi, enter the Blockfrost key, and start the services.

- **Model (step 1):** Ollama with a model that fits your hardware (up to 70B on large GPUs), or press `b` for any Ollama tag, an OpenAI-compatible API (OpenAI, OpenRouter, Groq, Mistral, vLLM, LM Studio) or a llama.cpp server.
- **Over SSH (step 3):** paste a Sokosumi API key from <https://preprod.sokosumi.com/connections>, or press `b` for a sign-in link to open on your laptop through an SSH tunnel. Without a keyring, credentials are kept in `~/.local/share/lokal/vault/` (mode 600).
- **Background services:** the agent, worker, agent API and payment service run in `lokald`. Quit the UI or disconnect at any time; `lokal` reopens the dashboard, `lokal down` stops everything, `lokal daemon enable` survives reboots (systemd user unit).

To uninstall, run:

```sh
lokal uninstall
```

## Usage

The built-in `invoice-json` job converts an invoice to JSON and checks its schema and totals. In the terminal UI, choose the job and submit a sample or live task.

Jobs can also be Markdown files: front matter for `name`, `check` (`none|json|schema|regex|length|invoice`, with `schema`/`pattern`/`min`/`max`) and `price`, the body is the prompt. Import with `i` in step 2 or `lokal prompt add FILE.md`; see [docs/examples](docs/examples).

Several jobs can run side by side, each as its own Sokosumi Coworker sharing the model and wallet (`c` in the UI, or `lokal coworker add NAME --prompt FILE.md`, `lokal coworker remove ID [--retire]`).

The dashboard shows earnings, machine load (CPU, RAM, GPU) and a health map of the parts with a light each and a pulse on links carrying traffic. `i` (or `lokal info`) shows your wallet address, agent identifier, Coworker IDs and explorer links.

Useful commands:

```sh
lokal                  # setup wizard or dashboard
lokal status           # setup status
lokal doctor           # diagnose services
lokal verify           # verify a result hash
lokal up               # start lokald and follow its logs (Ctrl+C detaches)
lokal down             # stop lokald and its services
lokal info             # wallet, agent and Coworker IDs, links
lokal model api URL MODEL   # use an OpenAI-compatible API (key on stdin)
lokal login            # Sokosumi API-key sign-in (key on stdin)
lokal network mainnet  # switch networks (asks for confirmation)
lokal wallet export    # selling wallet recovery phrase (asks first)
lokal run machine      # configure model runtime
lokal run job invoice-json
lokal run sokosumi     # connect Sokosumi
lokal run pay          # configure payments and registry
```

For headless setup, pass the Blockfrost key through stdin:

```sh
echo "$BLOCKFROST_API_KEY_PREPROD" | lokal set BLOCKFROST_API_KEY_PREPROD
```

## How payments work

Templates can define deterministic checks, such as a JSON schema or numeric constraints. The worker checks the result before submission. It retries a failed result once, then withholds it; the buyer may reclaim funds after the escrow deadline. A passing result is submitted to Masumi escrow.

The on-chain result hash covers canonical result data, including the output, prompt hash, model name, and weights digest when available. Checks validate format and constraints, not factual correctness. Remote model endpoints do not provide a verifiable weights digest. See [result verification](docs/verify.md).

## Status

- [x] Llama 3.2 3B via Ollama passes the 3 passing invoice samples and fails the 2 failing ones (CPU, 15–35 s each).
- [x] The Coworker Eve agent runs on the local model (Ollama OpenAI-compatible endpoint).
- [x] Steps 1–2 run end to end against a scratch Coworker copy (model detection, smoke test, template selection, try-it).
- [x] TUI wizard and dashboard in real and mock modes; `lokal status` and `lokal verify`.
- [x] Installer tested from a local checkout into an empty home (private Node 24, SHA-256 verified).
- [x] `npm run smoke`: clean-room install, CLI and tests without accounts or keys (also in CI).
- [x] Payment service phase A: Postgres in Docker, pinned checkout, installation and migration.
- [ ] Ollama auto-install on a machine without it (implemented, not tested).
- [ ] Local model answers a free Sokosumi task through the gate.
- [ ] Payment service phase B: wallet setup, test ADA and agent registration (implemented, not tested).
- [ ] Paid task completed with transaction hash and seller receipt in [docs/evidence.md](docs/evidence.md).
- [ ] Check gate verified on a paid task; failing output is not submitted.
- [ ] Fresh-machine run and time to first paid job: not measured.
- [x] lokald background service, file vault and API-key login for SSH, extra Coworkers, Markdown jobs, `lokal info`, health map (unit tests, mock and scratch folders).
- [ ] API and llama.cpp backends, extra Coworker registration, and mainnet against real services (implemented, not tested).

## Limits

- Preprod by default. Mainnet is implemented but untested with real funds; Sokosumi Tasks stay on preprod (the CLI's Coworker runtime is preprod-only), so mainnet buyers use the MIP-003 agent API, which needs a public URL (`lokal set AGENT_PUBLIC_URL`).
- Docker is required for the Masumi Payment Service and its Postgres database.
- Runtime auto-install supports Linux and macOS. On Windows, install Ollama separately.
- Refunds depend on Masumi escrow deadlines.

## Run from source

Requires Node.js 24.

```sh
git clone https://github.com/jesuscbm/tum-hackathon.git lokal
cd lokal
npm ci
cd coworker && npm ci && cd ..
node bin/lokal.mjs
node bin/lokal.mjs --mock
```

See [docs/runbook.md](docs/runbook.md) for command details. Built at the TUM Blockchain & AI Hackathon 2026, using [Sokosumi](https://preprod.sokosumi.com), Masumi, and Blockfrost.
