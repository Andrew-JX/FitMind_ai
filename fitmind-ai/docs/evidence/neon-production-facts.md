# Neon production facts

> Verified on 2026-08-07 for the FitMind invitation-only production target.
> This record intentionally contains no database hostname, role, password, or connection string.

## Account-level facts confirmed by the operator

| Fact | Confirmed value |
| --- | --- |
| Project name | `FitMind-ai` |
| Project ID | `raspy-hall-57794539` |
| Region | AWS Asia Pacific 1 (Singapore) |
| Plan | Free Plan |
| Default scale to zero | 5 minutes |

Evidence was supplied in the deployment task as Neon console screenshots and an explicit operator
confirmation. Before a public launch, export or capture a release-record screenshot that shows the
Region and Billing/Plan pages together; this Markdown record is an attestation, not a substitute for
the provider console.

The authenticated Neon project API was also queried read-only on 2026-08-07. It independently returned
`platform_id=aws`, `region_id=aws-ap-southeast-1`, PostgreSQL 18, and
`history_retention_seconds=21600` (6 hours) for this project. The API did not expose the billing plan,
so the Free Plan fact remains supported by the operator's Billing-page confirmation.

## Current provider facts

- [Neon product-specific terms](https://neon.com/platform-terms), last updated 2026-08-05:
  self-service Neon services are contracted with Databricks, Inc.; Neon, LLC may bill on its behalf.
- [Databricks privacy notice](https://www.databricks.com/legal/privacynotice):
  `privacy@databricks.com`, Databricks Inc., 160 Spear Street, Suite 1300, San Francisco, CA 94105.
- [Neon pricing](https://neon.com/pricing): Free Plan currently includes up to 6 hours or 1 GB of
  data changes for time travel/restores (whichever limit is reached first), 1 day of UI metrics/logs,
  0.5 GB storage per project, and scale to zero after 5 inactive minutes.

## Deployment consequence

The application and API may run on Tencent Cloud in Shanghai, but all persistent application data is
stored in the Neon Singapore project. Production must therefore use `DATA_RESIDENCY=overseas`, keep
separate cross-border consent enabled, and describe Neon restore history as a provider recovery
window rather than an independent FitMind backup.
