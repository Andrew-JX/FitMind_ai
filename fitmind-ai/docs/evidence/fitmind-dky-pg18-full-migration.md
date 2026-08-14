# fitmind-dky PostgreSQL 18 + pgvector migration evidence

Verified: 2026-08-14

- Contract SHA: `cf2258e` (`docs: freeze PostgreSQL 18 migration contract`)
- Baseline SHA: `a223aa436ba32c55d9d6ae65378bd5c3960859de`
- Candidate SHA: the first commit containing this evidence file; resolve with
  `git log -1 --format=%H -- fitmind-ai/docs/evidence/fitmind-dky-pg18-full-migration.md`
- Application runner image: `fitmind-api:a223aa436ba3`
- Database image:
  `pgvector/pgvector@sha256:2ba9ca5f2e7daa0f0e7723cba1ee9167bab54efd3640516a44ac1a928dd67e7a`
- PostgreSQL: `18.6 (Debian 18.6-1.pgdg12+2)`
- vector extension: `0.8.6`

No production database URL, production `.env`, credential, host port, or
production data was used. The database container had `ports={}` and network
mode `fitmind-dky-net-a223aa4`. Verification runners shared only its isolated
network namespace and received an explicit local throwaway URL.

## Commands

The commands below were run over the existing administrative SSH connection to
the Tencent Ubuntu host. `<repo>` denotes the already controlled production
checkout path; no secret value is omitted from these commands because the
throwaway database used local `trust` authentication and had no published port.

```bash
docker pull pgvector/pgvector:pg18
docker network create fitmind-dky-net-a223aa4
docker volume create fitmind-dky-data-a223aa4
docker run -d \
  --name fitmind-dky-pg18-a223aa4 \
  --network fitmind-dky-net-a223aa4 \
  --network-alias fitmind-dky-db \
  --mount type=volume,src=fitmind-dky-data-a223aa4,dst=/var/lib/postgresql \
  -e POSTGRES_HOST_AUTH_METHOD=trust \
  -e POSTGRES_DB=fitmind_migtest \
  pgvector/pgvector@sha256:2ba9ca5f2e7daa0f0e7723cba1ee9167bab54efd3640516a44ac1a928dd67e7a
```

Every migration invocation used the exact migrations baked into the baseline
API image:

```bash
docker run --rm \
  --network container:fitmind-dky-pg18-a223aa4 \
  -e DATABASE_URL=postgres://postgres@127.0.0.1:5432/fitmind_migtest \
  --entrypoint node fitmind-api:a223aa436ba3 \
  /app/server/node_modules/node-pg-migrate/bin/node-pg-migrate.js \
  up -m /app/server/migrations -t pgmigrations --verbose=false

# Revert personal-tools and then user-consents.
# The same command shape was used with `up` to restore every pending file.
docker run --rm \
  --network container:fitmind-dky-pg18-a223aa4 \
  -e DATABASE_URL=postgres://postgres@127.0.0.1:5432/fitmind_migtest \
  --entrypoint node fitmind-api:a223aa436ba3 \
  /app/server/node_modules/node-pg-migrate/bin/node-pg-migrate.js \
  down 2 -m /app/server/migrations -t pgmigrations --verbose=false
```

Both real-SQL scripts were run before down and again after restore. The runner
was `--read-only`, used a temporary filesystem, mounted only baseline
`server/scripts` and `server/src` read-only, and set only the dedicated test URL:

```bash
docker run --rm --read-only \
  --network container:fitmind-dky-pg18-a223aa4 \
  --tmpfs /tmp:rw,nosuid,nodev \
  -e CONSENT_SQL_TEST_DATABASE_URL=postgres://postgres@127.0.0.1:5432/fitmind_migtest \
  --mount type=bind,src=<repo>/fitmind-ai/server/scripts,dst=/source/scripts,readonly \
  --mount type=bind,src=<repo>/fitmind-ai/server/src,dst=/source/src,readonly \
  --entrypoint sh fitmind-api:a223aa436ba3 \
  -c '<copy sources to /tmp with the image package.json and execute tsx>'

# Executed through the runner above:
tsx scripts/verify-consent-sql.ts
tsx scripts/verify-personal-tools-sql.ts
```

The negative control used the same runner and script but set
`CONSENT_SQL_TEST_DATABASE_URL` to
`postgres://postgres@fitmind-dky-db:5432/fitmind_migtest`. It exited 1 with
`Refusing to run against non-local host` before a pool was constructed.

Cleanup was explicit and also registered as an `EXIT` trap:

```bash
docker rm -f fitmind-dky-pg18-a223aa4
docker network rm fitmind-dky-net-a223aa4
docker volume rm fitmind-dky-data-a223aa4
```

## Results

Before the first migration, `pg_tables` contained zero `public` tables. The
unbounded `up` applied these 15 migrations, in order:

1. `20260427043000_create_core_dictionaries_and_users`
2. `20260427044000_create_workouts_and_sets`
3. `20260427045000_create_chat_and_tool_log_tables`
4. `20260531090000_add_workout_time_range`
5. `20260603090000_add_exercise_detail_fields`
6. `20260606090000_create_training_knowledge_tables`
7. `20260607090000_add_knowledge_chunk_embeddings`
8. `20260607100000_add_knowledge_chunk_upsert_index`
9. `20260608090000_create_assistant_saved_insights`
10. `20260610090000_create_product_feedback`
11. `20260614100000_create_athlete_profiles`
12. `20260614110000_create_planned_workouts`
13. `20260701090000_create_weekly_report_digests`
14. `20260803090000_create_user_consents`
15. `20260809120000_create_personal_tools`

Post-migration queries reported `MIGRATION_COUNT 15` and all five required
consent/personal-tool table checks present. The two SQL scripts then reported:

```text
ALL CHECKS PASSED
ALL PERSONAL-TOOLS SQL CHECKS PASSED
```

`down 2` named and reverted `20260809120000_create_personal_tools` followed by
`20260803090000_create_user_consents`. The migration count became 13, and
`user_consents`, `menstrual_records`, `personal_health_settings`,
`body_measurements`, and `training_memos` were all absent. A normal `up`
restored both migrations, returned the count to 15, retained vector `0.8.6`,
and both SQL scripts printed the same success markers again.

The final isolated sequence emitted:

```text
NEGATIVE_HOST_REJECTED status=1
CLEANUP containers=0 networks=0 volumes=0
PRODUCTION_UNCHANGED checkout=a223aa436ba32c55d9d6ae65378bd5c3960859de api=running/healthy web=running/healthy
FITMIND_DKY_DATABASE_SEQUENCE_PASSED
```

The first attempt stopped after the successful 15-migration phase because the
temporary source directory lacked the package's ESM marker; `tsx` rejected
top-level await before either SQL script ran. Its `EXIT` trap removed all three
resources, and production remained unchanged. The successful rerun copied the
baseline `server/package.json` into the read-only runner's temporary working
tree; no product source or acceptance criterion changed.

Finally, local `pnpm verify` passed lint, formatting, client/server/shared type
checks, 119 Vitest files with 939 tests, and 5 monitor tests. The only working
tree change outside this evidence path remains the pre-existing Beads
interaction ledger, which is not part of the candidate commit.
