# FeasibilityAI

A web app that turns a business idea into a professional feasibility report. Ported from the n8n
**"Miss Sophie"** workflow (Telegram bot → 31 nodes) into a multi-tenant product: public signup,
admin-gated access, per-user credits, and an optional bring-your-own-key mode.

> **Status:** early build. The **core analysis engine is complete and runnable** (mock mode, no
> keys needed). Web UI, auth, and Firebase are not wired yet — see the roadmap.

## What the engine does

Six-dimension feasibility analysis over 10 business inputs:

```
input (10 fields) → deterministic financials
                  → 6 specialists in parallel (market, financial, technical,
                    competitive, location, risk) — research-heavy ones use web search
                  → deterministic weighted scoring + GO/NO-GO verdict
                  → structured report content (rendered to PDF later)
```

Weights: market .25 · financial .30 · technical .15 · competitive .15 · location .10 · risk .05.
Bands: ≥80 HIGHLY FEASIBLE/GO · ≥60 FEASIBLE/GO-with-conditions · ≥40 MARGINAL/CONDITIONAL · <40
NOT FEASIBLE/NO-GO.

## Run the engine locally (no API keys)

```bash
npm install
npm run engine                     # MOCK mode, sample input — zero cost
npm run engine -- fixtures/sample-input.json
```

Live mode (needs a key): set `OPENAI_API_KEY` in `.env.local`, then
`FEASIBILITY_MOCK=false npm run engine`.

## What changed from the n8n workflow (bugs fixed in the port)

1. **Structured outputs** on all specialists — no more regex-scraping JSON out of prose with a
   silent fallback to `50`.
2. **Financial math moved into code** (`lib/engine/financial.ts`) — the LLM keeps only judgment.
3. **Technical prompt de-polluted** — it previously had the Financial prompt pasted in front of it.
4. **Risk score fixed** — the agent now returns structured rows; priority and overall risk are
   computed in code. (In n8n the risk score was *always* 50.)
5. **Report is structured content**, not LLM-emitted HTML — kills the hard-coded `$5,000`/fake-revenue
   bug and ~40% of the cost.
6. **Named stage results**, not merge-by-index — a failed branch can't shift scores onto the wrong
   dimension.

## ⚠️ Rotate the leaked keys

The original workflow JSON had a **SerpAPI** key and a **PDFShift** key hard-coded in plaintext.
Both must be rotated before live use. This repo reads them from env only and never commits them.

## Engine layout (`lib/engine/`)

| File | Role |
|---|---|
| `types.ts` | Domain types (10 fields, 6 dimensions, scores, verdict) |
| `schemas.ts` | Zod schemas → OpenAI structured-output JSON schemas |
| `prompts.ts` | Cleaned specialist system prompts |
| `provider.ts` | LLM provider (OpenAI + mock) |
| `search.ts` | Web search (SerpAPI + mock), capped per stage |
| `extractor.ts` | 10-field extraction + completeness gate |
| `financial.ts` | Deterministic financial math + score |
| `risk.ts` | Deterministic risk ranking + score |
| `scorer.ts` | Weighted overall score, verdict, strengths/issues |
| `report.ts` | Structured report-content generation |
| `runFeasibility.ts` | Orchestrator (fan-out, progress, cost) |

## Roadmap

- [x] **Phase 2** — core engine, TypeScript, mock-testable
- [ ] **Phase 3** — job infra (queue + worker + live progress)
- [ ] **Phase 4** — guided intake form + AI pre-fill + run view
- [ ] **Phase 5** — PDF render + storage + share/email
- [ ] **Phase 1** — Firebase Auth + `users` + approval gate + admin panel
- [ ] **Phase 0** — Firebase/GCP project + billing + App Check
- [ ] **Phase 6** — credits, quotas, BYOK (KMS)
- [ ] **Phase 7** — landing page, admin ops
