# fitmind-dky — PostgreSQL 18 + pgvector full-migration contract

Contract SHA: this file's first committed revision. After that revision is
committed, this file is frozen and the candidate must not modify it.

Baseline SHA: `a223aa436ba32c55d9d6ae65378bd5c3960859de`

Candidate SHA: empty before execution evidence is recorded.

Allowed repository files after this contract is frozen:

- `fitmind-ai/docs/evidence/fitmind-dky-pg18-full-migration.md`

Allowed external changes:

- pull the official `pgvector/pgvector:pg18` image on the existing Tencent
  Ubuntu host if it is not already present;
- create one isolated Docker network, one PostgreSQL container, and one named
  disposable data volume with task-specific `fitmind-dky-` names;
- run the baseline server migration and SQL verification code in disposable
  containers with source directories mounted read-only;
- remove every task-specific container, network, and volume after verification.

The production database URL, production `.env`, running FitMind containers,
host ports, production schema, and production data are outside scope and must
not be read or changed.

The baseline contains 15 migration `.js` files. This number comes from the set
returned by:

```powershell
Get-ChildItem fitmind-ai/server/migrations -File -Filter *.js
```

## Acceptance criteria

1. **Machine / isolated compatible database.** The disposable database reports
   PostgreSQL major version 18 and an installed `vector` extension version. It
   runs only on the task-specific Docker network with no published host port.
   Docker inspection must show that neither the database nor the verification
   runner receives a production env file or production database URL.
   - Negative assertion: PostgreSQL 14, a database without `vector`, a host-
     published database port, or any connection to Neon/production fails this
     criterion.

2. **Machine / complete empty-database chain.** Starting from a newly created
   `fitmind_migtest` database with zero application tables, unmodified migration
   files from baseline run through `node-pg-migrate up` without an ignore
   pattern or a moved file. `pgmigrations` then contains exactly the 15 baseline
   migration names, and the `vector`, `user_consents`, `menstrual_records`,
   `personal_health_settings`, `body_measurements`, and `training_memos`
   prerequisites exist.
   - Negative assertion: precreating application tables, skipping the pgvector
     migration, accepting only a command exit code without querying
     `pgmigrations`, or counting `.gitkeep` is a false green.

3. **Machine / real SQL behavior before rollback.** Against that same migrated
   database, `verify:consent-sql` prints `ALL CHECKS PASSED` and exits zero, and
   `verify:personal-tools-sql` prints
   `ALL PERSONAL-TOOLS SQL CHECKS PASSED` and exits zero. Both scripts use only
   `CONSENT_SQL_TEST_DATABASE_URL` with the exact allowlisted local host and
   database name.
   - Negative assertion: unit tests, SQL-string assertions, a mock pool, or a
     different database instance does not satisfy this criterion.

4. **Machine / consent plus dependent migration down/up.** From the full chain,
   `node-pg-migrate down 2` reverts the personal-tools migration and then the
   consent migration. The migration count becomes 13 and `user_consents` plus
   all four personal-tool tables are absent. A normal unbounded `up` restores
   the same two files, returns the count to 15, preserves `vector`, and both SQL
   verification scripts pass again.
   - Negative assertion: a fake migration-table edit, `--fake`, down/up on only
     the final migration, or destructive execution against production fails
     this criterion.

5. **Machine / fail-closed destructive-script boundary.** An isolated negative
   invocation using a non-local hostname is rejected by
   `resolveTestDatabaseUrl` before any SQL runs. The successful invocations use
   `127.0.0.1/fitmind_migtest` exactly and never fall back to `DATABASE_URL`.
   - Negative assertion: relying only on the database name substring, allowing
     query-parameter host overrides, or setting the production variable as the
     script input fails this criterion.

6. **Machine / cleanup and repository gate.** After the evidence commands, no
   container, network, or volume whose name starts with `fitmind-dky-` exists;
   the production checkout and running container identities remain the
   baseline production SHA; and `pnpm verify` passes locally.
   - Negative assertion: stopped-but-present containers, a retained data volume,
     changed production checkout, or a previous run's verification output does
     not satisfy this criterion.

7. **Document / reproducible evidence.** The allowed evidence file records the
   baseline and candidate SHAs, image digest, PostgreSQL and vector versions,
   exact redacted commands, migration counts/names, both pairs of SQL-script
   results, negative-boundary result, cleanup inventory, and current gate result.
   - Negative assertion: prose saying “tested on PostgreSQL” without versions,
     exact commands and post-cleanup inventory is insufficient.

## Conflict and qualifier check

No conflict. The original issue requires the full chain, consent verification,
consent down/up, versions, commands, results, and `pnpm verify`. The added
personal-tools verification makes the stated residual risk directly testable
without changing production data or product behavior.

- “production compatible” means PostgreSQL major version 18, matching the
  production version already recorded on the issue; it does not mean using the
  production database.
- “empty” means no application tables before the first migration; PostgreSQL
  catalog objects and the database itself are excluded.
- “same database” means the single disposable `fitmind_migtest` database in the
  one task container for the entire up → SQL checks → down 2 → up → SQL checks
  sequence.
