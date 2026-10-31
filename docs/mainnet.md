# Testing on mainnet

Mainnet moves **real ADA**. lokAl's mainnet path has not been run with real funds yet. It is the same code
as on preprod with other network constants (`core/network.mjs`), so first rehearse the exact flow on preprod
(section 1). It costs nothing there.

How it works on mainnet: Sokosumi Tasks stay on preprod (the Sokosumi CLI's Coworker runtime is preprod-only).
Paid mainnet jobs come in through the **agent API** (MIP-003, `coworker/agent-api.mjs`), which the Masumi
registry lists under your public URL. To test without an outside buyer, **`lokal buy` makes you your own buyer**:
it hires your agent through that API and pays from the payment service's purchasing wallet. That wallet is
created next to your selling wallet. This is the same escrow flow an outside buyer goes through.

## What you need

| | Amount | Why |
|---|---|---|
| Blockfrost **mainnet** project id | free, [blockfrost.io](https://blockfrost.io) → new project → *Cardano mainnet* | starts with `mainnet` |
| Selling wallet | **≥ 5 ADA** | registration tx + min-ADA of the registry entry, submit-result and withdrawal fees |
| Purchasing wallet (only for `lokal buy`) | **≥ 5 ADA + the price** | lock tx fee, collateral, the escrow output's min-ADA |
| Public https URL to the agent API | free with a Cloudflare tunnel | written into your on-chain registry entry |

Budget about **15 ADA** in total for one registration and a few test purchases. Most of it stays in your two
wallets. Price test jobs in **ADA** (`lokal price 2 ADA`, or `p` in setup step 2), so you don't have to buy USDM first.

## 1. Rehearse on preprod (same flow, test ADA)

With step 4 done on preprod (registered, `lokal up` running):

```sh
lokal price 2 ADA                           # price in ADA: no test USDM needed
lokal buy "Invoice 17 from ACME, 2 x coffee at 3.90 EUR, total 7.80 EUR"
```

The first run prints the purchasing wallet and stops with "needs 7 tADA". Get test ADA for that address
at <https://dispenser.masumi.network/>, then run `lokal buy` again. It asks before locking funds. After that it
follows the job:

```
✔ Job 3f…: purchase requested, result due by 10:42:00.
  agent: awaiting_payment · escrow: not on chain yet
  tx https://preprod.cardanoscan.io/transaction/…
  agent: running · escrow: FundsLocked
  agent: completed · escrow: ResultSubmitted
{ …canonical result JSON… }
✔ the result matches the on-chain resultHash
```
(This is the expected shape of the output. `lokal buy` is new and has not been run against a live payment
service yet, so the first real run is part of the test. Report anything that differs.)

It takes about 3–6 minutes. If it worked on preprod, the mainnet run below goes through the same steps.

## 2. Switch to mainnet

```sh
lokal network mainnet                       # type "mainnet" to confirm; preprod wallet + registration are kept
lokal set BLOCKFROST_API_KEY_MAINNET        # paste the mainnet project id (hidden input)
lokal price 2 ADA
```

## 3. Public URL (Cloudflare tunnel, no open ports)

The agent API listens on `127.0.0.1:21950`. A tunnel gives it an https URL without opening a port
(install `cloudflared` from your package manager or its GitHub releases):

```sh
cloudflared tunnel --url http://127.0.0.1:21950    # prints https://<random>.trycloudflare.com
echo "https://<random>.trycloudflare.com" | lokal set AGENT_PUBLIC_URL
```

Your registry entry records this URL on-chain. A quick tunnel gets a new random URL every time it restarts,
and then outside buyers can't reach you (`lokal buy` still works, because it calls the API locally). For anything
longer than a test, use a [named tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)
or a reverse proxy on your own domain *before* you register. Without a tunnel you can also run
`lokal set AGENT_API_HOST` → `0.0.0.0` and open port 21950 yourself.

## 4. Wallets and registration

```sh
lokal run pay        # creates the mainnet wallets, then stops at "send ≥ 5 ADA to it"
lokal info           # shows the selling wallet address (also as a QR code in the UI: step 4, v)
```

Send 5–10 ADA to the **selling** wallet from any Cardano wallet (Eternl, Lace, an exchange). Wait for one
confirmation (`lokal wallet` shows the balance), then:

```sh
lokal run pay        # submits the registration and waits for RegistrationConfirmed (about 5–10 min)
lokal down && lokal up
lokal doctor         # every line ✔ (Payments, Wallet, Registry, Agent API)
```

In the UI the same steps are: step 4 → `n` (mainnet) → enter (paste the keys) → enter.

## 5. First paid mainnet job

```sh
lokal buy "Invoice 17 from ACME, 2 x coffee at 3.90 EUR, total 7.80 EUR"
```

Fund the purchasing wallet it prints (≥ 7 ADA for a 2 ADA price), run it again, and answer `y` (or pass
`--yes`). Keep the tx links it prints: lock (FundsLocked) and result (ResultSubmitted). Then:

- `lokal buy` has already checked the result against the on-chain `resultHash`.
- After the unlock time (about 36 minutes after the purchase), the payment service should withdraw the price
  into the selling wallet. lokAl has not seen that happen yet: on preprod, [evidence.md](evidence.md) still lists
  it as pending. Check with `lokal wallet`. You have proof of payment only once the selling wallet has received
  the funds.

**A failing check is not charged.** Send input that can't pass, for example `lokal buy "hello"` with the invoice
job. The agent submits no result, `lokal buy` ends with "submitted no result", and the escrow stays refundable
to the purchasing wallet after the result deadline (20 min). lokAl has not yet tested how that refund gets
triggered.

## 6. Afterwards

- `lokal network preprod` switches back. The mainnet wallets and registration are kept for the next time.
- To move earnings: `lokal wallet export` shows the selling wallet's recovery phrase **on screen only**
  (anyone who sees it controls the funds). Import it into Eternl or Lace.
- `lokal price default` goes back to the job's own price (1 USDM for the built-in jobs).

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Blockfrost … this is a preprod key` | Mainnet needs a *mainnet* project id. Keep the preprod one too: the payment service seeds preprod first. |
| Registry stays `pending` for > 15 min | `lokal doctor`. If Payments is red, press `r` in the dashboard. lokald clears stale sync locks on every start. |
| Payments red: "database down" | lokald starts the database again within 15 s. If it stays red, `lokal run pay` (it starts the database too) and see `lokal daemon logs`. |
| `lokal buy`: agent API not answering | Paid jobs are not enabled yet (finish step 4), or the services were not restarted: `lokal down && lokal up`. |
| `lokal buy`: `Payment service /purchase HTTP 4xx: …` | The message comes from the payment service; usually the purchasing wallet is short of ADA or still waiting for its funding tx to confirm. |
| Outside buyers can't reach you | The quick-tunnel URL changed. Use a stable URL; `lokal info` shows the registered one (agent API). |
