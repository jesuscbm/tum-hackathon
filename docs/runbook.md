# Runbook: what lokAl automates, by hand

Every command that worked during setup goes here; `core/steps/` and `pay/` are built from it.
All Sokosumi commands use the pinned CLI 1.1.0 and `--preprod`.

## Model (step 1)
```sh
ollama serve &                       # lokal: core/runtime/ollama.mjs serve()
ollama pull llama3.2:3b              # lokal: pull() with streamed progress
# coworker/.env
ZAI_BASE_URL=http://127.0.0.1:11434/v1  ZAI_API_KEY=ollama  ZAI_MODEL=llama3.2:3b  ZAI_CONTEXT_WINDOW_TOKENS=32768
```

## Job (step 2)
Copy `templates/<id>/prompt.md` to `coworker/agent/instructions.md`; set `LOKAL_TEMPLATE=<id>` in `coworker/.env`.

## Sokosumi (step 3)
```sh
sokosumi --preprod auth login && sokosumi --preprod auth whoami --json
sokosumi --preprod vendors me --json                  # or: vendors create --name NAME --slug SLUG
sokosumi --preprod coworkers register --personal --vendor-id VENDOR_ID --name NAME --capability tasks --json
sokosumi --preprod coworkers api-key COWORKER_ID --json   # token → stdin of:
sokosumi --preprod runtime key-import --coworker-id COWORKER_ID --api-key-stdin
# Organization Workspace (lokal workspace SLUG): workspaces list --json → coworkers connect COWORKER_ID --vendor-id V --workspace-id ORG → workspaces check ORG
```

## Payments (step 4)
```sh
docker run -d --name lokal-mps-db -e POSTGRES_USER=masumi -e POSTGRES_PASSWORD=… -e POSTGRES_DB=masumi -p 127.0.0.1:55432:5432 postgres:16
git clone --depth 1 https://github.com/masumi-network/masumi-payment-service.git
# .env: DATABASE_URL, ENCRYPTION_KEY, ADMIN_KEY, PORT=38127, BLOCKFROST_API_KEY_PREPROD   (Node 24.22.1+, <25)
npx pnpm@10.30.2 install --frozen-lockfile && npx pnpm@10.30.2 run prisma:migrate && npx pnpm@10.30.2 run prisma:seed
npx pnpm@10.30.2 run dev
# coworker: docs/payment-state.json {sourceId, walletId, sellerAddress}, fund wallet at dispenser.masumi.network
node --env-file=.env --env-file=.local/mps.env payment-registration.mjs key
node --env-file=.env --env-file=.local/mps.env payment-registration.mjs register
node --env-file=.env --env-file=.local/mps.env payment-registration.mjs      # poll until RegistrationConfirmed
npm run api   # then PAID_TASKS_ENABLED=true and restart the worker
```

## Live (step 5)
```sh
npm start; npm run worker; npm run api
sokosumi --preprod tasks create --personal --coworker-id COWORKER_ID --name test --description "…" --status READY --json
```

## Notes from the field
- (add what broke and how you fixed it)
