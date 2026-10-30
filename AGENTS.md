# AGENTS.md: handoff for coding agents

Read this first, then `README.md` (product, structure) and `docs/CONTEXT.md` (hackathon rules and deadlines).
`coworker/AGENTS.md` holds the Masumi starter's own rules; they still apply inside `coworker/`.

## What this is
**lokAl** turns a local LLM into a paid agent on Sokosumi (Masumi escrow on Cardano **preprod**) from one terminal UI:
`install.sh` → `lokal` → 5-step wizard (machine & model → job → Sokosumi → payments → live) → dashboard.
Services run in **lokald** (background supervisor); the UI attaches and detaches. Works over SSH (no browser/keyring).
Two product twists: a deterministic **check gates payment** (failed results are never submitted, so the buyer is not
charged), and the on-chain result hash commits to the **model weights digest and prompt hash** (`provenance.mjs`).

## Run and test (any machine: Linux/macOS, Node 24)
```sh
npm ci && (cd coworker && npm ci)
npm test                      # root: checks, provenance, templates
(cd coworker && npm test)     # starter + lokal gate
npm run smoke                 # clean-room: install (LOKAL_NO_START=1) + CLI + tests + uninstall in a temp HOME
node bin/lokal.mjs --mock     # full UI with fake data; touches nothing
node bin/lokal.mjs status     # real, read-only
```
CI (`.github/workflows/ci.yml`) runs all of the above on ubuntu with Node 24.22.1. Keep it green.
Use `node --test test/*.test.mjs` (Node 24 does not accept a bare directory).
Never require anything from the developer's machine: no absolute paths, no personal IDs, no pre-existing `.env`.
Use `LOKAL_HOME` and `LOKAL_COWORKER_DIR` to point lokAl at scratch folders when testing real steps, and
`LOKAL_DB_CONTAINER` so a test never touches the real `lokal-mps-db` container (uninstall.sh deletes it).
In a throwaway VM: `uninstall.sh --all` then the curl installer gives a true from-scratch run.

## Architecture contracts (keep them stable)
- **UI ↔ engine:** the TUI (`tui/app.mjs`) only calls `createCore()` from `core/index.mjs`; `core/mock.mjs` must expose
  the same functions. Add a function to both or to neither (`test/core-parity.test.mjs` enforces it).
- **lokald** (`core/daemon.mjs`): `lokal daemon run` hosts the supervisor and serves JSON over a unix socket
  (`$LOKAL_HOME/lokald.sock`, or a short path in `$XDG_RUNTIME_DIR` when that is too long): `GET /status /services
  /logs /events(SSE)`, `POST /start {id?} /stop {coworker?} /restart {id?} /shutdown`. UI/CLI service control goes
  through `core/services.mjs`, which starts lokald on demand. Quitting the UI never stops services; `lokal down` does.
- **Service ids:** `agent|worker|api` for the main Coworker, `agent@<id>` etc. for extra ones, `mps` (shared).
  `supervisor.start()` de-duplicates in-flight starts and `startAll()` is serialized (never two workers).
- **Coworkers** (`core/coworkers.mjs`): main = `COWORKER_DIR`; extras = `$LOKAL_HOME/coworkers/<id>/` with own
  `.env`/`.local`/`docs`/`agent/instructions.md`/ports, code symlinked from `coworker/` (package.json and agent.ts are
  copies: Eve needs real files). `sharedEnv()` passes main's model/Workspace/payment keys to extras at spawn
  (`--env-file` never overrides set variables), unless the extra's `.env` sets them.
- **Network** (`core/network.mjs`): `LOKAL_NETWORK=preprod|mainnet` in main `.env`, read by core, pay/ and coworker/.
  `pay.setNetwork()` moves each network's `docs/*.json` + `.local/mps-runtime.env` to `docs|.local/<network>/`.
  Sokosumi CLI calls stay `--preprod` (its Coworker runtime is preprod-only); mainnet paid jobs use `agent-api.mjs`.
- **Headless** (`core/vault.mjs`): `setupHeadless()` runs first in every process; without a working libsecret it puts a
  file-backed `secret-tool` on PATH (`$LOKAL_HOME/vault`), and over SSH an `xdg-open` that records URLs.
- **Step module** (`core/steps/*.mjs`): exports `id`, `title`, `async status()` → `{id,title,status,items:[{label,status,detail,command?,input?,tx?}],…}`
  and `async run(opts)`. Statuses: `ok | todo | running | action | input | fail | warn`. `run()` is idempotent and stops
  without throwing at the next human action.
