# TenderLens: TUM Blockchain & AI Hackathon worker

TenderLens is a Sokosumi Coworker template for paid tender market analysis. A buyer submits a tender brief; Masumi locks the buyer's funds on Cardano Preprod; the worker produces a bid/no-bid and market-positioning report; and the result hash is submitted before the escrow unlock time.

Use [`agent/tender-brief-template.md`](agent/tender-brief-template.md) as the buyer's task description. The paid agent API exposes this as a **Tender market-analysis brief** input schema.

> This repository is a worker template. It does not create buyer wallets or transfer funds automatically. The buyer's own Masumi-compatible payment flow locks the funds, and the worker only starts after the escrow state is confirmed.

## TenderLens quickstart

Sokosumi connects buyers to your worker; it does **not** host the worker. Keep `npm start` and `npm run worker` running locally for a private test, or deploy the same processes to your own cloud host for a public service.

### 1. Configure and start the model agent

Use Node.js 24 and install the pinned dependencies:

```powershell
npm ci
Copy-Item .env.example .env
```

Configure an OpenAI-compatible model connection in `.env`. For Hugging Face Inference Providers, use literal values (do not use `$MODEL_GATEWAY_URL` or variable substitution inside `.env`):

```env
ZAI_API_KEY=hf_your_token
ZAI_BASE_URL=https://router.huggingface.co/v1
ZAI_MODEL=openai/gpt-oss-120b:fastest
ZAI_CONTEXT_WINDOW_TOKENS=32768
PAID_TASKS_ENABLED=false
```

Start the agent and leave it running:

```powershell
npm start
```

### 2. Connect a private Sokosumi Coworker

In a separate terminal, authenticate with your own Preprod account, then discover existing resources before creating new ones:

```powershell
sokosumi --preprod auth login
sokosumi --preprod auth whoami --json
sokosumi --preprod workspaces list --personal --json
sokosumi --preprod vendors me --json
sokosumi --preprod coworkers list --scope owned --json
```

If you do not have a suitable Vendor and Coworker, create them in Sokosumi using your own account. Save their returned IDs locally, then connect the Coworker to your Personal Workspace and import its runtime credential into the CLI vault:

```powershell
sokosumi --preprod coworkers connect YOUR_COWORKER_ID --personal --vendor-id YOUR_VENDOR_ID --json
sokosumi --preprod coworkers api-key YOUR_COWORKER_ID --json |
  sokosumi --preprod runtime key-import --coworker-id YOUR_COWORKER_ID --api-key-stdin
```

Add the Coworker ID to `.env`:

```env
COWORKER_ID=your-coworker-id
```

Start exactly one worker in another terminal:

```powershell
npm run worker
```

Create a small execution-only task before enabling payment:

```powershell
sokosumi --preprod tasks create --personal --coworker-id YOUR_COWORKER_ID `
  --description "Tender title: Municipal IT services. Scope: give a bid/no-bid recommendation using only this supplied brief." `
  --status READY --json
```

Record the returned Task ID and verify that its status becomes `COMPLETED` in Sokosumi.

### 3. Enable Cardano Preprod escrow

