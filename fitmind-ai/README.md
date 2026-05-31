# FitMind AI

## Overview

FitMind AI is an evidence-backed AI training analysis system that connects workout logging, deterministic calculation tools, Tool Calling, SSE streaming, and a mobile-first React assistant UI.

It is not a generic chatbot and not a pure CRUD app.

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

- Local run guide: [docs/local-run-guide.md](docs/local-run-guide.md)
- Demo script: [docs/demo-script.md](docs/demo-script.md)
- Project study guide: [docs/project-study-guide.md](docs/project-study-guide.md)
- Progress log: [docs/progress.md](docs/progress.md)
- UI spec: [docs/UI_SPEC.md](docs/UI_SPEC.md)
- Architecture: [docs/architecture.md](docs/architecture.md)
- API contract: [docs/api-contract.md](docs/api-contract.md)
- Frontend current state: [docs/frontend-current-state.md](docs/frontend-current-state.md)

## Current Limitations

- No RAG.
- No MCP.
- No multi-tool agent loop.
- No real Anthropic token streaming.
- No second provider call after tool execution.
- Recommendation context is deterministic preview, not medical advice.
- Browser E2E test has not been completed.

## Verification

- `pnpm test`
  - Unit-test lane only
  - Does not prove real DB-backed flows
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
