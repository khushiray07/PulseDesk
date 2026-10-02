# PulseDesk development plan

Status: Implemented. The application, migration, 30 seed tickets, API/browser tests, and local setup instructions are complete. See `README.md` for execution and verification.

## Goal and source of truth

Deliver the complete ticket-management workflow locally within the PRD's 4-6 hour implementation constraint. Use `docs/PulseDesk_PRD.pdf` for requirements and `docs/architecture.md` for the architecture. This plan resolves implementation details without changing the frozen PRD.

At planning time, the workspace contained documentation and static design exports with no application scaffold. The two design export directories have identical contents. `design/stitch_pulsedesk_support_ticket_dashboard 2/` is the visual reference; the exports remain intact.

## Implementation decisions

| Area | Planned decision |
| --- | --- |
| Structure | One repository with `client/` and `server/`; modular monolith |
| Language | JavaScript with ESM, consistent with the architecture examples |
| Frontend | React, Vite, React Router, Tailwind CSS, Axios |
| Backend | Node.js, Express, Zod, Prisma, PostgreSQL |
| Tests | Vitest and Supertest; use an isolated PostgreSQL test database for persistence/query tests |
| Screens | `/dashboard` and `/tickets/:id`; redirect `/` to `/dashboard` |
| Creation | Accessible modal on the dashboard |
| Identifiers | Generated UUIDs; full ID in details, shortened display in the list |
| Pagination | Exactly 10 tickets per page; positive integer page, default 1 |
| Search | Trimmed, case-insensitive substring match on title OR customer email |
| Sorting | `newest` or `oldest`, default `newest`; add ID as a stable tie-breaker |
| Priority | Required in API; preselect `MEDIUM` in the form as a documented assumption |
| Status | Server sets `OPEN` at creation; only PATCH can change it |
| Local setup | Frontend on 5173, API on 5000, isolated PostgreSQL on 55432; Vite proxies `/api` |
| Delivery | Local application, migrations, seed script, tests, and README |

Use compatible package versions and a committed lockfile at setup. Record the supported Node version in the README. Keep custom React hooks for request state; add another state/query library only if implementation demonstrates a need.

## Design translation

Reuse the PulseDesk identity, indigo action color, light surfaces, metric cards, status/priority badges, toolbar, table layout, and modal styling. Use the exported HTML as a visual reference while building reusable React components.

The final dashboard contains one search input, four unfiltered summary cards, status/priority/date controls, the ticket list, pagination, and a Create Ticket action. Use stacked ticket cards on mobile. Use the three specified statuses and priorities consistently.

Exclude prototype controls, export actions, SLA analytics, trend/CSAT numbers, assignment controls, user-account controls, notification controls, internal threads, and audit timelines from the implementation. Those designs have no required backing data or workflow. Likewise, omit navigation to unimplemented settings and analytics pages. The Needs Attention badge is optional after the required workflow passes verification.

## Suggested repository layout

```text
client/
  src/
    components/       # summary, toolbar, list, badges, pagination, modal
    pages/            # DashboardPage, TicketDetailPage
    hooks/            # list/detail/summary loading and mutation state
    services/         # Axios instance and ticket API functions
    utils/            # form validation, date formatting
    layouts/          # shared application shell
    App.jsx
server/
  src/
    routes/
    controllers/
    validators/
    services/
    middleware/
    utils/            # Prisma client and application errors
    app.js            # Express app without opening a listening port
    server.js         # startup and shutdown
  prisma/
    schema.prisma
    migrations/
    seed.js
  tests/
docs/
  PulseDesk_PRD.pdf
  architecture.md
  development-plan.md
README.md
package.json          # workspace scripts
.env.example          # or separate client/server examples as needed
.gitignore
```

## Database and API contract

One `Ticket` model contains `id`, `title`, `description`, `customerEmail`, `priority`, `status`, `createdAt`, and `updatedAt`. Title uses a database limit of 120 characters. Required fields, enums, and timestamps are enforced in the schema. Prisma maintains `updatedAt`.

Seed at least 25 deterministic tickets covering every status/priority combination, varied dates, searchable titles, and customer emails. Make reseeding repeatable without duplicating fixtures. Treat seed/reset commands as local development operations and document their effect.

| Method | Endpoint | Contract |
| --- | --- | --- |
| POST | `/api/tickets` | Require title, description, customerEmail, priority; return created ticket with 201 |
| GET | `/api/tickets` | Accept search, status, priority, sort, page; return filtered tickets and pagination with 200 |
| GET | `/api/tickets/summary` | Return total, open, inProgress, resolved across the entire table with 200 |
| GET | `/api/tickets/:id` | Return full ticket with 200; missing ticket returns 404 |
| PATCH | `/api/tickets/:id` | Accept status and/or priority; reject empty body and unsupported fields; return saved ticket with 200 |

Register `/summary` before `/:id`. Validate UUID route parameters, enum values, pagination, and request bodies. Reject invalid supplied values rather than silently substituting defaults. If a `limit` query parameter is supported for compatibility with the PRD example, allow only `10`.

Trim title and description before required/length checks; reject whitespace-only values. Trim customer email and validate it without rewriting its case. Reject client-provided identifiers, timestamps, or status in create requests. Keep any additional input limit documented as an implementation choice.

Apply the complete database predicate before pagination:

```text
(title contains search OR customerEmail contains search)
AND status filter, when provided
AND priority filter, when provided
-> sort by createdAt and ID
-> skip (page - 1) * 10, take 10
```

Compute the list's `total` from the same predicate. Use a database transaction with a consistent snapshot for the page/count pair. An empty result has `totalPages: 0`; an out-of-range page returns an empty list with accurate metadata. The UI returns to a valid page after mutations if needed.

