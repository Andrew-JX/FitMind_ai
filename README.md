# FitMind AI

FitMind AI is a mobile-first training log and evidence-backed AI coaching product. It connects structured workout records, deterministic training analysis, explainable recommendations, Tool Calling, SSE streaming, and a PostgreSQL-backed assistant workflow.

It is designed as a training product rather than a generic chatbot: recommendations are grounded in the user's actual logs and expose the evidence used to produce them.

## Live deployments

| Instance            | URL                                                             | Purpose                                            | Registration |
| ------------------- | --------------------------------------------------------------- | -------------------------------------------------- | ------------ |
| Mainland production | [fitmind.jimmyuuu.com](https://fitmind.jimmyuuu.com/)           | Tencent Cloud application/API with Neon PostgreSQL | Invite-only  |
| Overseas demo       | [fitmind-ai-psi.vercel.app](https://fitmind-ai-psi.vercel.app/) | Vercel portfolio and product demo                  | Open         |

Both instances use the same application source. Runtime configuration controls registration policy, provider availability, filing information, and deployment-specific behavior.

## Product highlights

- Structured workout logging with exercise, set, load, repetition, RPE, and note data.
- Deterministic volume, fatigue, recovery, progress, and plateau calculations.
- An AI assistant that uses tools and traceable evidence instead of unsupported free-form advice.
- Natural-language workout intake with a confirmation step before records are saved.
- Mobile-first React interface, installable PWA shell, and streaming assistant responses.
- Express API, PostgreSQL/pgvector persistence, consent versioning, and HttpOnly cookie sessions.

## Repository layout

The application workspace lives in [`fitmind-ai/`](fitmind-ai/). Its [full README](fitmind-ai/README.md) contains the architecture notes, environment checklist, verification commands, and documentation index.

```text
FitMind/
└── fitmind-ai/
    ├── client/   # React + Vite frontend
    ├── server/   # Express API and application services
    ├── shared/   # Shared DTOs and schemas
    ├── deploy/   # Tencent Cloud Docker/Nginx release assets
    └── docs/     # Product, architecture, operations, and UI documentation
```

## Local development

Requirements: Node.js 24, pnpm 10, and a PostgreSQL connection configured in `fitmind-ai/.env`.

```bash
pnpm --dir fitmind-ai install
pnpm --dir fitmind-ai dev:server
pnpm --dir fitmind-ai dev:client
```

Run the complete local quality gate with:

```bash
pnpm --dir fitmind-ai verify
```

## How releases update

- Pushing a reviewed commit to GitHub `main` triggers the linked Vercel production deployment. Other pushed branches produce Vercel preview deployments.
- `fitmind.jimmyuuu.com` does **not** update from a Git push alone. The Tencent Cloud release checkout must move to the reviewed commit and run `fitmind-ai/deploy/scripts/deploy.sh`; that script builds commit-tagged images, migrates and verifies the database, replaces the containers, and requires healthy loopback probes.
- Local `.env` changes never synchronize to either hosted environment. Hosted environment changes are managed separately and require a deployment or process replacement before they take effect.

See the [Tencent Cloud runbook](fitmind-ai/deploy/README.md) for the reviewed release and rollback sequence.