- **Events** (`core/events.mjs` `bus`): `log {source,line,level}`, `progress {id,label,pct}`, `step`, `job`, `services`, `try`.
- **Config:** `coworker/.env` is written only through `writeEnv()` (merges keys, mode 600). Users never edit it.
  lokAl's own state is `~/.local/share/lokal/config.json` (`loadConfig/saveConfig`).
- **Gate** (`coworker/lokal-gate.mjs`): active only when `LOKAL_TEMPLATE` is set. Returns `{text,pass,check,tries,hash}`;
  `text` is the canonical JSON from `provenance.canonicalResult()`, so `sha256(text)` is the Masumi `resultHash`.
  `paid-task.mjs` stops at stage `check-failed` when `pass === false` and never calls submit-result.
- **Jobs feed** (`core/jobs.mjs`) reads every Coworker's journals: `.local/<taskId>.json` (+ `.txt`) and MIP-003 jobs in
  `.local/standard-jobs/`.
- **Templates** (`templates/<id>/template.json` + `prompt.md` + `samples/{pass,fail}-*.txt`); custom ones go to
  `$LOKAL_HOME/templates` as folders or single `.md` files with front matter (`templateFromMarkdown()`).
  Check types live in `checks/index.mjs` (`CHECK_TYPES`).
- **Gate on the MIP-003 path too:** `agent-api.mjs` runs answers through the gate and never submits a failed check.

## Style
Plain ES modules (`.mjs`), Node 24, **no build step**. Ink components use `htm` (`tui/html.mjs`), not JSX.
Terse code that matches `coworker/*.mjs`; comments only for the non-obvious. Exact-pinned dependencies; add one only
if it removes real work. Pinned externals: Node `v24.22.1`, Sokosumi CLI `1.0.4`, pnpm `10.30.2`,
Masumi Payment Service commit `a846392…` (`pay/mps.mjs`), Ollama `v0.40.13` (`core/runtime/ollama.mjs`), `postgres:16`.

## Safety rules
- Never read, print or commit `coworker/.env`, `coworker/.local/`, `docs/*.json`, `~/.local/share/lokal/mps-seed.log`
  (wallet mnemonics) or the Sokosumi CLI vault. Secrets go over stdin, never argv or logs.
- **One worker per Coworker.** Never start a second one; never kill processes lokAl did not start
  (the supervisor marks those `external` and leaves them alone).
- External writes need the user's go-ahead: creating Vendors/Coworkers/Tasks, Workspace connects, registry
  registration, dispenser requests, retiring Coworkers. The UI/CLI confirm these; agents must ask the user.
- Mainnet is supported in code for users. Agents never switch to it, fund or register on it themselves.
- Never run `lokal wallet export` (prints a recovery phrase) or read `$LOKAL_HOME/vault/`.
- Don't claim payment without evidence: a completed Task is not a seller receipt (see `settlement.mjs`, `docs/evidence.md`).

## Status (2026-10-30, night): added, verified only with tests, mock and scratch folders
- lokald + reattaching UI; `lokal up/down/daemon`; smoke test covers start/status/down.
- Headless: file vault (Sokosumi CLI `auth login --api-key-stdin` / `auth status` verified against it), OAuth link capture.
- Extra Coworkers: an extra Coworker's Eve started under lokald and answered through the gate (scratch dirs).
- Model backends: any Ollama tag, OpenAI-compatible APIs (presets), llama.cpp; bigger GPU models in `models.json`.
- Markdown prompts, `lokal info`, `lokal wallet export`, mainnet switch, dashboard health map and machine load.
Not yet run for real: Sokosumi registration of an extra Coworker, registry for extras, any API backend, mainnet.

## Status (2026-10-30, evening)
Verified on a real machine:
- Llama 3.2 3B (Ollama, CPU) passes/fails the 5 invoice samples exactly as labelled; Eve agent runs on Ollama.
- Steps 1–2 end to end (scratch coworker dir); TUI wizard + dashboard (real and mock); `status`, `verify`.
- Installer from a local checkout into an empty HOME (private Node, sha256-checked); `npm run smoke`.
- Payment service phase A and B: Postgres, pinned checkout, install, migrate, seed (wallets created), service running,
  selling wallet recorded to `coworker/docs/payment-state.json`.

- Step 4 end to end on preprod: wallets seeded, automatic test ADA from the dispenser, agent registered
  (tx 27d3b0f8…, see `docs/evidence.md`), ~7 min from start to `RegistrationConfirmed` after the fixes.

Written, not yet run for real:
- A paid task (escrow lock → gated answer → submit-result → withdrawal) and a check-failed paid task.
- Step 3 creating a *new* Vendor/Coworker/runtime key and `o` (organization Workspace connect).
- Ollama auto-install on a machine without it; `lokal up`; supervisor restart behaviour.

