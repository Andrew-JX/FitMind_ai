# Batch 5 — production monitoring rollout contract

Baseline SHA: `f4488da84dff8c433bf8bda29c58e2b6d2291735`

This follow-on contract authorizes the production installation and verification
that the frozen `fitmind-ry9` candidate deliberately excluded. It does not alter
the Paging/Digest definitions or thresholds frozen by that issue.

Allowed repository changes:

- `fitmind-ai/deploy/systemd/fitmind-monitor@.service`
- `fitmind-ai/deploy/scripts/test-fitmind-monitor.sh`
- `fitmind-ai/deploy/scripts/summarize-monitor-logs.test.mjs`
- `fitmind-ai/deploy/README.md`
- `fitmind-ai/docs/production-smoke-checklist.md`
- `fitmind-ai/docs/progress.md`
- this contract

Allowed production changes:

- deploy-user monitor config under `~/.config/fitmind-monitor.env`;
- deploy-user units under `~/.config/systemd/user/`;
- monitor state under `~/.local/state/fitmind-monitor/`;
- enabling linger and the two monitor timers;
- controlled monitor invocations that do not stop or restart production
  containers, modify application data, or expose secrets.

## Acceptance criteria

1. The service launches the monitor from an explicitly configured absolute
   release checkout, rather than assuming a repository below the deploy user's
   home. A missing/relative path fails before the monitor runs.
2. Automated tests reject the previous hard-coded `%h/FitMind_ai/fitmind-ai`
   wiring and reject a service that omits the configured repository path.
3. On the production host, both isolated monitor suites pass against the exact
   deployed SHA. Page and digest dry-runs execute against the real containers
   without network delivery and without printing a webhook value.
4. API and Web are running with bounded `json-file` rotation (`10m`, five
   files), and the host has persistent user timers with visible next-run times.
5. A controlled receiver test proves exactly one Paging firing event, no second
   event for the unchanged incident, exactly one recovery, and one Digest.
   Quality-only input must produce Digest output and zero Paging notifications.
   The test must not stop production containers or mutate production data.
6. Live timers are enabled only when a private HTTPS canonical-JSON receiver is
   already configured. If no such receiver exists, installation may be proven
   in dry-run mode, but external delivery remains explicitly blocked and Batch
   5 must not be reported fully complete.
7. Repository verification, monitor tests, and production builds pass. No
   webhook URL or application log containing user input appears in evidence.

## False-green guards

- `systemctl is-enabled` alone is insufficient: the oneshot service must finish
  successfully and its journal must show a real invocation.
- A fabricated payload printed by a test is insufficient: delivery semantics
  must be exercised through `fitmind-monitor.sh` with isolated Docker/curl
  boundaries.
- Dry-run output is not evidence of a configured live receiver.
- Existing rollback evidence is recorded separately and is not repeated or
  reclassified as monitoring evidence.
