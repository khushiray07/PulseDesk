# PulseDesk

A focused support ticket workspace built with React, Express, Prisma, and PostgreSQL. Create customer requests, find tickets with combined search/filter/sort controls, and update status, priority, and rich-text descriptions. Support users can share ticket assignments and post comments. Tickets and attachment metadata persist in PostgreSQL; attachment files use a replaceable local storage adapter.

## Quick start

Prerequisites: Node.js 24 LTS (or Node.js 22.12+), npm, and either PostgreSQL command-line tools or Docker with its daemon running. Google Chrome is needed only for browser tests.

Run from the repository root:

```sh
npm ci
cp server/.env.example server/.env
```

Choose **one** database option:

```sh
# Option A: installed PostgreSQL tools (initdb, pg_ctl, psql, createdb on PATH)
npm run db:local

# Option B: Docker
docker compose up -d --wait
```

Both options create `pulsedesk` and `pulsedesk_test` on `127.0.0.1:55432`. Then:

```sh
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). The API runs on port 5000. Vite proxies `/api`, so the browser uses a single origin.

If using your own PostgreSQL instance, create separate development and test databases and update `server/.env` before migrating. The database does not need to use port 55432; that port keeps this project's optional local instance separate from the usual port 5432.

The seed also makes six deterministic support users available: Khushi Ray, Aisha Sharma, Rohan Mehta, Neha Kapoor, Arjun Rao, and Vikram Singh. User upserts match canonical email and preserve existing IDs and profile edits.

The seed inserts 30 realistic tickets with all nine status/priority combinations and varied timestamps. Re-running it preserves existing tickets and edits; it does not reset your data. Example email domains are fictional.

Fuzzy search requires PostgreSQL's `pg_trgm` extension, enabled by the new migration when you run `npm run db:migrate`. Existing installations should run that command once to apply the enhancement. The database role needs `CREATE` permission on the database to enable this trusted extension; alternatively, a database administrator can enable it before migrations run. See the [PostgreSQL pg_trgm documentation](https://www.postgresql.org/docs/14/pgtrgm.html).

## Environment

| Variable | Purpose | Default/example |
| --- | --- | --- |
| `DATABASE_URL` | Development PostgreSQL connection | See `server/.env.example` |
| `TEST_DATABASE_URL` | Separate database whose name ends in `_test` | See `server/.env.example` |
| `PORT` | Express listening port | `5000` |
| `HOST` | Express listening host | `127.0.0.1` |
| `API_PROXY_TARGET` | Vite development/preview API target | `http://127.0.0.1:5000` |
| `ATTACHMENT_STORAGE_DIR` | Persistent local file directory (optional) | Project-root `.local/attachments` |
| `PLAYWRIGHT_EXECUTABLE_PATH` | Optional Chrome/Chromium executable for browser tests | Installed Google Chrome by default |

Environment files, local PostgreSQL data, build output, and test artifacts are ignored by Git. The optional native database is stored in `.local/postgres` and accepts local connections on loopback only. Its trust authentication is intended for this local development setup. The Docker option uses the example development credentials from the environment file.

If port 5000 is occupied, set `PORT` in `server/.env`, then launch with a matching proxy, for example:

```sh
API_PROXY_TARGET=http://127.0.0.1:5001 npm run dev
```

## Checks and tests

```sh
npm run lint
npm test
npm run test:e2e
npm run test:e2e:preview
npm run build
```

`npm test` runs 100 checks with Vitest and Supertest: the original 33 database-backed API tests, six test-database isolation checks, 13 fuzzy-search checks, 13 attachment checks, 14 rich-text checks, and 21 collaboration checks. Coverage includes required-field/email/enum validation, persisted creation and updates, combined title/email search and filters, sorting (including identical creation timestamps), pagination metadata, literal wildcard searches, global counts, and consistent HTTP errors. Fuzzy-search coverage includes title/email typos, literal-match precedence, date sorting, combined filters, multiple pages and out-of-range pages, precise known-email lookup, unchanged response fields, and SQL-looking input.

