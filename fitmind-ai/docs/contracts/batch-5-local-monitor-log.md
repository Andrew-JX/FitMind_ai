# Batch 5 — local monitor JSONL contract

Baseline SHA: `71c7f678aefbbb35be4a250f02eca1c730c73c61`

This contract replaces the external receiver requirement in
`batch-5-production-monitoring-rollout.md` with the user's chosen local-only
delivery policy. Paging and Digest semantics from `fitmind-ry9` remain frozen.

Allowed repository changes:

- `fitmind-ai/deploy/scripts/fitmind-monitor.sh`
- `fitmind-ai/deploy/scripts/test-fitmind-monitor.sh`
- `fitmind-ai/deploy/README.md`
- `fitmind-ai/docs/production-smoke-checklist.md`
- `fitmind-ai/docs/progress.md`
- this contract

Allowed production changes:

- deploy-user monitor config under `~/.config/fitmind-monitor.env`;
- monitor JSONL and rotations under `~/.local/state/fitmind-monitor/`;
- restarting the two existing monitor oneshots and timers for controlled tests.

## Acceptance criteria

1. Machine — with dry-run disabled and no webhook configured, each delivered
   Paging or Digest payload is appended as exactly one compact JSON object plus
   newline to `FITMIND_MONITOR_LOG_FILE`, whose default runtime source is the
   monitor state directory plus `monitor.jsonl`. The directory is mode `0700`
   and every active or rotated log is mode `0600`.
2. Machine — before an append that would make the active file exceed
   `FITMIND_MONITOR_LOG_MAX_BYTES` (default `10485760`), rotation renames the
   active file through numbered generations and retains at most
   `FITMIND_MONITOR_LOG_MAX_FILES` (default `5`) total files, counting the
   active file. Tests enumerate the matching files and assert both the count
   and modes; checking only that `.1` exists is insufficient.
3. Machine — malformed or non-positive rotation values fail before writing.
   Dry-run writes only stdout and creates no log. A missing webhook is valid;
   when an HTTPS webhook is configured, the same canonical payload is retained
   locally before it is sent, and a non-2xx response still exits non-zero.
4. Machine — the isolated shell suite drives the real monitor entrypoint and
   proves Paging firing, unchanged-incident deduplication, recovery, Digest,
   quality-only zero Paging, file append, dry-run no-write, rotation retention,
   permissions, and webhook failure. Fabricating JSON outside the monitor does
   not satisfy this criterion.
5. Production — on the exact deployed candidate SHA, the existing page and
   digest timers are enabled and active without `FITMIND_MONITOR_DRY_RUN` or a
   webhook key. Controlled isolated inputs through the real monitor produce
   exactly one firing record, no duplicate record, one recovery record, one
   Digest record, and quality-only zero Paging records in a temporary local
   sink; production containers and application data are not mutated.
6. Production — the persistent local sink exists with modes from criterion 1,
   both oneshots exit `success/0`, bounded rotation settings are present as
   config key names, and loopback plus public health identify the candidate SHA.
   Raw log contents, user inputs, secrets, and webhook values never enter
   handoff evidence.
7. Machine — `pnpm verify`, both production builds, and the Linux monitor shell
   suite pass for the candidate. The frozen contract is unchanged between its
   contract commit and candidate commit.

## False-green guards

- Redirecting systemd stdout to a file does not pass: the delivery function
  must own JSONL validation, permissions, and rotation.
- Rotating after an oversized append does not pass criterion 2.
- Five backups plus an active file is six total files and does not pass the
  retention definition.
- A webhook-only implementation does not pass local durability.
- Existing dry-run journal output is not evidence of persistent local delivery.
