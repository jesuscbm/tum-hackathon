# coworker: the Sokosumi Coworker processes (agent, worker, agent API)

Adapted from the Masumi TUM starter.

This folder is [`masumi-network/tum-hackathon-quickstart`](https://github.com/masumi-network/tum-hackathon-quickstart)
with small, tested hooks for lokal. **Use lokAl from the repository root** (`node bin/lokal.mjs`); it writes this
folder's `.env` and `agent/instructions.md`, and starts these processes for you.

| Process | Command | Role |
|---|---|---|
| Agent (Eve) | `npm start` | Runs the model with `agent/instructions.md` as the system prompt |
| Worker | `npm run worker` | Polls Sokosumi Tasks; free and paid (escrow) flows |
| Agent API | `npm run api` | MIP-003 endpoints for paid jobs (only with `PAID_TASKS_ENABLED=true`) |

Run only **one worker per Coworker**.

## lokAl changes to the starter
- `lokal-gate.mjs` (+ test): runs the job template's check, retries once with the reasons, and turns the answer into
  a canonical JSON result (output, model, weights digest, prompt hash, check). Active only when `LOKAL_TEMPLATE` is set.
- `worker.mjs`: answers go through the gate.
- `paid-task.mjs`: a result that fails its check is never submitted (stage `check-failed`); a comment tells the buyer.
- `payment-registration.mjs`: registry name, description and tags come from `LOKAL_AGENT_*` / `LOKAL_TEMPLATE`.
- `agent-api.mjs`: the MIP-003 input schema describes the active template.
- `agent/agent.ts`: sends the session header OpenCode Go requires (only when `ZAI_BASE_URL` is opencode.ai).

`.env` names are listed in `.env.example`; never commit `.env`, `.local/` or `docs/*.json`.
Run `npm test` after changes. The starter's own rules for coding agents are in [`AGENTS.md`](AGENTS.md).