`npm run test:e2e` runs 30 Playwright checks against the actual API and React application in Chrome. It verifies creation/update persistence after browser refresh, summary independence, query restoration after navigating to details, inline validation, modal focus/Escape, mobile layouts, loading, empty results, and retry behavior. It also checks retained input after failed mutations, prevention of duplicate submissions, protection against stale search responses, and fuzzy search through the existing dashboard with filters and sorting. Network failures and the empty-dataset UI are simulated with controlled browser routes; the normal create/update/query flows use PostgreSQL. Nine content tests cover formatted create/edit/reload, multiple attachments, paste and drag/drop, failed-upload retry without duplicate creation, validation/removal, persisted deletion, legacy descriptions, sanitization, mobile content controls, and JPEG/WEBP content detection/previews. Seven collaboration tests cover multiple assignment/add/remove/refresh, comments with chosen authors and timestamps, failed comment submission and retained drafts, literal HTML comments, network recovery, assignment removal retry, and mobile layouts.

`npm run test:e2e:preview` builds the production bundle and runs the same 30 browser checks against Vite preview.

All test commands require an explicit `TEST_DATABASE_URL` whose database name ends in `_test`. They reject a test URL pointing at the development database, even when connection credentials or URL schema parameters differ. Tests migrate and reset only the test database. Each run also receives a generated `.local/test-attachments/<UUID>` storage directory, overriding any development storage setting, and removes it on completion. Run suites sequentially because they share test fixtures. Browser test servers use ports 5010 and 5174 and shut down afterward; they can run while the development app is open.

If Chrome is not installed, install it or set `PLAYWRIGHT_EXECUTABLE_PATH` to a compatible Chromium executable. Failure traces/screenshots are written to `test-results/`, with an HTML report in `playwright-report/`.

For a local preview of the production bundle:

```sh
npm run build
# Terminal 1
npm start
# Terminal 2
npm run preview -w client
```

Open the preview URL printed by Vite (normally port 4173). This is a local preview, not a production deployment.

Stop the development application with Ctrl+C. Stop the optional native database with `npm run db:stop`, or stop Docker with `docker compose down`. Docker retains data in its named volume; the native setup retains `.local/postgres`.

## API contract

| Method | Path | Behavior |
| --- | --- | --- |
| POST | `/api/tickets` | Create from title, description, customerEmail, priority; status defaults to OPEN; 201 |
| GET | `/api/tickets` | Backend search/filter/sort/pagination; 200 |
| GET | `/api/tickets/summary` | Unfiltered total/open/inProgress/resolved counts; 200 |
| GET | `/api/tickets/:id` | Full ticket detail; 200 or 404 |
| PATCH | `/api/tickets/:id` | Update status, priority, and/or description; 200 or 404 |
| POST | `/api/tickets/:id/attachments` | Upload one multipart `file`; 201 |
| GET | `/api/tickets/:id/attachments` | List attachment metadata; 200 |
| GET | `/api/tickets/:id/attachments/:attachmentId/content` | Image preview or document download; `?download=1` forces download |
| DELETE | `/api/tickets/:id/attachments/:attachmentId` | Delete file and metadata; 200 or 404 |
| GET | `/api/users` | List support users in stable name/ID order |
| GET | `/api/tickets/:id/assignees` | List assignments with user profiles and assignment times |
| POST | `/api/tickets/:id/assignees` | Assign `{ userId }`; 201, duplicate 409 |
| DELETE | `/api/tickets/:id/assignees/:userId` | Remove only the assignment; 200 or 404 |
| GET | `/api/tickets/:id/comments` | List comments oldest first with author profiles |
| POST | `/api/tickets/:id/comments` | Post plain text `{ userId, content }`; 201 |
| GET | `/api/health` | Local server availability check |

Example list query:

```text
/api/tickets?search=payment&status=OPEN&priority=HIGH&sort=newest&page=1&limit=10
```

Search preserves trimmed, case-insensitive exact and literal substring matching on title **or** email. It additionally accepts typo-tolerant matches, such as `pasword` for "Password reset issue" and `paymnt` for "Payment failed", through PostgreSQL trigram functions. Status and priority filters apply before ranking and pagination; the total count uses the identical match conditions.

