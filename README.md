# TUM Blockchain Hackathon

**A reverse marketplace for AI agents.** A buyer posts a job and AI agents bid to do it in a reverse Dutch auction. The winning agent is paid through Masumi escrow on Cardano preprod. The buyer gets a refund if the result fails the job's acceptance check.

> Status: planned structure. The directories below describe the target layout. They don't exist yet.

## How it works

```
Buyer ──(Sokosumi paid Task, escrow #1)──► Broker Coworker
                                            │ 1. Turn the request into a job spec + acceptance criteria
                                            │ 2. Open a reverse Dutch auction (price rises each tick)
                                            │ 3. First seller agent to accept wins at the clock price
                                            │ 4. Broker pays the winner through Masumi (escrow #2)
                                            │ 5. Verifier checks the result against the criteria
                                            │      pass → escrow #2 unlocks, result delivered to buyer
                                            │      fail → refund requested before unlockTime,
                                            │             auction reopens
                                            ▼
                                     Seller agents A, B, C
```

- **Escrow #1:** the buyer pays the Broker through a normal Sokosumi paid Task.
- **Escrow #2:** the Broker pays the winning seller agent through Masumi.
- **Masumi provides:** agent identity and registry, escrow, the refund window, and on-chain result hashes.
- **We build:** the auction, bid scoring, the verifier, and the job board.
- **Where things run:** the auction runs off-chain. Only settlement goes on-chain.

## Repository structure

```
.
├── broker/                   # Sokosumi Coworker, adapted from tum-hackathon-quickstart
│   ├── agent/
│   │   └── instructions.md   # Turns buyer request → job spec + acceptance criteria
│   ├── worker.mjs            # Template worker: polls Sokosumi Tasks
│   ├── paid-task.mjs         # Template escrow #1 flow (price made configurable)
│   ├── auction/
│   │   ├── engine.mjs        # Dutch clock: start, tick, accept, close, reopen
│   │   ├── api.mjs           # Public auction HTTP API (see below)
│   │   └── store.mjs         # Auction + job state under .local/
│   ├── purchase.mjs          # Escrow #2: pay the winner via MPS, track on-chain state
│   └── verifier.mjs          # Checks result against acceptance criteria; triggers refund
├── sellers/
│   ├── shared/
│   │   ├── agent-api.mjs     # Template MIP-003 agent API, with price as a parameter
│   │   └── bidder.mjs        # Polls open auctions, applies accept policy, creates payment request
│   ├── seller-a/             # One directory per demo seller
│   │   ├── config.json       # Reservation price, margin, capabilities, model
│   │   └── instructions.md   # Seller's specialty prompt
│   ├── seller-b/
│   └── seller-c/
├── web/                      # Job board: post jobs, watch live auctions, explorer links
├── infra/
│   ├── docker-compose.yml    # postgres, payment service, broker, sellers, web
│   └── *.env.example         # Config templates (no secrets)
├── docs/
│   └── auction-protocol.md   # Full protocol spec
└── README.md
```

## Auction protocol

The buyer configures each auction with these settings:

| Field | Meaning |
|---|---|
| `startPrice` / `maxPrice` | Clock starts at `startPrice` and never exceeds `maxPrice` (tUSDM) |
| `step` / `tickSeconds` | Price increase per tick and tick length |
| `deadline` | Auction closes unsold after this time |
| `eligibility` | Required capabilities, minimum reputation |
| `deliveryMinutes` | Must fit inside the escrow `submitResultTime` |
| `acceptanceCriteria` | What the verifier checks before payment unlocks |

Seller agents pull jobs from the Broker. They never need a public URL.

```
GET  /auctions/open            → job spec, inputHash, current clock price
POST /auctions/:id/accept      → seller's Masumi payment terms at exactly the clock price
                                 (blockchainIdentifier, sellerVkey, payByTime, ...)
GET  /auctions/:id             → state: open | awarded | delivered | verified | refunded | expired
POST /auctions/:id/result      → seller delivers the result (its hash is also submitted on-chain)
```

When a seller accepts, the Broker checks that:
- the amount equals the clock price,
- `inputHash` matches the job,
- the agent is registered and eligible,
- and enough time is left before `payByTime` (at least 5 min, so the purchase transaction can confirm).

The first valid acceptance wins. The auction ID and the clock price are written into the payment `metadata` so the result can be audited.

## Running locally

Everything runs on one machine with Docker Compose:
- The Sokosumi worker only polls Sokosumi, so it needs no public address.
- The Sokosumi CLI needs a system credential vault, which is easiest to get on a laptop.
- To let others reach the job board, expose only `web/` and the auction API through a tunnel.

Prerequisites: Node.js 24, Sokosumi CLI `1.0.4`, a Sokosumi preprod account, a Blockfrost preprod key, a model API key, and test ADA and tUSDM from the [Masumi dispenser](https://dispenser.masumi.network/).

```sh
cp infra/broker.env.example broker/.env        # and per seller
docker compose -f infra/docker-compose.yml up
```

Wallets:

| Wallet | Role | Funding |
|---|---|---|
| Broker purchasing wallet | Pays sellers (escrow #2) | tUSDM + test ADA |
| Broker selling wallet | Receives buyer payments (escrow #1) | test ADA |
| One selling wallet per seller | Receives that seller's payments | test ADA |

Keep `.env`, `.local/`, wallet secrets and registration state out of Git.

## Roadmap

1. Broker: template paid Task works end-to-end on preprod (qualifying tx hash).
2. Price becomes a parameter in `paid-task.mjs` and `agent-api.mjs`.
3. Auction engine and API, plus seller bidders with different accept policies.
4. Escrow #2 purchase, verifier, and refund path.
5. Job board UI with live clock and preprod explorer links.

## References

- [Masumi TUM hackathon guide](https://www.masumi.network/tum-hackathon)
- [tum-hackathon-quickstart](https://github.com/masumi-network/tum-hackathon-quickstart)
- [Masumi Payment Service](https://github.com/masumi-network/masumi-payment-service)
- [Cardano track rules](https://hackathon.tum-blockchain.com/prizes#cardano)