Only enable this after the execution-only task succeeds. Run your own [Masumi Payment Service](https://github.com/masumi-network/masumi-payment-service) with a dedicated Preprod database, encryption key, selling wallet, test ADA, and Blockfrost Preprod key. Keep its private values in `.local/mps.env`, never in Git or chat.

Set `MPS_URL`, `AGENT_API_PORT`, `AGENT_AUTHOR`, and `BLOCKFROST_API_KEY_PREPROD` in `.env`. `AGENT_AUTHOR` must be your team or participant name. Then create and register the paid-agent runtime key:

```powershell
node --env-file=.env --env-file=.local/mps.env payment-registration.mjs key
node --env-file=.env --env-file=.local/mps.env payment-registration.mjs register
node --env-file=.env --env-file=.local/mps.env payment-registration.mjs
```

After registration is confirmed and `docs/registration-state.json` contains the returned identifiers, run:

```powershell
npm run api
```

Set `PAID_TASKS_ENABLED=true`, restart the worker, and perform one paid Preprod task. Save the completed Task ID, result, and confirmed seller receipt transaction hash as submission evidence.

### 4. Make the worker reachable and request marketplace listing

`npm run api` binds to `127.0.0.1`, so it is private by default. A marketplace listing needs a stable public **HTTPS** MIP-003 endpoint. For a demo, expose it with a secure tunnel; for a persistent listing, deploy it on your own server behind HTTPS.

After the paid flow works, submit the TenderLens listing with its public endpoint, capabilities, pricing, example output, Terms of Service, and Privacy Policy through the Sokosumi marketplace submission process. Listing is a review/submission step, not an automatic deployment from the Sokosumi account.

---

# Original quickstart setup

Start with the [TUM hackathon setup guide](https://www.masumi.network/tum-hackathon).
It covers your account, Coworker, first task, and payment checkpoints.
Join the [TUM Sokosumi Workspace](https://preprod.sokosumi.com/join/GTAHB3OQFWgg8rGetMfleiqgeL6_ltdW) with your own account.

This starter suggests five team names and recommends one.
Adapt `agent/instructions.md` to build your own agent.
Use the [full agent brief](https://www.masumi.network/tum-hackathon/agent) for your coding agent.
Before handing in your project, follow the [submission checklist](https://www.masumi.network/tum-hackathon/submission).

## Start the local agent

Use Node.js 24 or newer for the agent and CLI.

1. Clone this repository and enter its directory:

   ```sh
   git clone https://github.com/masumi-network/tum-hackathon-quickstart.git
   cd tum-hackathon-quickstart
   ```

2. Install the locked dependencies and prepare private configuration:

   ```sh
   npm ci
   cp .env.example .env
   chmod 600 .env
   ```

3. In `.env`, set `ZAI_API_KEY`, `ZAI_BASE_URL`, and `ZAI_MODEL` for your OpenAI-compatible model provider.
   For a custom model absent from AI Gateway's catalog, also set `ZAI_CONTEXT_WINDOW_TOKENS` to its documented context window.
   Use a positive whole number of tokens. Leave it blank to use Eve's catalog lookup.
4. Keep `EVE_PORT` and `EVE_URL` consistent. Start the agent:

   ```sh
   npm start
   ```

The agent listens on `127.0.0.1` and loads `.env` automatically.
Keep this terminal open while you use the worker.

For extra protection, consider [Socket Firewall](https://socket.dev/products/socket-firewall) for package installs.
If installed, prefix an install command with `sfw`, such as `sfw npm ci`.

## Connect your Sokosumi Coworker

Install Sokosumi CLI `1.0.4`. This starter uses its runtime adapter.
Check compatibility before changing that version.

```sh
npm install --global @masumi_network/sokosumi@1.0.4
sokosumi --version
sokosumi skills
```

1. Follow the [setup guide](https://www.masumi.network/tum-hackathon) to sign in with your own Preprod account.
   Create your own Vendor and a private Coworker with task access.
2. Connect the Coworker to your Personal Workspace for the first test.
   Import its runtime key through the CLI's supported credential interface. Keep the key in the CLI vault.
3. Set the returned `COWORKER_ID` in `.env`.
   Keep `PAID_TASKS_ENABLED=false` until you complete the payment setup below.
4. Start the worker in a second terminal:

   ```sh
   npm run worker
   ```

5. Create a task in your Personal Workspace. Replace `YOUR_COWORKER_ID` with your Coworker ID:

   ```sh
   sokosumi --preprod tasks create --personal --coworker-id YOUR_COWORKER_ID --description "Suggest names for our hackathon team." --status READY --json
   ```

Open the task in Sokosumi and check that it reaches `COMPLETED` with an answer.
Run only one worker for this project. Keep both local services running.

For CLI options, use `sokosumi --help` and its [official documentation](https://github.com/masumi-network/sokosumi/tree/main/apps/cli).

## Switch to the TUM Workspace

Keep both organization settings blank for your first Personal Workspace test.
Finish active Tasks and pending seller receipt checks before you switch Workspaces.

1. Join the [TUM Sokosumi Workspace](https://preprod.sokosumi.com/join/GTAHB3OQFWgg8rGetMfleiqgeL6_ltdW).
   Read its actual organization ID and slug:

   ```sh
   sokosumi --preprod workspaces list --json
   ```

2. Connect your existing Coworker to that Workspace. Replace each placeholder with your returned IDs:

   ```sh
   sokosumi --preprod coworkers connect YOUR_COWORKER_ID --vendor-id YOUR_VENDOR_ID --workspace-id YOUR_ORGANIZATION_ID --json
   sokosumi --preprod workspaces check YOUR_ORGANIZATION_ID --json
   ```

   If access is `PENDING`, ask a Workspace owner or admin to approve it, then run `connect` again.
   Continue only when access is `GRANTED` and your account is eligible to create tasks.
3. Stop the worker. In `.env`, set `SOKOSUMI_ORGANIZATION_ID` and `SOKOSUMI_ORGANIZATION_SLUG` to that Workspace's ID and slug.
   Set both together. The worker rejects incomplete settings and tasks from another Workspace.
4. Restart the worker:

   ```sh
   npm run worker
   ```

5. Create a task in the TUM Workspace:

   ```sh
   sokosumi --preprod tasks create --organization-slug YOUR_WORKSPACE_SLUG --coworker-id YOUR_COWORKER_ID --description "Suggest names for our hackathon team." --status READY --json
   ```

The worker uses the organization slug for task discovery and the organization ID for runtime execution.
Comments and paid tasks use the same Coworker and Workspace checks.
To return to Personal Workspace tasks, finish active work, clear both organization settings, and restart the worker.

## Optional Preprod payments

Prepare your own [Masumi Payment Service](https://github.com/masumi-network/masumi-payment-service) with its current setup instructions.
Use a dedicated database, encryption key, and selling wallet for this project.
Keep setup secrets, including that node's `ADMIN_KEY`, in `.local/mps.env` with permission `600`.
Fund your selling wallet with test ADA.

1. Create `docs/` and `.local/` if absent.
   Save your payment source's `sourceId`, selling wallet's `walletId`, and `sellerAddress` in `docs/payment-state.json`.
   Read these identifiers from your own MPS responses.
2. Set `MPS_URL`, `AGENT_API_PORT`, `AGENT_AUTHOR`, and `BLOCKFROST_API_KEY_PREPROD` in `.env`.
   Use your own name or team name for `AGENT_AUTHOR`.
3. Create the scoped runtime key, then register the agent:

   ```sh
   node --env-file=.env --env-file=.local/mps.env payment-registration.mjs key
   node --env-file=.env --env-file=.local/mps.env payment-registration.mjs register
   ```

4. Check registration until it confirms:

   ```sh
   node --env-file=.env --env-file=.local/mps.env payment-registration.mjs
   ```

5. Complete `docs/registration-state.json` with the confirmed `agentIdentifier`, actual `supportedPaymentSourceIndex`, and selling wallet's `sellerVkey`.
   Read these from your own confirmed registry and wallet responses.
   Start `npm run api`, set `PAID_TASKS_ENABLED=true`, and restart the worker.

Enable payments only after registration confirms and the scoped runtime key is saved in `.local/mps-runtime.env`.
Never copy another project's wallet, registration, or task IDs.
If a payment or registration write has an uncertain outcome, inspect its saved state before retrying.
Complete a paid task and check the seller's net receipt before you submit payment evidence.

## Check your changes

```sh
npm test
```

These tests check local logic. Test your own model connection, Coworker task, and seller receipt through the full setup flow.
The current `npm audit` reports three dependency findings: two high and one moderate, across `eve`, `undici`, and `zod`.
Review these before public deployment. Dependency versions stay pinned in `package-lock.json`.
Keep `.env`, `.local/`, wallet secrets, and generated resource state out of git.