Results rank full-field exact matches first, literal substring matches second, and fuzzy matches last. Fuzzy matches rank by decreasing similarity. Creation-date sorting is `newest` (default) or `oldest` within each literal group and between fuzzy matches with equal similarity; ID breaks remaining ties. Searches without a query retain the original date-only sorting. Every page contains at most 10 tickets. `page` defaults to 1; if supplied it must be a positive integer. Optional `limit` must equal 10. The endpoint parameters and response fields are unchanged.

Ordinary alphanumeric search words/phrases of at least four characters use `word_similarity` against title and email with a minimum score of 0.5. Email queries containing `@` use whole-email `similarity` with a minimum score of 0.6, and only add fuzzy results when there are no literal matches under the active filters. This keeps known customer-email searches precise. Short queries and punctuation-heavy queries remain literal; `%`, `_`, and backslashes retain their existing literal meaning. Thresholds are explicit in the service, with no connection-wide similarity settings or new API parameters.

```json
{
  "success": true,
  "data": {
    "tickets": [],
    "pagination": { "page": 1, "limit": 10, "total": 0, "totalPages": 0 }
  }
}
```

Ticket mutations/detail return the ticket directly inside `data`. A ticket includes `id`, `title`, `description`, `customerEmail`, `priority`, `status`, `createdAt`, and `updatedAt`; dates are ISO timestamps. Summary `data` contains `total`, `open`, `inProgress`, and `resolved`.

Allowed statuses: `OPEN`, `IN_PROGRESS`, `RESOLVED`. Priorities: `LOW`, `MEDIUM`, `HIGH`. Creation requires a nonblank title of at most 120 characters, a nonblank description, a valid email of at most 255 characters, and a priority. Unknown body/query fields are rejected. PATCH requires at least one editable field. IDs and timestamps are server-generated.

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please check the supplied values.",
    "details": { "customerEmail": "Enter a valid customer email address." }
  }
}
```

Errors use 400 for invalid input/JSON, 404 for missing tickets/routes, 413 for request bodies larger than 1 MB, and 500 for unexpected failures. Unexpected failures are logged on the server with a safe message returned to the client.

## Architecture and implementation choices

```text
React + Vite + React Router + Tailwind CSS
                  | Axios / REST JSON
Express routes -> controllers -> Zod validation
                  | ticket services
               Prisma -> PostgreSQL
