# Evidence

Fill in as each item is verified. A completed Task alone does not prove payment:
match the payment transaction to the seller's net token receipt.

| What | Value | Explorer | Verified how |
|---|---|---|---|
| Coworker ID | | | `sokosumi --preprod coworkers list --scope owned --json` |
| Free task (local model, check passed) | task ID | | Task result = canonical JSON; `lokal verify` |
| Test ADA for the selling wallet (automatic, dispenser) | 100 tADA | [1368e026…](https://preprod.cardanoscan.io/transaction/1368e026114342dfc50f0daf9a34021519d5dbb157bc4c881760a36aa6671fb1) | Blockfrost balance |
| Agent registration (2026-10-30 21:22 CET) | agent `67ab0c92c4ac1610…` | [27d3b0f8…](https://preprod.cardanoscan.io/transaction/27d3b0f8af44874537ef4a5fbccb15c9338996279f80a231351fec342303af11) | registry state `RegistrationConfirmed` |
| Paid task (check passed), 2026-10-30 | task `01a18e94-ee86-7719-8354-10e1caa7333e` (1 test USDM, Llama 3.2 3B, invoice check passed) | FundsLocked [bc6d593b…](https://preprod.cardanoscan.io/transaction/bc6d593bb5dd5f62c84b611d577c38ea31a70297dbf2ae0b7fdf2da177c8b6e1) · ResultSubmitted [7332dccf…](https://preprod.cardanoscan.io/transaction/7332dccf8073bf45c3d69430bbdae30837ed67f116fa3b16c45e8d21af3107bb) · Withdrawn: pending (unlock 21:27 UTC) | `lokal verify` ✔ result hash `6fc71a1c…` matches on-chain; seller receipt: pending |
| Paid task (check failed → withheld) | task ID | FundsLocked tx | no ResultSubmitted; buyer refund path |
| Fresh-machine time to first paid job | __ min | | screen recording |
