# Evidence

Fill in as each item is verified. A completed Task alone does not prove payment:
match the payment transaction to the seller's net token receipt.

| What | Value | Explorer | Verified how |
|---|---|---|---|
| Coworker ID | | | `sokosumi --preprod coworkers list --scope owned --json` |
| Free task (local model, check passed) | task ID | | Task result = canonical JSON; `lokal verify` |
| Agent registration | agentIdentifier | tx | `lokal status` step 4 |
| Paid task (check passed) | task ID | FundsLocked tx · ResultSubmitted tx · Withdrawn tx | seller net receipt (Blockfrost) |
| Paid task (check failed → withheld) | task ID | FundsLocked tx | no ResultSubmitted; buyer refund path |
| Fresh-machine time to first paid job | __ min | | screen recording |
