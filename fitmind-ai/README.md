# FitMind AI

## Overview

FitMind AI is an evidence-backed AI training analysis system that connects workout logging, deterministic calculation tools, Tool Calling, SSE streaming, and a mobile-first React assistant UI.

It is not a generic chatbot and not a pure CRUD app.

## Production URL

- Live app: https://fitmind-ai-psi.vercel.app/
- The deployed client uses relative `/api` requests by default. `VITE_API_BASE_URL` can stay empty on Vercel unless the API is hosted on a separate origin.

## Mobile Install

FitMind AI includes a minimal PWA install experience for mobile home screens.

iOS:

1. Open https://fitmind-ai-psi.vercel.app/ in Safari.
2. Tap Share.
3. Tap Add to Home Screen.
4. Launch FitMind from the new home-screen icon.

Android:

1. Open https://fitmind-ai-psi.vercel.app/ in Chrome.
2. Tap the browser menu.
3. Tap Add to Home screen or Install app.
4. Launch FitMind from the new home-screen icon.

Offline note:

- The app has a friendly offline fallback page.
- Training data still requires network sync.
- Offline workout editing, background sync, and push notifications are intentionally out of scope for the current web app.

PWA troubleshooting:

- To force a fresh app shell, open the site in Safari or Chrome and refresh once while online before launching from the home-screen icon again.
- If the installed app keeps showing an older version, remove the FitMind home-screen icon and add it again from the browser.
- If stale service worker data persists, clear site data for `fitmind-ai-psi.vercel.app` in browser settings, then reopen the production URL and reinstall.
- FitMind can remember only the last login email when selected. It does not store the password or persist the auth token.

## Core Idea

Workout logs  
-> deterministic calculation layer  
-> tool executor  
-> provider adapter  
-> SSE assistant stream  
-> frontend assistant state machine  
-> evidence-backed answer UI

## Tech Stack

Frontend:

- React
- TypeScript
- Vite
- mobile-first Chinese UI

Backend:

- Node.js
- Express
- PostgreSQL
- Zod
- JWT
- SSE

AI layer:

- mock provider
- Anthropic provider adapter path
- Tool Calling
- deterministic tools

## Key Documents

- AI assistant rules / entry point: [AGENTS.md](AGENTS.md)
- Roadmap (forward-looking plan): [docs/roadmap.md](docs/roadmap.md)
- Local run guide: [docs/local-run-guide.md](docs/local-run-guide.md)
- Demo script: [docs/demo-script.md](docs/demo-script.md)
- **Start here — doc index: [docs/INDEX.md](docs/INDEX.md)** (organized by task, not by filename)
- Production smoke checklist: [docs/production-smoke-checklist.md](docs/production-smoke-checklist.md)
- Project study guide: [docs/project-study-guide.md](docs/project-study-guide.md)
- Progress log (current quarter; earlier quarters under `docs/archive/`): [docs/progress.md](docs/progress.md)
- UI spec: [docs/UI_SPEC.md](docs/UI_SPEC.md)
- Architecture: [docs/architecture.md](docs/architecture.md)
- API contract: [docs/api-contract.md](docs/api-contract.md)
- Frontend current state: [docs/frontend-current-state.md](docs/frontend-current-state.md)

## Current Limitations

- RAG is currently an MVP skeleton: static seed corpus plus keyword retrieval, not embeddings or pgvector yet.
- No MCP.
- No multi-tool agent loop.
- No real Anthropic token streaming.
- No second provider call after tool execution by default (an optional faithfulness-gated summary re-phrasing call runs only when `ASSISTANT_PHRASING=on` + `ASSISTANT_PROVIDER=groq`).
- Recommendation context is deterministic preview, not medical advice.
- Browser E2E test has not been completed.

## Vercel Environment Checklist

Required:

- `DATABASE_URL` - PostgreSQL connection string used by API routes and migrations.
- `JWT_SECRET` - long random signing secret for auth tokens.
- `ASSISTANT_PROVIDER` - use `mock` for stable demos unless a real provider is intentionally being tested.
- `WORKOUT_INTAKE_LLM_PROVIDER` - use `mock` or `off` for stable demos; use `anthropic` only when the API key is configured.

Optional:

- `ANTHROPIC_API_KEY` - only required when `ASSISTANT_PROVIDER=anthropic` or `WORKOUT_INTAKE_LLM_PROVIDER=anthropic`.
- `ASSISTANT_PHRASING` - `off` by default; set `on` to let the model re-phrase the answer summary. Only active when `ASSISTANT_PROVIDER=groq`; runtime faithfulness gates each rewrite (see `docs/ai-decisions.md` D39).
- `VITE_API_BASE_URL` - leave empty for the current Vercel single-origin deployment.

## Verification

- `pnpm test`
  - Unit-test lane only
  - Does not prove real DB-backed flows
- `pnpm eval`
  - Offline assistant eval suite (mock-first, no DB, zero cost): intent-routing accuracy + refusal/evidence regressions + faithfulness pass-rate (reuses the Slice 1 verifier)
  - Prints a per-check report and **exits non-zero on any regression** — safe to wire into CI as a gate
  - Narrative LLM-as-judge is an opt-in seam, off by default to stay zero-cost (see `docs/ai-decisions.md` D22)
- `pnpm smoke:auth`
  - Real auth app path
  - Requires `DATABASE_URL`
- `pnpm smoke:assistant`
  - Real auth + assistant mock-turn path
  - Requires `DATABASE_URL`
- `pnpm smoke:training`
  - Real training summary / recommendation context / exercise progress paths
  - Requires `DATABASE_URL`
- `pnpm smoke:muscle-load`
  - Real muscle-group load calculation path
  - Requires `DATABASE_URL`
- `pnpm seed:assistant-demo`
  - Seeds the local deterministic assistant demo user and workouts

Notes:

- In this workspace, sandbox DB egress denial can block the DB-backed smoke commands even when the app logic is correct.
- Elevated reruns are the source of truth for the current backend smoke status.
- Browser E2E should not be claimed as complete.
