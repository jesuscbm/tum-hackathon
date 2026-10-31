# Verifying a lokAl result

Every paid lokAl job ends with one piece of text: the **canonical result**. The agent posts it
as the result of the Sokosumi task. Its SHA-256 is the `resultHash` that the agent submits to the
Masumi escrow on Cardano preprod. Anyone holding the text can check that it matches what
went on-chain.

## What the canonical result looks like

```json
{"check":{"pass":true,"reasons":[],"type":"invoice"},"digest":"sha256:…","model":"llama3.2:3b","output":"{…}","promptHash":"sha256:…","template":"invoice-json","v":1}
```

- **Canonical form:** keys sorted at every level, no whitespace (`canonicalize()` in `provenance.mjs`).
  The same content always produces the same bytes, and therefore the same hash.
- `output` is the model's raw answer, verbatim.
- `model` is the model name the seller ran.
- `digest` fingerprints the model weights:
  - **Ollama:** the model's manifest digest, as shown by `ollama list` / `GET /api/tags`. It
    identifies the exact weights and quantization.
  - **llama.cpp:** lokAl computes the sha256 of the GGUF file it downloaded.
  - `null` when the backend is a remote endpoint, which can't prove its weights. The TUI marks
    these as *model unverified*.
- `promptHash` is `sha256:` + the SHA-256 of the system prompt the agent used. If the seller
  publishes the template's `prompt.md`, the buyer can hash it and compare.
- `check` holds the result of the deterministic check that ran before submission: its type,
  whether it passed, and the reasons if it failed.

## Verify in three steps

1. Copy the result text from the Sokosumi task into a file, e.g. `result.json`. Copy it exactly,
   without reformatting. One extra space changes the hash.
2. Find the on-chain hash: open the task's Masumi payment on the preprod explorer (the
   result-submission transaction), or ask the seller for the `resultHash` from their payment
   state.
3. Compare the two:

```sh
node bin/lokal.mjs verify result.json <expected-hash>
```

If you don't have lokAl installed, plain Node is enough:

```sh
node -e "const t=require('fs').readFileSync(process.argv[1],'utf8');console.log(require('crypto').createHash('sha256').update(t,'utf8').digest('hex'))" result.json
```

Then compare the printed hex with the on-chain `resultHash`.

Results bought through the agent API (MIP-003, `lokal buy`) hash `nonce;text`, where the nonce is the
buyer's `identifierFromPurchaser`: add `--nonce HEX` (`lokal buy` prints the whole command).

**Don't trust the seller's check, re-run it.** The verdict inside the result is the seller's claim. Add
`--recheck` to run the job's check on the output yourself and compare. A seller who committed "pass" on a
failing result is caught here, with the on-chain hash as proof. It also tells you whether the prompt hash
matches the published job:

```sh
lokal verify result.json <expected-hash> --recheck
# ✖ check re-run here: invoice fails (the seller claimed pass, the check says fail: $.total: 9 ≠ line items + tax = 3)
```

`verifyResult(text, expectedHash)` in `provenance.mjs` also checks that the text is in canonical
form, which catches a reformatted copy that happens to contain the same data.

To check the model too, run `ollama pull <model>` and compare `ollama list`'s digest with
`digest`. To check the prompt, hash the published `prompt.md`:
`sha256sum templates/invoice-json/prompt.md`. Note that lokAl hashes the exact text it loaded.

## What the check proves, and what it does not

**It proves:**
- The output was well-formed: it parsed as JSON and matched the schema, the regex or the length range.
- For invoices, the numbers were internally consistent: each line amount equals
  quantity × unit price, and the line items plus tax add up to the total, within ± 0.01.
- The seller ran this check before asking to be paid. A failing result is never submitted, so
  the escrow deadline passes and the buyer can reclaim the funds.

**It does not prove:**
- That the output is *correct*. A model can produce a consistent but wrong invoice, for example
  by misreading a price and recomputing everything to match.
- That the seller really ran the named model. The digest is the seller's claim. The hash
  commits the seller to that claim on-chain, so it can be disputed later, but nothing in the
  hash shows the claim is true. Hardware attestation is out of scope.
- Anything about the input beyond what the Sokosumi task already records.
