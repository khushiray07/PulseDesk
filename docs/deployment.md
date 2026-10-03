# PulseDesk deployment: Vercel + Render + Neon

This guide prepares the existing application for assignment review. No live deployment is implied by the presence of these files. Production URLs, Neon credentials, Google configuration, and the attachment hosting plan must be supplied before deployment can be verified.

## Routing and authentication

```text
Browser → https://<confirmed-vercel-domain>
          /api/* → Vercel external rewrite → https://<confirmed-render-domain>/api/*
                                            Express → Neon (tickets + sessions)
                                                    → attachment adapter (temporary or private S3)
```

The browser uses one origin. `/api` remains the frontend API base, including Google login and attachment downloads/previews. Vite's development/preview proxy is local tooling only; Vercel uses `client/vercel.mjs` with Root Directory `client` for production routing. Its API rewrite precedes the React Router fallback, so refreshing `/dashboard` or `/tickets/<id>` loads the SPA and an API error remains an API response.

The public callback will be on the **confirmed Vercel domain**, through `/api/auth/google/callback`. Do not register a guessed Vercel name or the direct Render callback for this architecture. External rewrites preserve the browser URL; see [Vercel rewrites](https://vercel.com/docs/routing/rewrites).

Sessions remain in PostgreSQL. Cookies remain host-only (no Domain), HttpOnly, Secure in production, SameSite=Lax, with an eight-hour authentication lifetime. No JWT or third-party cookie change is needed. All ticket/user/attachment APIs still require authentication. Mutations still require the session's CSRF token and validate a supplied Origin against `APP_ORIGIN`.

CORS exposes responses only to the exact `APP_ORIGIN`, allows credentials and the `X-CSRF-Token` request header, and supports upload/mutation preflights. Other origins receive no CORS permission; existing CSRF middleware still rejects foreign-origin mutations. CORS is a browser permission mechanism, not a substitute for authentication. API responses use `Cache-Control: no-store`; do not enable rewrite caching.

## Vercel settings

Use the free Hobby project, import `khushiray07/PulseDesk`, branch `main`. Create this project after Neon and the Render service, following the deployment order below.

| Setting | Exact value |
| --- | --- |
| Root directory | `client` |
| Framework preset | Vite |
| Node.js version | 24.x |
| Install command | `npm ci --include=dev` |
| Build command | `npm run build` |
| Output directory | `dist` (relative to `client`) |
| Configuration | `client/vercel.mjs` |
| `BACKEND_ORIGIN` | Actual HTTPS Render service origin, with no path, query, or credentials |
| `VITE_API_BASE_URL` | `/api` |

`BACKEND_ORIGIN` is evaluated by the deployment configuration; it is not a browser credential. Configuration fails if it is absent, insecure, or points to localhost. `VITE_API_BASE_URL` is public and bundled into browser JavaScript. Only these public routing values belong in the Vercel project. Database URLs, Google secrets, and session secrets belong on Render.

The Axios client, Google login link, and attachment content URLs all honor the configured base. Keep `/api` for this deployment: pointing directly to an unrelated Render origin would introduce cross-site cookies and would require a different OAuth topology. Preview deployments should use their own isolated backend/database and exact origin; do not wildcard-allow arbitrary `*.vercel.app` previews on the production backend.

Programmatic `vercel.mjs` is supported by Vercel ([official documentation](https://vercel.com/docs/project-configuration/vercel-ts)); local compilation requires Vercel CLI 54.1.0 or newer. This config evaluates `BACKEND_ORIGIN` in JavaScript and creates literal destination strings; static `vercel.json` does not perform JavaScript template-string interpolation. Do not add a conflicting `client/vercel.json` or root configuration.

For the current Git-imported project, use the dashboard and keep Root Directory `client`. Set `BACKEND_ORIGIN` to the actual Render HTTPS origin and `VITE_API_BASE_URL` to `/api` for Production; set them for Preview as well if testing a preview deployment with its appropriately isolated backend. Build/output paths above are relative to `client`. npm discovers the parent workspace root and uses its committed lockfile. No CLI login is required for this dashboard workflow. A changed environment variable needs a new deployment. `client/.vercelignore` excludes client environment files, dependencies and build artifacts from CLI uploads.

## Render settings

Use a **Free** Node web service connected to the same repository and branch. `render.yaml` is the free-service Blueprint; it explicitly selects temporary attachments for the current demo and does not request a disk or paid instance. Attachment bytes can disappear after restart, redeploy or idle spin-down.

| Setting | Exact value |
| --- | --- |
| Service type | Web Service |
| Name | `pulsedesk-api` |
| Repository / branch | `khushiray07/PulseDesk` / `main` |
| Region | Singapore, matching the existing Neon project |
| Root directory | Repository root (leave empty) |
| Runtime | Node |
| Instance type | Free |
| Auto-deploy | Off during preparation; deploy manually when final settings are ready |
| Build command | `npm ci --include=dev && npm run db:generate` |
| Start command | `npm run db:migrate && npm start` |
| Pre-deploy command | Leave empty on Free |
| Health-check path | `/api/health` |
| Persistent disk | None |

Migrations run before Express starts, and a failed migration prevents startup. Free Render does not offer the paid pre-deploy command, so no pre-deploy setting is needed. See [Render deploy commands](https://render.com/docs/deploys).

Set the following on Render; do not copy the local `.env` wholesale:

| Variable | Production value |
| --- | --- |
| `NODE_VERSION` | `24.11.1` (or another supported Node 24 patch) |
| `NODE_ENV` | `production` |
| `HOST` | `0.0.0.0` |
| `PORT` | Use Render's supplied value; do not hardcode the local port |
| `DATABASE_URL` | Neon production PostgreSQL URL with its supplied TLS parameters |
| `APP_ORIGIN` | Exact confirmed Vercel HTTPS origin, no trailing path |
| `GOOGLE_CALLBACK_URL` | Exact confirmed public Vercel callback URI |
| `GOOGLE_CLIENT_ID` | Production Google Web Application client ID |
| `GOOGLE_CLIENT_SECRET` | Production client secret, stored as a provider secret |
| `SESSION_SECRET` | Stable random secret of at least 32 characters; template can generate it |
| `TRUST_PROXY` | `1` |
| `ATTACHMENT_STORAGE_DRIVER` | `temporary` for the explicitly disposable demo; `s3` for durable attachments |
| `S3_ENDPOINT` | Provider's HTTPS S3 API origin; for R2, its account endpoint |
| `S3_REGION` | `auto` for R2; actual region for another provider |
| `S3_BUCKET` | Private bucket name |
| `S3_ACCESS_KEY_ID` | Bucket-scoped access key; server secret |
| `S3_SECRET_ACCESS_KEY` | Secret access key; server secret |
| `S3_FORCE_PATH_STYLE` | `true` for the prepared S3-compatible setup |

The `S3_*` variables are required only when selecting `s3`; temporary mode needs no bucket or storage credentials. Leave `ATTACHMENT_STORAGE_DIR` unset in temporary mode to use the operating system's temporary directory. Do not set `TEST_DATABASE_URL` or local development credentials on the production service. Retain the same session secret across redeploys. The free service has one instance; shared PostgreSQL sessions still survive application restarts.

Render terminates HTTPS at its load balancer and passes HTTP to Express. `TRUST_PROXY=1` trusts the immediate Render proxy so Express recognizes HTTPS and issues Secure cookies. This does not mean blindly trusting the whole Vercel/Render chain. The Express port must remain behind Render's load balancer, which must control forwarded headers. Verify the cookie on the actual deployed path; do not disable Secure if it fails. References: [Render web services](https://render.com/docs/web-services), [Express proxy trust](https://expressjs.com/en/guide/behind-proxies/).

### Backend-only preparation while the frontend is pending

The Neon production database has been provisioned and verified: all five migrations are applied, their checksums match, all six application tables exist, and `pg_trgm` works. A read-only check using the session driver's `pg.Pool` configuration connected over TLS and read the `sessions` table successfully. No seed data was added. Copy the same pooled `DATABASE_URL`, including TLS parameters, privately from the ignored `server/.env.production` into Render. Neither the local `.env` nor the production file is uploaded to GitHub or read automatically by Render.

For this stage, use Render's dashboard; no Render CLI installation or login is needed. Connect the GitHub account, choose **New → Web Service**, select the repository and use the table above. Ensure the committed deployment preparation is pushed to `main` before Render builds it. The manual dashboard flow requires entering each variable yourself; `SESSION_SECRET` is generated automatically only when using the Blueprint. Use Render's secret generator or privately generate a stable random value of at least 32 characters.

For the current temporary-attachment demo, set `ATTACHMENT_STORAGE_DRIVER=temporary` in Render and enter the Neon URL and fixed settings. No S3 bucket or credentials are needed. For durable attachments, select `s3` and configure the private bucket instead. Keep automatic deployments off while final origins and OAuth credentials are pending. Creating a web service triggers an initial deployment; the current application deliberately refuses to start without valid production authentication and storage settings. Do not treat that incomplete configuration as an application regression or relax the guards to make it green.

`APP_ORIGIN` means the browser application's eventual confirmed HTTPS origin. It is not automatically the Render backend URL. `GOOGLE_CALLBACK_URL` must use that same browser origin followed by `/api/auth/google/callback`, because login starts through the frontend's `/api` proxy and the OAuth transaction cookie belongs to that browser origin. Using a direct Render callback with the frontend proxy would lose the cookie containing the OAuth state. CORS alone cannot fix this or make SameSite=Lax cookies work with unrelated frontend/backend sites.

No frontend deployment is needed to prepare these settings. Until its actual public origin is confirmed, final `APP_ORIGIN`, Google registration and a successful production login remain pending. Do not invent a frontend domain, use localhost for production, or register a temporary Render callback. Keep Secure, HttpOnly, host-only cookies and SameSite=Lax unchanged; keep the existing session-backed CSRF token and exact Origin check unchanged. Vite's proxy remains local tooling and does not provide production routing.

After Render obtains a public URL, record it as the backend origin for the later frontend proxy. The Google redirect URI will still be the confirmed browser origin, not that Render URL. Once the browser origin is known, enter `APP_ORIGIN` and `GOOGLE_CALLBACK_URL`, register the exact callback in the production Google Web Application client, enter its client ID/secret in Render, and redeploy. Preserve the existing local client/redirect; add allowed test users while Google's consent screen remains in Testing. Detailed Google steps are below.

After successful startup, verify the direct Render `/api/health` returns `200` and `{ "success": true, "data": { "status": "ok" } }`, and `/api/tickets` returns `401` without authentication. Full login and CSRF/browser-cookie checks require the final browser routing; local tests do not replace these live checks. Attachment durability checks apply only to S3 mode with a configured bucket. Free Render can sleep after 15 idle minutes, so allow it to wake before diagnosing an initial request failure.

## Neon database and migrations

Create a separate production Neon project/database. Choose a region close to the Render region. Obtain the connection string from Neon's Connect dialog, keeping the supplied TLS parameters (such as `sslmode=require`). Store it only in Render's `DATABASE_URL` secret. The Prisma client and `connect-pg-simple` both use this variable.

The application uses Prisma 6.19.3. Neon's current pooling supports Prisma migrations, so no `directUrl` schema change is required for this deployment ([Neon explanation](https://neon.com/blog/better-postgres-with-prisma-experience)). A direct connection can also be used for the migration command if preferred; inject it for that command only rather than changing local `.env`.

The exact deploy migration command, from the repository root in the production environment, is:

```sh
npm run db:migrate
```

This runs `prisma migrate deploy` in the server workspace. The prepared Render start command runs it after the build has generated Prisma, before Express starts. It applies the existing five committed migrations, including the `sessions` table and `CREATE EXTENSION IF NOT EXISTS pg_trgm`. Use neither `prisma db push`, `migrate dev`, nor `migrate reset` against production. No new migration is needed for these hosting changes.

Neon supports `pg_trgm` ([extension guide](https://neon.com/docs/extensions/pg_trgm)). After migrations, verify using the production Neon SQL editor:

```sql
SELECT extname FROM pg_extension WHERE extname = 'pg_trgm';
SELECT to_regclass('public.sessions');
SELECT migration_name, finished_at FROM "_prisma_migrations" ORDER BY migration_name;
```

Seeding is **optional**, not part of deployment/startup. On a fresh assignment demo database, run the production seed command below once if sample tickets and six sample support users are wanted. The seed uses stable-ID upserts and preserves existing records, but these are demo identities/data; do not seed a real support workspace automatically. Google login creates/links the signed-in user without needing a seed.

Local `server/.env`, its PostgreSQL databases, local uploads, and the dedicated `_test` database remain separate. Do not import local data or run production commands with local URLs unless intentionally doing a separate migration project.

## Attachment storage decision

Ordinary Render filesystem storage is ephemeral, so Free Render must use object storage for durable attachment bytes. The existing adapter now supports `ATTACHMENT_STORAGE_DRIVER=s3` in production. Development defaults to `local` and retains its current directory and files. Tests explicitly force `local` with generated isolated directories, even if S3 variables are present.

The user has explicitly selected disposable attachments for the current demo. Set `ATTACHMENT_STORAGE_DRIVER=temporary` in Render and leave `ATTACHMENT_STORAGE_DIR` unset. This reuses the local adapter under the operating system's temporary directory (`/tmp/pulsedesk-attachments` on Render) without requiring S3 credentials. The normal production `local` guard is unchanged; temporary storage requires this explicit driver selection. Authentication, sessions, CSRF and upload validation are unchanged. No database migration is needed.

Temporary bytes can disappear after restart, redeploy or idle spin-down. Neon retains ticket data and attachment metadata; a missing attachment download returns the existing `404 ATTACHMENT_FILE_MISSING` response. Users can still delete its metadata through the existing attachment delete endpoint. Do not promise attachment persistence in this mode. Switching to S3 does not copy existing temporary files; upload needed files again after switching.

The adapter uses the official AWS SDK with configurable endpoint/region/bucket, signed private writes/reads/deletes, and the same generated storage keys. Uploads retain conditional no-overwrite behavior. Missing objects map to the existing missing-file response. The existing upload transaction is allowed up to 30 seconds to accommodate a bounded remote write; validation, caps, database records, rollback cleanup, and authenticated content routes remain unchanged. No migration is needed.

Cloudflare R2 Standard storage is a suitable S3-compatible option: its included monthly allowance is currently 10 GB-months, 1 million Class A operations and 10 million Class B operations, with free direct egress. Usage beyond the allowance is billable, and enabling R2 involves a subscription checkout; a free allowance is not an unlimited spending cap. Review that checkout yourself and use provider billing controls. No bucket or subscription has been created. See [R2 setup](https://developers.cloudflare.com/r2/get-started/) and [pricing](https://developers.cloudflare.com/r2/pricing/).

If switching the Render service to durable S3 storage later:

1. Create a **private**, Standard-class bucket (for example `pulsedesk-attachments`). Leave public `r2.dev` access/custom public domains disabled.
2. Generate Object Read & Write S3 credentials restricted to this bucket. Enter them directly in Render's environment settings (or the ignored production file), never in chat or Git.
3. Copy the provider's S3 endpoint to `S3_ENDPOINT`. R2 uses `https://<account-id>.r2.cloudflarestorage.com`, with `S3_REGION=auto`. For another S3-compatible provider, use its endpoint and region. See [R2's S3 setup](https://developers.cloudflare.com/r2/get-started/s3/).
4. Keep the bucket private. The Express server serves uploads/downloads through existing authenticated `/api/tickets/.../attachments/.../content` endpoints. Bucket browser CORS and public/signed URLs are not required by this server-proxied design.
5. After deployment, upload/view/download/delete a sample attachment, restart Render, and verify retained files. Back up both Neon metadata and object storage.

The protocol test uses actual SDK requests against a local fake S3 server, not a cloud bucket. It verifies signed requests, byte preservation across new adapter instances, conditional writes, idempotent deletion, missing-file errors, and key/config validation. Actual provider permissions/connectivity remain a live check.

## Google Cloud setup after URLs are confirmed

Prefer a separate production OAuth Web Application client. Keep the local client and local variables unchanged. After Vercel routing is live and `/api/health` reaches Render:

1. Copy the **actual production Vercel origin** into Render's `APP_ORIGIN`.
2. In Google Cloud → Google Auth Platform → Clients → production Web Application client, add the **Authorized redirect URI** equal to that exact origin followed by `/api/auth/google/callback`.
3. Copy the identical full URI into Render's `GOOGLE_CALLBACK_URL`.
4. Set the production client ID/secret on Render. Restart/redeploy Render after these changes.
5. For an External consent screen in Testing, add the reviewer accounts as Test users. Review the consent-screen audience before final review. Use only the existing `openid email profile` scopes.

Authorized JavaScript origins are not required by this server-side OpenID Connect flow: there is no Google JavaScript SDK. If an origin is entered, use the exact confirmed Vercel HTTPS origin with no path. See [Google server-side OAuth setup](https://developers.google.com/identity/protocols/oauth2/web-server).

For the existing local client, retain `http://127.0.0.1:5173/api/auth/google/callback`; if sharing a client, add the production URI without deleting that local URI. Keep local `APP_ORIGIN=http://127.0.0.1:5173`. Do not substitute `localhost` for `127.0.0.1` without updating all local values and the registered redirect.

## Deployment order and final smoke test

1. **Neon first:** sign in at [Neon Console](https://console.neon.tech), choose Free, and create `pulsedesk`. Use a region close to the intended Render service. Keep the default PostgreSQL version/database unless you have a specific reason to change them. In Connect, enable the pooled connection and copy the complete URL, including TLS parameters, privately into `DATABASE_URL` in `server/.env.production`. A blank ignored production file has been prepared from `deploy/production.env.example`; do not overwrite local `server/.env`. No CLI sign-in is needed for this dashboard workflow.
2. **Render next:** create a Free web service from the GitHub repository, reserve its actual service URL, and configure the commands above. Set `ATTACHMENT_STORAGE_DRIVER=temporary` for the selected disposable demo and enter the Neon/auth secrets directly in its dashboard. Choose private S3-compatible storage instead if attachment durability is required. `APP_ORIGIN` and the production Google callback remain pending the confirmed Vercel URL. Initial startup may fail closed until these required settings are available; do not use guessed domains or disable authentication to make an intermediate deploy green. Render dashboard setup does not require a CLI login.
3. **Vercel next:** create/import the Free Hobby project with Root Directory `client` and the exact settings above. Set `BACKEND_ORIGIN` to Render's actual service origin and `VITE_API_BASE_URL=/api`; deploy the static frontend and record its actual stable production URL. Until Render starts successfully, its API proxy may return an upstream error. The dashboard workflow requires no CLI login. For local CLI use, sign in with `npx --yes vercel@54.1.0 login` if needed; the current workstation's CLI is already signed in.
4. Set Render's `APP_ORIGIN` to that observed Vercel origin, configure Google credentials and the actual public callback, and redeploy Render. Confirm direct Render `/api/health` and Vercel `/api/health` both return matching JSON, not SPA HTML. Confirm protected `/api/tickets` returns 401 without a session. Register the confirmed exact public callback in Google Cloud before testing sign-in.
5. Verify the production login page and refresh `/dashboard` and a ticket detail route. Complete **real Google sign-in** with an authorized reviewer account. In DevTools, check `pulsedesk.sid` is host-only, HttpOnly, Secure, SameSite=Lax; confirm authenticated responses are not cached.
6. Verify ticket listing, `pasword` fuzzy search, status/priority filters, date sorting, pagination/counts, and filter persistence after refresh.
7. Create a ticket with formatted rich text; upload/view/download an attachment; assign two users; post a comment; update the ticket. Refresh and confirm all persisted. With S3, redeploy/restart Render and confirm the attachment still loads. With temporary storage, attachment bytes may be lost; verify ticket data remains, unavailable bytes return a safe 404, and stale attachment metadata can be deleted.
8. Log out, confirm protected APIs return 401, then sign in again. Confirm foreign-origin mutation attempts fail and no wildcard CORS header is returned.

For migration/status/optional seed from the workstation, after privately setting the **Neon production URL** in the separate ignored file, use these commands from the repository root. They explicitly load the production file; verify it targets Neon before running them. No Neon CLI login is needed because Prisma uses that connection string:

```sh
node --env-file=server/.env.production node_modules/prisma/build/index.js migrate deploy --schema server/prisma/schema.prisma
node --env-file=server/.env.production node_modules/prisma/build/index.js migrate status --schema server/prisma/schema.prisma
# Optional: demo seed on the fresh Neon assignment database only.
node --env-file=server/.env.production server/prisma/seed.js
```

Free-tier limitations: Render sleeps after 15 idle minutes and may take about a minute to wake; the existing 15-second API timeout can show a retry state during that cold start. Warm `/api/health` before the assignment demo and retry after wake-up. Render also limits free usage and outbound traffic; Neon and the storage provider have their own quotas. See [Render free service limitations](https://render.com/docs/free). Do not enable paid upgrades or promise unrestricted free usage.

Automated local verification commands (run database suites sequentially):

```sh
npm test
npm run test:e2e
npm run lint
npm run test:e2e:preview
```

The last command includes the production frontend build. Tests use only the explicitly isolated `_test` database, generated test attachment directories, and mocked Google network boundary. They do not verify real Google consent or live Vercel/Render/Neon routing. Those checks remain manual/live until URLs and accounts are available.

## Deployment record

| Item | Status |
| --- | --- |
| Vercel production URL | Not deployed/confirmed |
| Render service URL | Not deployed/confirmed |
| Neon production database | Provisioned; five migrations/checksums, application tables and `pg_trgm` verified; no seed data added |
| Google production callback | Pending confirmed public routing |
| Attachment plan | Explicitly temporary attachments selected for Free Render; durable S3 adapter remains available |
| Live smoke test | Pending deployment and real Google login |
| Local verification | 172 API/isolation tests (including temporary storage/lost files), lint and Render YAML validation passed; previous Prisma generation and production build passed; previous full production-browser reruns had timing/teardown failures (38/39, then 37/39), and all three affected tests passed a focused rerun |

Replace these entries only after observing the actual provider results. Keep secrets out of this guide, frontend variables, Git, screenshots, and logs. `.gitignore` ignores `.env*` variants (except checked-in examples); local environment files must stay untracked.