```

The modular monolith has one ticket domain with `Ticket`, `Attachment`, `User`, `TicketAssignee`, and `Comment` models. HTTP handling, validation, database queries, and error handling are separated. `server/src/app.js` can be tested without opening a port; `server/src/server.js` handles startup and shutdown. SQL migration files include enum/length/nonblank constraints and a creation-date/ID index.

List results and matching counts use a repeatable-read transaction so pagination metadata describes the same database snapshot. Search uses parameterized `Prisma.sql` / `$queryRaw` queries inside the existing ticket service to access trigram functions and ranking; user input is bound as data. Lists without search continue to use the existing Prisma model queries. Summary uses one unfiltered grouped query. There is no in-memory data store or frontend pagination. The extension migration changes no ticket fields or existing data; no new indexes are needed for the assignment's small dataset. Prisma 6 is pinned to match the schema-based configuration used here; the transitive `deepmerge-ts` dependency is overridden to its patched 8.x release and verified with generation, migrations, and tests. See the [Prisma 6 data-source documentation](https://docs.prisma.io/docs/orm/v6/prisma-schema/overview/data-sources).

The React UI uses small API hooks rather than an additional global state library. URL parameters retain the queue view, search is debounced by 300 ms, and aborted requests cannot overwrite newer results. Summary/list requests fail independently. The native dialog provides modal keyboard containment, explicit initial focus, Escape handling, and focus restoration. Fonts are bundled locally; there are no runtime font/CDN dependencies. Tailwind uses its [Vite integration](https://tailwindcss.com/docs/installation/using-vite).

## Attachments and rich descriptions

Run `npm run db:generate` and `npm run db:migrate` after upgrading. The additive `20261002010000_add_attachments` migration creates attachment metadata, a ticket foreign key with cascade deletion, a unique storage key, a per-ticket lookup index, and a file-size constraint. It does not rewrite existing descriptions or tickets. File bytes are never stored in PostgreSQL.

The storage boundary is `server/src/services/attachment-storage.js` (`write`, `read`, `remove` by generated key). Local files live in ignored `.local/attachments`, independent of the server's working directory; use `ATTACHMENT_STORAGE_DIR` to select another persistent directory. Back up both this directory and PostgreSQL. Restarting retains files. Replacing this adapter with object storage later does not change ticket business logic; there is no S3 infrastructure here.

Uploads use maintained Multer with bounded memory (one file per request, 5 MiB maximum) and at most 10 attachments per ticket. `file-type` detects PNG/JPEG/WEBP/PDF from bytes rather than trusting the browser's MIME value. TXT requires a `.txt` filename and strictly valid nonbinary UTF-8. Original filenames are cleaned for display; server-generated UUID keys determine storage paths. Keys and absolute paths are excluded from public metadata. Downloads use explicit MIME types, `nosniff`, a sandbox CSP, and attachment disposition for documents; images can render as thumbnails. Ticket/attachment IDs must be valid UUIDs and belong together. A ticket-row lock serializes concurrent uploads when enforcing the cap. A failed database write removes the newly written file; failed uploads preserve the ticket.

`AttachmentUploader` supports browsing, dropping, and clipboard files, and displays thumbnails, names, sizes, types, readiness, upload status, individual failures, and removal controls. Creation saves the ticket first, then uploads files sequentially. Partial failures keep the form and the saved ID: retry uploads, remove failed files and continue, or open the saved ticket. Successful files are not uploaded again. Existing tickets support additional uploads and attachment deletion.

`RichTextEditor` uses [TipTap React + StarterKit](https://tiptap.dev/docs/editor/getting-started/install/react), restricted to paragraphs, bold, italic, lists, links, inline code, code blocks, and undo/redo. The toolbar stays small. Pasted formatting is sanitized to supported elements. Clipboard files take precedence over clipboard text when both are present: image paste anywhere in the create form or description editor queues attachments, while ordinary text paste goes to the editor. Image drops in the editor also queue attachments. No image nodes or base64 data belong in description HTML.

The persisted format for formatted descriptions is **sanitized HTML in the existing `description` string**, preserving the API response fields. Legacy plain-text strings remain unchanged and render through React as text with preserved line breaks; strings containing HTML tags are treated as rich content. Editor initialization safely escapes plain text. Queue excerpts show text rather than HTML tags. PATCH additionally accepts `description`; a separate edit/save/cancel form on the detail page preserves existing property updates.

The backend uses [sanitize-html](https://github.com/apostrophecms/sanitize-html) with an explicit allowlist of supported tags and link attributes. Scripts, styles, event handlers, embedded media, images, and unsafe link schemes are stripped. The frontend sanitizes again with [DOMPurify](https://github.com/cure53/DOMPurify) before rendering and importing pasted HTML. Links use `noopener noreferrer`. Descriptions must contain visible text, including after sanitization; `<p></p>`, nonbreaking spaces, invisible characters, and image-only descriptions are rejected. Maximum size is 50,000 source HTML characters and 10,000 text characters.

Local storage serves a single application instance; shared/multiple-instance deployments need a shared volume or object-storage adapter. File signature checks are type validation, not malware scanning. There is no antivirus service, authentication, resumable upload, or distributed transaction between files and PostgreSQL. Ordinary write failures have compensation, but abrupt process/host failures can leave orphan files that require operational cleanup. Any future ticket-deletion service must remove associated files as well as cascading metadata.

## Collaboration: users, multiple assignees, and comments

Upgrade with `npm run db:generate`, `npm run db:migrate`, and `npm run db:seed`. The single additive `20261002020000_add_collaboration` migration creates `users`, `ticket_assignees`, and `comments`; it does not alter existing ticket/attachment columns or reset data. Existing tickets have zero assignments and comments. The ticket seed is unchanged apart from calling a separate deterministic user seed. There are no passwords, sessions, roles, login routes, or Google integration.

`User` has a UUID identity, name, unique canonical lowercase/trimmed email, optional avatar URL, and creation/update timestamps. Comments and assignments reference this stable UUID; future authentication can resolve an authenticated principal to the same User instead of replacing collaboration relationships. Any future user-creation/profile-writing code must normalize email before persistence. Seeded email domains are fictional, and seed upserts preserve existing identities and profile edits.

`TicketAssignee` is an explicit join model with `(ticketId, userId)` as its primary key and `assignedAt`. The database rejects duplicates even for concurrent requests; the API returns `409 ALREADY_ASSIGNED`. Removing an assignment leaves its ticket and user intact. Assignments list by assignment time and user ID. Missing tickets/users and malformed UUIDs use the existing structured error format. Assignee chips and a keyboard-accessible Add chooser hide users already assigned. HTTPS avatars render when available, with initials as fallback for missing/failed images. Loading/error/retry states remain local to the collaboration panels.

`Comment` has a UUID, ticket/user foreign keys, plain-text content, and creation/update timestamps. An **explicit Comment author dropdown** selects a support User for now. This is a temporary manual-author mechanism, not verified identity. When authentication arrives, the controller can derive `userId` from the authenticated principal while reusing the model/service relationship. Comments reject blank or invisible-only text and have a 5,000-character maximum; HTML-looking text renders literally through React, without HTML parsing. Comments list oldest first with an ID tie-breaker, and include their author's profile and timestamp.

The comment form preserves the selected author and draft on failure, disables inputs and duplicate submissions while pending, clears the draft only on success, and reloads comments afterward. Assignments and comments persist independently of ticket properties, attachments, and description updates. Collaboration modules have dedicated routes, controllers, validators, and services; the existing ticket controller and fuzzy-search service are unchanged.

Ticket foreign keys cascade collaboration records when a ticket is deleted at the database boundary. Assignment-user deletion cascades only assignment rows, while comment-user deletion is restricted to preserve authorship. No user/ticket deletion endpoint is added. Comment edit/delete, dashboard assignee filtering, real-time synchronization, comment pagination, and authenticated author verification are intentionally absent. Large comment histories will need separate pagination work. No new dependencies are introduced.

## Assumptions and limitations

- Medium is preselected in the create form as an implementation assumption; the API requires priority explicitly.
- Tickets use UUIDs, shortened in the queue and shown fully in details. Status, priority, and description are editable after creation; title and customer email remain fixed.
- Creating a ticket opens its detail page so it can be found even when active queue filters would exclude it. Returning restores the previous queue query and refreshes its data.
- Timestamps are stored with timezone support and displayed in the browser's local timezone. Seed dates are relative to the first seed run and remain stable on subsequent runs.
- The small Needs Attention dot is derived from HIGH priority and OPEN status; it is not a stored field or an additional query mode.
- Authentication, Google login, Gmail integration, notifications, analytics, audit history, ticket deletion, and deployment remain outside this enhancement's scope.
- Concurrent edits use last-write-wins behavior. There is no real-time synchronization or optimistic concurrency control.
- Querying uses exact, substring, and trigram matching with offset pagination, which suit the assignment dataset; large datasets would need separate performance work.
- The native PostgreSQL path was verified with PostgreSQL 14.17 on macOS. Docker Compose is provided as an alternative; Docker startup was not verified here because its daemon was unavailable.

## Project references and time spent

Requirements: [PRD](docs/PulseDesk_PRD.pdf). Architecture: [architecture.md](docs/architecture.md). Milestones and acceptance mapping: [development-plan.md](docs/development-plan.md). Static visual references remain in `design/`.

Time spent: approximately 35 minutes of active implementation and verification across the development sessions, excluding the earlier planning discussion and time between sessions. The PRD's 4-6 hours was used as a scope limit, not a reason to add unrelated features.
