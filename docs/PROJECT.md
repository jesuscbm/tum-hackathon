# lokAl: everything the team needs to know

One page to read before the booth. State as of **Sat 31 Oct 2026, late morning**. The hard deadline is **15:00**,
and booth judging runs from 15:00 to 17:30. Details live in `README.md`, `AGENTS.md`, `docs/verify.md`,
`docs/mainnet.md` and `docs/evidence.md`.

---

## 1. The pitch in 30 seconds

lokAl turns a local language model into a **paid agent on Cardano** with one command. `curl … | sh` starts a
five-step terminal wizard (machine & model → job → Sokosumi → payments → live), and after that your laptop or
GPU server takes jobs on **Sokosumi** and gets paid through **Masumi escrow** on Cardano preprod.

There are two twists:
1. **Paid only if a check passes.** Every job has a deterministic check (JSON schema, invoice totals, regex,
   length). A failing result is **never submitted**, so the seller can't withdraw, and the buyer's escrow becomes
   refundable after the deadline.
2. **Provenance.** The on-chain result hash commits to the output, the check verdict, the prompt hash, the model
   name and the weights digest. The buyer can **re-run the check** (`lokal verify --recheck`) and catch a seller
   who lies about it.

**Customers:**
- **Sellers:** anyone with spare compute (gaming PC, lab server) who wants to earn without a cloud API.
- **Buyers:** anyone whose data shouldn't go to a large AI provider (privacy, data residency). An invoice
  processed by lokAl never leaves the seller's machine.

**Track:** Cardano, "Agentic Commerce on Cardano". The judges explicitly want: payment tied to the result
(escrow, refunds, pay-only-if-a-check-passed), a clear customer journey, a live preprod explorer demo.

---

## 2. How it works

```
 buyer (Sokosumi Task  or  MIP-003 agent API)
   │  1. payment request (seller-signed terms: price, deadlines, input hash)
   ▼
 Masumi escrow contract on Cardano ◀── 2. buyer locks funds (FundsLocked)
   │
 lokAl worker / agent API ── 3. sees FundsLocked ──▶ model (Ollama / API) ──▶ check gate
   │                                                                     │
   │   pass: 4a. submit-result (resultHash on-chain) → buyer gets result → after unlock: withdrawal to seller
   │   fail: 4b. nothing submitted → seller can never withdraw → refundable to the buyer after the result deadline
```

| Part | What it is | Where |
|---|---|---|
| TUI wizard + dashboard | Ink app, five steps, health map, jobs, earnings | `tui/app.mjs` |
| core | everything the UI calls (`createCore()`), mock with the same functions | `core/index.mjs`, `core/mock.mjs` |
| lokald | background supervisor, unix socket API; the UI attaches and detaches | `core/daemon.mjs`, `core/supervisor.mjs` |
| Agent (Eve) | runs the job prompt on the model, **no tools** (`defaultTools:false`) | `coworker/agent/agent.ts` |
| Worker | polls Sokosumi Tasks, runs the paid flow | `coworker/worker.mjs`, `coworker/paid-task.mjs` |
| Agent API | MIP-003 (`/start_job`, `/status`) for registry buyers and mainnet | `coworker/agent-api.mjs` |
| Check gate | runs the check, retries once, returns canonical result + hash | `coworker/lokal-gate.mjs`, `checks/` |
| Provenance | canonical JSON, hashes, `verifyResult`, `recheck` | `provenance.mjs` |
| Payment service | our own Masumi Payment Service (pinned commit) + Postgres | `pay/mps.mjs`, `pay/db.mjs` |
| Registry | registers the agent on Cardano | `pay/register.mjs` |

**Ports (all on 127.0.0.1):**

| Service | Port |
|---|---|
| Eve | 21949 |
| Agent API | 21950 |
| Payment service | 38127 |
| Postgres | 55432 |
| Ollama | 11434 |

