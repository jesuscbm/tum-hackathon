# Hackathon context

**TUM Blockchain & AI Hackathon 2026**, Munich. Build sprint Fri 30 Oct 09:00 → **Sat 31 Oct 15:00 (hard deadline)**.
Internal target: the qualifying artefact works by **Sat 12:00**. Live booth judging Sat 15:00–17:30.
Team of 4 (J systems, T maths, M business, F informatics), first hackathon, heavy AI use.

## Track: Cardano, "Agentic Commerce on Cardano" (€3k / €2k / €1k)
Judges: Cardano developer community advocate + Cardano Foundation solutions architect.

**Pass/fail:** an agent or service completes at least one **paid job on Cardano preprod**, with its tx hash
(per job via Masumi on Sokosumi, or per request via x402).

**Submission:** video ≤ 2.5 min (customer, problem, business case, one paid job end to end, explorer link);
public repo + README with setup; Devfolio text (how it works, Cardano tools used, real-world use).

**Judged on:** original use case, paid workflow works end to end, technical execution with Cardano tools,
creativity, UX, clear pitch, real-world impact. Explicitly wanted: a clear customer journey; **payment tied to the
result** (escrow, refunds, pay-only-if-a-check-passed); agents hiring agents or acting in the real world; a live
preprod explorer demo. Crowded examples to avoid: paid research task, paid data API via x402, lead-hires-specialist.

## Masumi submission checklist (summary)
Repo + exact run commands; a completed Task and a follow-up reply; payment evidence = Task ID + payment tx hash +
seller's net receipt kept together; separate what works from what is pending; public/sample data only.

## How lokal answers the brief
Customer: anyone with spare compute who wants to sell agent work without a cloud API. Demo job: invoice → JSON.
Payment tied to the result: the check gates submit-result. Provenance: result hash commits to weights + prompt.
Pitch number: time from the install command to the first paid job on a fresh laptop.