## Next steps (in order)
1. With the user's OK: stop any worker already running for the Coworker, then `lokal run machine`,
   `lokal run job invoice-json`, `lokal up`, and send a free test task (`t` in step 5). Confirm the result verifies.
2. `lokal set BLOCKFROST_API_KEY_PREPROD`, `lokal run pay`; fix whatever phase B / registration breaks.
3. Paid task with a passing sample (tx hashes + seller receipt into `docs/evidence.md`), then a failing sample
   (must end `check-failed`, no ResultSubmitted). Ask a Masumi mentor how the buyer's refund is triggered.
4. Fresh-machine run via the curl installer (repo must be public); record the time to first paid job.
5. Polish: `lokal doctor` false "model down" for cloud endpoints; long statuses wrap in the job list; llama.cpp install.

## Known gotchas
- Payment DB backend (`pay/db.mjs`) is recorded once as `LOKAL_DB_BACKEND` in `.local/mps.env` (installs without it are
  Docker). Native = `$LOKAL_HOME/pgdata`, TCP 127.0.0.1:55432 only; the supervisor runs `mps.ensureDb()` before the
  payment service starts (a native cluster does not restart itself after a reboot). Tested in the postgres:16 image.
- macOS: the Sokosumi CLI uses the Keychain natively (no `secret-tool` stand-in possible); over SSH it must be unlocked.
  `lokal daemon enable` writes `~/Library/LaunchAgents/network.lokal.lokald.plist`. Never run on a real Mac yet.
- Unix socket paths max ~107 bytes (deep scratch `LOKAL_HOME`s fall back to `$XDG_RUNTIME_DIR`).
- Extra Coworkers run code through symlinks: main-module checks must compare realpaths (`coworker/start.mjs`), and
  Eve only treats a real `package.json` file as its project marker.
- `coworker/agent/instructions.md` and `agent/tender-brief-template.md` are leftovers from an earlier idea
  (TenderLens). Step 2 overwrites `instructions.md` (backup `*.before-lokal`). Eve may hot-reload `agent/` edits,
  so don't edit it under a running agent you don't own.
- `qrcode` `utf8` output crashes with a `margin` option; Ctrl-D arrives in Ink as `ctrl+d` (ignored on purpose).
- The payment service needs Node ≥24.22.1 <25 and calls `pnpm` from its own scripts (hence the private pnpm on PATH);
  corepack is gone from Node 25+. `core/node24.mjs` gives it that Node even when lokAl runs on a newer one
  (private copy in `~/.local/share/lokal/node`, sha256-checked).
- Run the service with `pnpm exec tsx ./src/index.ts`, not `pnpm run dev` (`tsx watch` restarts it and drops locks).
- A fresh payment source replays the shared escrow contract's entire history (every team's txs; ~96 batches, ~30 min)
  while holding the sync lock, so nothing registers meanwhile. `mps.skipContractHistory()` sets
  `lastIdentifierChecked` to the contract's newest tx before the first start; our wallets are new, so no data is lost.
- Ollama's Linux release is `.tar.zst` (needs `zstd`) and ~1.5 GB.
- `sokosumi tasks list` defaults to `--scope owned` (tasks *you* created). The worker lists with `--scope workspace`
  (`coworker/task-target.mjs`) so it also serves tasks other Workspace members create for the Coworker.
- Sokosumi CLI occasionally returns `{error,code}` transiently; status calls tolerate it.
- MPS (a846392) API shapes: `/payment-source-extended` lists sources with wallet *counts* only; selling wallets come
  from `/wallet/list?walletType=Selling&paymentSourceId=…`. Health is `/api/v1/health`.
- The seed copies the Blockfrost key into the payment source (DB). A changed key must be PATCHed to
  `/payment-source-extended` (`syncBlockfrostKey()`). Blockfrost keys are network-prefixed: preprod keys start with `preprod`.
- Registration (and payments) only run while `PaymentSource.syncInProgress=false`. A killed instance leaves it `true`
  and the service waits `SYNC_LOCK_TIMEOUT_INTERVAL` (default 300 s; lokAl sets 30) — in practice it stayed stuck, so
  the supervisor runs `mps.clearStaleLocks()` before every start. The "No payment contracts found … an other instance"
  warnings come from the V1/V2 *registry* tx-sync and are harmless noise.
- The payment service needs ~5 s to shut down; the supervisor waits for the process group to exit before restarting.
- The payment service logs a heartbeat every second; the supervisor marks those lines `debug` (file only, not the UI).