Success responses follow `{ success: true, data: ... }`. List data contains `tickets` and `pagination: { page, limit, total, totalPages }`. Errors follow `{ success: false, error: { code, message, details? } }`, with field-level details for validation failures. Use 400 for invalid input, 404 for missing tickets/routes, and 500 for unexpected failures. Return safe error messages and log unexpected failures on the server.

Summary is a separate unfiltered query. List filters must never become summary request parameters.

## Implementation milestones and time budget

The following is a six-hour planning budget, not a completion guarantee. If time runs short, drop optional polish and deployment while retaining all mandatory behavior.

| Milestone | Budget | Work | Exit condition |
| --- | --- | --- | --- |
| 1. Foundation | 30 min | Initialize repository/workspaces; client/server scripts; environment examples; PostgreSQL connection; Prisma schema, migration, and seed | Client and API start locally; database has 25+ tickets |
| 2. Backend workflow | 75 min | Validation, ticket service, all five routes, centralized errors; start API tests as endpoints become available | Create, combined querying, detail, update, and global summary work against PostgreSQL |
| 3. Dashboard | 80 min | App shell, four metric cards, toolbar, ticket rows/cards, backend pagination, API hooks | Search/filter/sort/page controls work together on desktop and mobile |
| 4. Create and update | 55 min | Create modal, frontend validation, detail route, save status/priority, success feedback, refresh dependent data | Created and edited tickets remain correct after browser refresh |
| 5. UI states and accessibility | 40 min | Loading, empty, no matches, errors/retry, keyboard modal behavior, narrow-screen adjustments | Every required state is usable; keyboard flow and mobile layout checked |
| 6. Acceptance and handoff | 50 min | Complete meaningful tests; run checks/build; verify clean local setup; README and assumptions | All AC-01 through AC-14 pass and setup is reproducible |
| 7. Contingency | 30 min | Resolve integration/setup issues; add Needs Attention only if everything passes | Required delivery remains complete within the planned budget |

Build backend tests during milestone 2 and check UI behavior during milestones 3-5. Milestone 6 completes verification rather than introducing it for the first time.

## Frontend behavior to settle during implementation

- Keep search, status, priority, sort, and page in URL query parameters. Returning from details restores the dashboard view; controls reset page to 1 when their values change.
- Debounce search by approximately 300 ms. Cancel or ignore stale responses so older results cannot replace newer ones.
- Load summary and list independently. A failed summary request should offer retry while leaving a successfully loaded list usable.
- Validate create inputs before submission and map backend field errors to their inputs. Preserve entered values on failed submissions and disable duplicate submissions while saving.
- After creation, refresh global counts and navigate to the created ticket. On return, refresh the dashboard while preserving its query; active filters may exclude the new ticket.
- After an update, show the returned persisted data and success feedback. Returning to the dashboard reloads list and summary; handle a page becoming empty if a ticket moves out of the active filter.
- Distinguish an empty database from no matching results. The former offers Create Ticket; the latter offers Clear Filters.
- Show loading/error/not-found states on details. Disable Save when unchanged or saving; retain unsaved edits on a failed save.
- Give inputs visible labels, badges readable text, and controls visible focus states. Trap modal focus, support Escape, and return focus to its opener. Ensure full descriptions/emails remain available in detail view.

## Verification and acceptance checklist

Automated API tests must use a dedicated test database and deterministic fixtures. Require an explicit test database URL; fail setup if it matches the development URL. Reset only the test fixtures. Keep database-backed query/update coverage so the tests demonstrate actual persistence.

Minimum required automated tests:

1. Invalid email returns 400 with the consistent validation error shape and creates no ticket.
2. Combined status and priority filters return only matching records with correct total metadata.
3. Status/priority update survives a subsequent GET and updates `updatedAt`.

Prioritize additional coverage for title/blank-input validation, title/email search, deterministic date sorting, 10-per-page pagination, summary independence, and missing-ticket responses. Run tests, lint, and the production frontend build before handoff.

| Acceptance criteria | Verification |
| --- | --- |
| AC-01: Creation persists | Create through UI; refresh detail/dashboard; verify stored data |
| AC-02: Input validation | Automated invalid-input checks plus manual inline-form feedback |
| AC-03: Title/email search | Search fixtures by title and separately by email |
| AC-04: Combined filters | Automated filter test plus toolbar interaction |
| AC-05: Date sorting | Verify newest/oldest order across pages |
| AC-06: Backend pagination | Check API metadata and page sizes using 25+ fixtures |
| AC-07: Full ticket detail | Verify every field including both timestamps |
| AC-08: Persistent update | Automated PATCH/GET test plus browser refresh |
| AC-09: Global summaries | Compare totals before and after list filtering; confirm refresh after mutation |
| AC-10: UI states | Exercise slow response, zero tickets, no matches, failed request, and retry |
| AC-11: Responsive UI | Check desktop and a narrow mobile viewport; keyboard walkthrough |
| AC-12: Seed data | Verify at least 25 tickets with varied statuses/priorities |
| AC-13: Tests | At least the three required tests pass against isolated PostgreSQL |
| AC-14: Documentation | Follow README from a clean install through migrations, seed, startup, and tests |

README includes prerequisites, environment variables, install/start commands, migration and seed commands, test database setup, test/build commands, API overview, architectural choices, assumptions, known limitations, and actual time spent. Keep credentials in ignored environment files and provide placeholders in examples.

## Scope and execution order

Start with milestone 1, then finish the database-backed API contract before connecting the dashboard. Integrate each user flow as soon as its endpoint is ready. Resolve defects before adding optional features.

Optional work after acceptance: the derived Needs Attention badge, extra visual polish, and deployment. Authentication, assignments, analytics, comments/history, and notification systems remain outside this assignment's scope.
