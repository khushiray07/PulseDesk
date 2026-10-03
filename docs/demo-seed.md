# Production demo fixtures

The optional demo seed uses the existing Prisma schema, upsert pattern and attachment adapter. It adds no migration, API, authentication behavior or storage architecture. The normal `npm run db:seed` command remains the original local 30-ticket seed.

## Dataset

| Fixture | Count |
| --- | --- |
| Tickets | 60 |
| Statuses | 22 Open, 20 In Progress, 18 Resolved |
| Priorities | 20 High, 22 Medium, 18 Low |
| Support agents | 8 |
| Rich-text descriptions | 24 |
| Commented tickets | 18, with 1–4 fixture comments each |
| Fixture comments | 48 |
| Assignment pairs | 43 |
| Multiple-agent tickets | 12 |
| Attachment files/records | 8 on 8 tickets: 3 PNG, 3 PDF, 2 TXT |

Titles cover billing, login/session handling, dashboard querying, validation, error recovery, attachments, formatting and collaboration. Try `paymnt`, `pasword`, `invocie`, `notifiction` and `subscripton`. New customer and agent addresses use `example.com`; existing legacy agent addresses/profiles are retained unchanged when reused.

Dates are fixed across September 3–October 2, 2026, representing the 30 days before this fixture release. Rerunning does not move dates forward. Comments, assignments and worked-ticket updates have deterministic activity timestamps.

## Preservation and idempotency

- Ticket IDs reuse the old `10000000-…` fixture identifiers for the first 30 requests and extend that set to 60. Unchanged legacy scalar fields/timestamps are recognized and conditionally upgraded. An edited ticket is preserved; unrelated occupied identifiers fail safely.
- Eight demo agents have deterministic `51000000-…` IDs when newly created. Existing matching canonical-email or legacy demo agents are reused without updating any user fields. Google-linked fixture identifiers cause a rollback rather than modifying or impersonating that account.
- Comments have deterministic IDs; assignments use the existing composite key. Upserts never overwrite existing comments, assignments, sessions or user profiles. There is no truncation, reset, deletion, or automatic seeding in the normal server startup.
- Metadata is inserted only after each bundled file passes the application's actual validator, is written through its configured adapter, and is read back byte-for-byte. Existing different metadata/content fails safely; missing fixture bytes can be restored. A database failure can leave reusable fixture bytes, but cannot create metadata pointing at files that were never written. The seed never deletes existing objects.
- Edits and other data are preserved, so live totals, per-thread comment counts and distributions can include additional records or differ from the pristine fixture counts above. Sixty fixture tickets yield six full pages only when the database contains no other tickets. The seed never deletes user tickets to force six pages.

## Local commands

From the repository root, with the existing local `server/.env`:

```sh
npm run db:seed:demo
# Local-only verifier: runs the seed twice and checks preservation, counts, file bytes and fuzzy queries.
node --env-file=server/.env scripts/verify-demo.mjs
npm test
```

The verifier refuses remote database URLs and nonlocal storage. Backend tests exercise the actual six-page API query on a fresh, guarded local test database, separate from development data.

Verified locally: 60 fixtures, the status/priority split above, all five typo searches, eight byte-verified attachments, and no changes/duplicates on a second run. Two existing customer tickets, all eight original users (including two Google-linked users), two sessions and existing relationships/files were preserved. The local full queue therefore contains 62 tickets over seven pages; the fixture subset contains 60 over six pages. All 182 backend tests and lint passed.

## Production command — after approval only

Run in the **serving Render web service**, using its existing private Neon `DATABASE_URL` and attachment settings:

```sh
npm run db:seed:demo -- --production
```

Do not run a temporary/filesystem-backed Neon seed from a workstation: files would be written on the workstation and would not be available to the deployed backend. The command guards against this. With S3 configured, the same adapter stores bytes in the shared bucket instead.

Render Free has [no dashboard shell or SSH](https://render.com/docs/ssh). After approval and deployment of these seed files, the free-service way to execute in the serving instance is to explicitly use this **demo-only start command** in the dashboard:

```sh
npm run db:migrate && npm run db:seed:demo -- --production && npm start
```

This intentionally reruns the safe fixture seed on each demo startup, restoring fixture bytes after ephemeral storage loss. It is not configured by this change. The production database, Render settings and Git remote have not been modified during preparation. Do not run the seed during build or in a separate one-off job when using temporary storage; those filesystems are not the serving instance.

[Render temporary files are lost after restart, redeploy or idle spin-down](https://render.com/docs/free). All eight attachment tickets explicitly describe this limitation and the safe missing-file behavior. Returning to the ordinary `npm run db:migrate && npm start` command stops restoration on startup; existing temporary fixture files may then become unavailable. Durable storage requires the existing S3 adapter. Existing user uploads are never recreated, overwritten or deleted by this demo seed.
