# AGENTS.md: handoff for coding agents

Read this first, then `README.md` (product, structure) and `docs/CONTEXT.md` (hackathon rules and deadlines).
`coworker/AGENTS.md` holds the Masumi starter's own rules; they still apply inside `coworker/`.

## What this is
**lokal** turns a local LLM into a paid agent on Sokosumi (Masumi escrow on Cardano **preprod**) from one terminal UI:
`install.sh` → `lokal` → 5-step wizard (machine & model → job → Sokosumi → payments → live) → dashboard.
Two product twists: a deterministic **check gates payment** (failed results are never submitted, so the buyer is not
charged), and the on-chain result hash commits to the **model weights digest and prompt hash** (`provenance.mjs`).

## Run and test (any machine: Linux/macOS, Node 24)
```sh
npm ci && (cd coworker && npm ci)
npm test                      # root: checks, provenance, templates
(cd coworker && npm test)     # starter + lokal gate
npm run smoke                 # clean-room: installs from this checkout into a temp HOME, no accounts needed
node bin/lokal.mjs --mock     # full UI with fake data; touches nothing
node bin/lokal.mjs status     # real, read-only
```
CI (`.github/workflows/ci.yml`) runs all of the above on ubuntu with Node 24.22.1. Keep it green.
Use `node --test test/*.test.mjs` (Node 24 does not accept a bare directory).
Never require anything from the developer's machine: no absolute paths, no personal IDs, no pre-existing `.env`.
Use `LOKAL_HOME` and `LOKAL_COWORKER_DIR` to point lokal at scratch folders when testing real steps.

## Architecture contracts (keep them stable)
- **UI ↔ engine:** the TUI (`tui/app.mjs`) only calls `createCore()` from `core/index.mjs`; `core/mock.mjs` must expose
  the same functions. Add a function to both or to neither.
- **Step module** (`core/steps/*.mjs`): exports `id`, `title`, `async status()` → `{id,title,status,items:[{label,status,detail,command?,input?,tx?}],…}`
  and `async run(opts)`. Statuses: `ok | todo | running | action | input | fail | warn`. `run()` is idempotent and stops
  without throwing at the next human action.
- **Events** (`core/events.mjs` `bus`): `log {source,line,level}`, `progress {id,label,pct}`, `step`, `job`, `services`, `try`.
- **Config:** `coworker/.env` is written only through `writeEnv()` (merges keys, mode 600). Users never edit it.
  lokal's own state is `~/.local/share/lokal/config.json` (`loadConfig/saveConfig`).
- **Gate** (`coworker/lokal-gate.mjs`): active only when `LOKAL_TEMPLATE` is set. Returns `{text,pass,check,tries,hash}`;
  `text` is the canonical JSON from `provenance.canonicalResult()`, so `sha256(text)` is the Masumi `resultHash`.
  `paid-task.mjs` stops at stage `check-failed` when `pass === false` and never calls submit-result.
- **Jobs feed** (`core/jobs.mjs`) reads the worker journals `coworker/.local/<taskId>.json` (+ `.txt`).
- **Templates** (`templates/<id>/template.json` + `prompt.md` + `samples/{pass,fail}-*.txt`); custom ones go to
  `$LOKAL_HOME/templates`. Check types live in `checks/index.mjs` (`CHECK_TYPES`).

## Style
Plain ES modules (`.mjs`), Node 24, **no build step**. Ink components use `htm` (`tui/html.mjs`), not JSX.
Terse code that matches `coworker/*.mjs`; comments only for the non-obvious. Exact-pinned dependencies; add one only
if it removes real work. Pinned externals: Node `v24.22.1`, Sokosumi CLI `1.0.4`, pnpm `10.30.2`,
Masumi Payment Service commit `a846392…` (`pay/mps.mjs`), Ollama `v0.40.13` (`core/runtime/ollama.mjs`), `postgres:16`.

## Safety rules
- Never read, print or commit `coworker/.env`, `coworker/.local/`, `docs/*.json`, `~/.local/share/lokal/mps-seed.log`
  (wallet mnemonics) or the Sokosumi CLI vault. Secrets go over stdin, never argv or logs.
- **One worker per Coworker.** Never start a second one; never kill processes lokal did not start
  (the supervisor marks those `external` and leaves them alone).
- External writes need the user's go-ahead: creating Vendors/Coworkers/Tasks, Workspace connects, registry
  registration, dispenser requests. Preprod only; never mainnet.
- Don't claim payment without evidence: a completed Task is not a seller receipt (see `settlement.mjs`, `docs/evidence.md`).

## Status (2026-10-30, evening)
Verified on a real machine:
- Llama 3.2 3B (Ollama, CPU) passes/fails the 5 invoice samples exactly as labelled; Eve agent runs on Ollama.
- Steps 1–2 end to end (scratch coworker dir); TUI wizard + dashboard (real and mock); `status`, `verify`.
- Installer from a local checkout into an empty HOME (private Node, sha256-checked); `npm run smoke`.
- Payment service **phase A** (Postgres container, pinned checkout, private pnpm, install, migrate).

Written, not yet run for real:
- Payment service phase B (`prisma:seed` → wallets; needs the Blockfrost key), `recordPaymentState()` (response shape
  of `/payment-source` is a best guess: check it), dispenser request, registration, paid task.
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
- `coworker/agent/instructions.md` and `agent/tender-brief-template.md` are leftovers from an earlier idea
  (TenderLens). Step 2 overwrites `instructions.md` (backup `*.before-lokal`). Eve may hot-reload `agent/` edits,
  so don't edit it under a running agent you don't own.
- `qrcode` `utf8` output crashes with a `margin` option; Ctrl-D arrives in Ink as `ctrl+d` (ignored on purpose).
- The payment service needs Node ≥24.22.1 <25 and calls `pnpm` from its own scripts (hence the private pnpm on PATH);
  corepack is gone from Node 25+.
- Ollama's Linux release is `.tar.zst` (needs `zstd`) and ~1.5 GB.
- Sokosumi CLI occasionally returns `{error,code}` transiently; status calls tolerate it.