**Escrow deadlines per job** (from when it's created):

| Deadline | Sokosumi Task | Agent API |
|---|---|---|
| Pay by | 5 min | 10 min |
| Submit result by | 20 min | 20 min |
| Unlock (seller can withdraw) | 36 min | 36 min |
| External dispute | 52 min | 52 min |

**Hashes:**
- Sokosumi Tasks commit `sha256(text)`.
- Agent-API jobs commit `sha256(nonce;text)`; in `lokal verify`, use `--nonce` for those.

---

## 3. Trust model (know this cold)

| Claim | What is true |
|---|---|
| "Buyer only pays if the check passes" | The **seller** runs the check, and a dishonest seller could skip it. But the verdict is in the on-chain hash, the check is deterministic, and the job is public: `lokal verify FILE HASH --recheck` proves a false "pass". That is a case for Masumi's dispute window. |
| "The result commits to the model weights" | The digest is the seller's **claim**: a binding commitment, not an attestation (no TEE). Lying is attributable, not impossible. |
| "The check guarantees quality" | Format and arithmetic only (schema, totals). An invented vendor name passes. |
| "Free prompts through `/start_job`?" | No. `/start_job` only creates a payment request; the model runs only after FundsLocked is **confirmed on-chain**, and `/status` returns the result only once ResultSubmitted is confirmed. It is rate-limited (60/min, 20 open). |
| "Free answers through Sokosumi Tasks?" | **Yes, in two cases** (see section 7, risk R5): paid jobs not enabled, or network = mainnet (Tasks are preprod). With paid jobs on, new Tasks *wait* until the registration is confirmed instead of being answered for free. Follow-up comments on a Task are answered without payment, at most 3 per Task (`LOKAL_MAX_FOLLOWUPS`). In the Personal Workspace only you can create tasks. |
| Prompt injection | The model has no tools; buyer input can't execute anything. |
| Keys | Selling and purchasing wallets live in **our own** payment database (self-custody). Secrets go over stdin, never into logs. The uninstaller asks before deleting the wallets. |

---

## 4. What is proven, and what isn't

**Proven on preprod** (see `docs/evidence.md`):
- Agent registration, tx `27d3b0f8af44874537ef4a5fbccb15c9338996279f80a231351fec342303af11`.
- Paid task `01a18e94-…` (1 test USDM, Llama 3.2 3B, invoice check passed):
  - FundsLocked: `bc6d593bb5dd5f62c84b611d577c38ea31a70297dbf2ae0b7fdf2da177c8b6e1`
  - ResultSubmitted: `7332dccf8073bf45c3d69430bbdae30837ed67f116fa3b16c45e8d21af3107bb`
  - `lokal verify` matches the on-chain hash.
- Llama 3.2 3B passes and fails the five invoice samples exactly as labelled.
- Installer, wizard, dashboard, `npm run smoke` (in CI).

**Not proven (say so if asked):**
- **Seller receipt / withdrawal** for that paid task: pending.
- **A failed check on a paid task** (no ResultSubmitted) and the **buyer's refund**: not run. This is our headline feature.
- `lokal buy`, ADA prices, mainnet, API and llama.cpp backends, registration of extra Coworkers, macOS on real
  hardware, the Docker auto-install on a real machine, the database watchdog during a real outage.
- Fresh-machine time from the install command to the first paid job: **not measured**.

⚠ **The video claims more than the evidence shows:** voice-over lines 12–13 ("Escrow released: paid",
"withdrawn to my wallet"). Either get the withdrawal tx before submitting, or change those lines.

⚠ **The demo machine was uninstalled** (`~/.local/share/lokal` only has `bin/` and `logs/`). The demo needs a
fresh install → step 4 → registration again. Plan about an hour.

---

## 5. Demo script (booth, about 3 min)

1. **Problem** (15 s): selling on Cardano means Masumi, Sokosumi, Blockfrost, wallets, keys, Postgres.
2. **Install** (show, don't wait): `curl -fsSL https://raw.githubusercontent.com/jesuscbm/lokAl/main/install.sh | sh`
3. **Wizard** (`lokal`): step 1 shows the hardware and model, step 2 the invoice job with `t` (try a sample:
   one that passes, one that fails, `s` for the next sample), and step 3/4 already done (✔).
4. **Dashboard** (`d`): health map, a job in the list, earnings.
5. **Explorer:** have the three tx links above open in tabs.
6. **Verify:** `lokal verify result.json <hash>`, then the **recheck demo with a forged result** (in the repo: a
   "seller" committed pass for a total of 78 € on 2 × 3.90 €):
   ```sh
   lokal verify docs/examples/forged-result.json 41554f4bcfa90060d4d98b98b6344dd26bf43de6b4d63e702e0a44d77c4a8d7e --recheck
   # ✔ hash matches … ✖ check re-run here: invoice fails (the seller claimed pass, the check says fail: $.total: 78 ≠ line items + tax = 7.8)
   ```
7. **Next:** attestation, reputation from rechecks, agents hiring lokAl agents, mainnet.

Fallback: `node bin/lokal.mjs --mock` shows the full UI with fake data, no network needed.

---

## 6. Commands cheat sheet

```sh
lokal                         # wizard / dashboard  (keys: w wizard, d dashboard, c coworkers, i info, l logs, q quit)
lokal status | doctor | info  # setup state · one line per layer · ids, wallet, links
lokal up / lokal down         # start lokald and follow logs / stop everything
lokal run machine|job ID|sokosumi|pay|live
lokal price 2 ADA             # what buyers pay per job (USDM or ADA)
lokal workspace [SLUG]        # Personal or an organization Workspace
lokal coworker rename "Name"  # the name buyers see (unique on Sokosumi)
lokal buy "input"             # be your own buyer via the agent API (real payment)
lokal verify FILE HASH [--nonce HEX] [--recheck]
lokal wallet [export --out F] # balance / recovery phrase (asks first)
lokal set BLOCKFROST_API_KEY_PREPROD   # value on stdin
lokal uninstall [--yes]       # asks before deleting the wallets
node bin/lokal.mjs --mock     # fake data, touches nothing
```

**Wizard keys per step:**

| Step | Keys |
|---|---|
| 1 Machine & model | `m` next model, `b` model source |
| 2 Job | ←/→ template, `s` next sample, `t` try, `y` your own input, `p` price, `f` import .md |
| 3 Sokosumi | `e` Coworker name, `o` Workspace, `b` sign-in link (SSH) |
| 4 Payments | `n` network, `f` faucet, `v` wallet QR |
| 5 Live | enter starts services, `t` test job |

**Development:** `npm ci && (cd coworker && npm ci)`, `npm test`, `(cd coworker && npm test)`, `npm run smoke`.
Fresh install from the checkout: `LOKAL_SRC=$PWD LOKAL_NO_START=1 sh install.sh`.

---

## 7. Risks and gotchas

| # | Risk | What to do |
|---|---|---|
| R1 | Demo machine has no install; registration takes ~7 min, the payment service install several minutes | Reinstall now, not at 14:30 |
| R2 | Failed-check paid task not proven | Run it: Sokosumi task with input that fails, e.g. the `fail-bad-total` sample |
| R3 | Withdrawal not proven, but the video claims it | Wait for unlock (36 min after the paid task) and check the selling wallet, or change the video |
| R4 | Wi-Fi at the booth | `--mock` fallback, explorer tabs open early, screenshots in evidence.md |
| R5 | Sokosumi Tasks are answered for free when paid jobs aren't enabled, or on mainnet; up to 3 free follow-ups per Task | Personal Workspace: only you can create tasks. Keep the demo Coworker in the Personal Workspace |
| R6 | Coworker name taken on Sokosumi (409) | lokAl retries with a suffix; or `e` in step 3 |
| R7 | Payment database stopped | lokald starts it again within 15 s; step 4 shows it red |
| R8 | Sokosumi CLI must be exactly 1.1.0 | The installer pins it |
| R9 | `fetchCostModels is not a function` in the payment-service log | Harmless; hidden from the UI |

**Never do** (from `AGENTS.md`):
- print or commit `coworker/.env`, `.local/`, `docs/*.json` or the vault
- run two workers per Coworker
- switch to mainnet or fund it without agreeing as a team first
- claim payment without a seller receipt.

---

## 8. Judge questions with short answers

1. **"You run the check yourself, why trust it?"** It's deterministic and public, and the verdict is in the
   on-chain hash. Buyers run `--recheck`; a false "pass" is provable, which is grounds for a dispute. *Show the
   faked result.*
2. **"How do I know it was Llama, not GPT-4?"** You don't know for certain: the digest is a binding commitment,
   not an attestation. Hardware attestation is next.
3. **"What happens to my money if the check fails?"** Nothing is submitted, the seller can't withdraw, and it's
   refundable after the result deadline (20 min). *If the run is still open: the code path is built, not yet run
   on preprod.*
4. **"Hallucinations?"** Format and arithmetic are guaranteed, the content isn't.
5. **"Why pay for a slow 3B model?"** Privacy and data residency. Sellers set their own price (`lokal price`).
6. **"Who's the customer?"** Sellers with idle compute; buyers with data that must not go to a cloud AI
   provider (e.g. a small accounting firm's invoices).
7. **"Free prompts through the API?"** No. The model runs only after funds are confirmed locked on-chain, the
   result is returned only after it's submitted on-chain, and requests are rate-limited.
8. **"Isn't `lokal buy` paying yourself?"** Yes: it's a self-test of the MIP-003 path. The real paid job ran
   through Sokosumi.
9. **"Why your own payment service?"** Self-custody: the keys stay with the seller, and nothing depends on a
   third party. The installer sets it all up.
10. **"What's on chain?"** The registry entry, the escrow lock, the result hash, the withdrawal or refund. *Open
    the tx links.*
11. **"Prompt injection?"** The model has no tools; everything listens on 127.0.0.1 only.
12. **"Crashes?"** lokald restarts services and the database. Payment steps whose outcome is uncertain are never
    retried automatically, so nothing gets paid twice.
13. **"Mainnet?"** Built, with a guide (`docs/mainnet.md`), but not run with real money; we chose not to risk it
    before the deadline.
14. **"Install to first paid job?"** *Measure it.* Registration alone is ~7 min on preprod.
15. **"What doesn't work?"** Answer straight: withdrawal pending, refund unverified, mainnet untested.
16. **"What next?"** Attestation, reputation from rechecks, agents hiring lokAl agents.

---

## 9. Team

From `docs/CONTEXT.md`, a team of four:

| Who | Role | Owns at the booth |
|---|---|---|
| J | systems | demo machine, setup and on-chain questions |
| T | maths | provenance, hashes, trust model (questions 1–4) |
| M | business | pitch, customers, pricing (questions 5, 6, 16) |
| F | informatics | architecture, code questions (questions 7, 11, 12) |

**Submission checklist:**
- [ ] video ≤ 2.5 min with an explorer link
- [ ] public repo + README with setup
- [ ] Devfolio text: how it works, Cardano tools used, real-world use
- [ ] evidence: Task ID + payment tx + seller receipt kept together; what works kept apart from what's pending.
