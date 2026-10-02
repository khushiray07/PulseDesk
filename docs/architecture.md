PulseDesk Architecture Design
1. Architecture style
We will build this as a modular monolith.
That means:
One frontend application
        +
One backend application
        +
One database

We will not use:
Microservices
Kafka
Redis
Kubernetes
Multiple databases
Event-driven architecture

Those would be unnecessary for this assignment.
The high-level architecture is:
                    ┌──────────────────────┐
                    │                      │
                    │        USER          │
                    │  Support Team Member │
                    │                      │
                    └──────────┬───────────┘
                               │
                               │ HTTPS
                               ▼
                    ┌──────────────────────┐
                    │                      │
                    │   React Frontend     │
                    │      + Vite          │
                    │                      │
                    │ Dashboard            │
                    │ Ticket Details       │
                    │ Create Ticket        │
                    │ Search / Filters     │
                    │                      │
                    └──────────┬───────────┘
                               │
                               │ REST API
                               │ JSON
                               ▼
                    ┌──────────────────────┐
                    │                      │
                    │ Node.js + Express    │
                    │      Backend         │
                    │                      │
                    │ Routes               │
                    │ Controllers          │
                    │ Validation           │
                    │ Services             │
                    │ Error Handling       │
                    │                      │
                    └──────────┬───────────┘
                               │
                               │ Prisma ORM
                               ▼
                    ┌──────────────────────┐
                    │                      │
                    │    PostgreSQL        │
                    │                      │
                    │      tickets         │
                    │                      │
                    └──────────────────────┘

This should be our main architecture diagram.
2. Technology stack
I would freeze the stack as:
Layer	Technology
Frontend	React
Build	Vite
Routing	React Router
Styling	Tailwind CSS
HTTP	Axios
Backend	Node.js
API framework	Express.js
Validation	Zod
ORM	Prisma
Database	PostgreSQL
API testing	Supertest
Test framework	Vitest/Jest
Version control	Git + GitHub


The assignment allows us to choose the frontend framework, backend framework, and database.     web_application_developer_assig…
3. Why this architecture?
There are only a few operations:
Create Ticket
View Tickets
Search Tickets
Filter Tickets
Sort Tickets
View Ticket
Update Ticket
View Summary

Everything belongs to one business domain:
Support Tickets

Therefore:
Modular Monolith

is more appropriate than:
Microservices

If the interviewer asks:
Why didn't you use microservices?

Say:
“The application has one main domain and relatively simple workflows. A modular monolith keeps the architecture easier to develop, test, and maintain. Since the assignment also has a six-hour limit, introducing microservices would add unnecessary deployment and communication complexity.”

That is a good architectural answer.
4. Frontend architecture
The React frontend should be divided into layers too.
src/
│
├── components/
│
├── pages/
│
├── services/
│
├── hooks/
│
├── utils/
│
├── layouts/
│
└── App.jsx

Conceptually:
                     React Application
                            │
             ┌──────────────┼──────────────┐
             │              │              │
             ▼              ▼              ▼
          Pages         Components       Hooks
             │              │              │
             └──────────────┼──────────────┘
                            │
                            ▼
                       API Service
                            │
                            ▼
                          Axios
                            │
                            ▼
                       Backend API

5. Frontend pages
We really only need two actual pages.
Dashboard
/dashboard

Contains:
Summary cards
Search
Status filter
Priority filter
Sort
Ticket list
Pagination
Create ticket button

Ticket Detail
/tickets/:id

Contains:
Ticket information
Customer email
Description
Created date
Updated date

Status selector
Priority selector

Save Changes

Create Ticket can be a:
Modal
or
Side Drawer

instead of another full page.
6. Frontend component architecture
Something like:
DashboardPage
│
├── Header
│
├── SummarySection
│   ├── SummaryCard
│   ├── SummaryCard
│   ├── SummaryCard
│   └── SummaryCard
│
├── TicketToolbar
│   ├── SearchBar
│   ├── StatusFilter
│   ├── PriorityFilter
│   └── SortDropdown
│
├── TicketList
│   └── TicketCard / TicketRow
│
├── Pagination
│
└── CreateTicketDrawer
    └── TicketForm

Then:
TicketDetailPage
│
├── TicketHeader
├── TicketInformation
├── CustomerInformation
└── TicketUpdateForm

This keeps individual components small.
7. Backend architecture
The backend shouldn't be:
route → directly write SQL

Instead:
HTTP Request
      │
      ▼
    Route
      │
      ▼
 Controller
      │
      ▼
 Validation
      │
      ▼
   Service
      │
      ▼
    Prisma
      │
      ▼
 PostgreSQL

The response travels back:
PostgreSQL
    │
    ▼
 Prisma
    │
    ▼
 Service
    │
    ▼
 Controller
    │
    ▼
 JSON Response

8. Backend folder architecture
I would use:
server/
│
├── src/
│   │
│   ├── routes/
│   │   └── ticket.routes.js
│   │
│   ├── controllers/
│   │   └── ticket.controller.js
│   │
│   ├── services/
│   │   └── ticket.service.js
│   │
│   ├── validators/
│   │   └── ticket.validator.js
│   │
│   ├── middleware/
│   │   ├── error.middleware.js
│   │   └── notFound.middleware.js
│   │
│   ├── utils/
│   │
│   ├── app.js
│   └── server.js
│
├── prisma/
│   ├── schema.prisma
│   ├── seed.js
│   └── migrations/
│
└── tests/

9. Responsibility of each backend layer
This is something you should understand for your interview.
Route
Defines:
Which URL?
Which HTTP method?
Which controller?

Example:
GET /api/tickets

goes to:
getTickets()

Controller
Controller deals with:
HTTP request
HTTP response

For example:
Read query params
Call service
Return JSON

It should not contain large database queries.
Validator
Validates:
title
description
email
status
priority
query parameters

Using Zod.
Service
Contains the business/query logic.
For example:
Search title/email

Apply status filter

Apply priority filter

Apply sorting

Calculate pagination

Prisma
Handles communication with PostgreSQL.
Example conceptually:
findMany()
findUnique()
create()
update()
count()

10. Database design
We only need one main table.
tickets

Structure:
┌─────────────────────────────────────────┐
│                 tickets                 │
├─────────────────────────────────────────┤
│ id                 UUID / Integer       │
│ title              VARCHAR(120)         │
│ description        TEXT                 │
│ customer_email     VARCHAR(255)         │
│ priority           ENUM                 │
│ status             ENUM                 │
│ created_at         TIMESTAMP            │
│ updated_at         TIMESTAMP            │
└─────────────────────────────────────────┘

Enums:
Priority
────────
LOW
MEDIUM
HIGH

Status
────────────
OPEN
IN_PROGRESS
RESOLVED

These match the required ticket fields.     web_application_developer_assig…
11. Database relationship diagram
Extremely simple:
┌─────────────────────────────┐
│           TICKET            │
├─────────────────────────────┤
│ id                          │
│ title                       │
│ description                 │
│ customerEmail               │
│ priority                    │
│ status                      │
│ createdAt                   │
│ updatedAt                   │
└─────────────────────────────┘

No relationships are needed because:
No Users table
No Agents table
No Companies table
No Ticket History table

Those things aren't required.
12. Important database indexes
This is a small detail that can make your architecture explanation stronger.
We may index:
status
priority
created_at

because those fields are frequently used for:
Filtering
Sorting

Potential indexes:
INDEX(status)
INDEX(priority)
INDEX(created_at)

For 25 tickets this obviously isn't necessary for performance.
But architecturally we can say:
“The dataset is very small for this assignment, but status, priority, and creation date are natural candidates for indexes if the data grows because they're frequently used in filtering and sorting.”

That's much better than claiming we need optimization for 30 rows.
13. API architecture
We need five endpoints.
/api/tickets

Create
POST /api/tickets

List
GET /api/tickets

Detail
GET /api/tickets/:id

Update
PATCH /api/tickets/:id

Summary
GET /api/tickets/summary

14. GET tickets architecture
This is probably the most important endpoint.
Request:
GET /api/tickets
    ?search=payment
    &status=OPEN
    &priority=HIGH
    &sort=newest
    &page=1

Flow:
React
  │
  ▼

GET /api/tickets
  │
  ▼

Express Route
  │
  ▼

Validate query parameters
  │
  ▼

Ticket Service
  │
  ├── Search
  ├── Status condition
  ├── Priority condition
  ├── Sort
  ├── Pagination
  │
  ▼

Prisma
  │
  ▼

PostgreSQL

The assignment explicitly requires search, filtering, sorting, and pagination to be handled by the backend and work together.     web_application_developer_assig…
15. Pagination architecture
Frontend sends:
page = 2

Backend calculates:
limit = 10

skip =
(page - 1) × limit

Example:
page 1
skip 0
take 10

page 2
skip 10
take 10

page 3
skip 20
take 10

The frontend never downloads everything and performs pagination itself.
16. Search architecture
Search condition:
title contains search
OR
customerEmail contains search

Conceptually:
WHERE

title LIKE '%payment%'

OR

customer_email LIKE '%payment%'

The frontend only sends:
search=payment

The backend decides how that search is performed.
17. Summary architecture
This needs to be separate from the filtered result.
             Dashboard
                 │
       ┌─────────┴─────────┐
       │                   │
       ▼                   ▼

GET /tickets        GET /tickets/summary
       │                   │
       ▼                   ▼
Filtered data       Full database counts

Why?
Suppose the filter is:
status = OPEN
priority = HIGH

Ticket list might show:
3 tickets

But summary may still show:
Total        30
Open         10
In Progress   8
Resolved     12

That's exactly what the assignment requires.     web_application_developer_assig…
18. Create-ticket flow
Architecture:
User
 │
 ▼
Create Ticket Form
 │
 ▼
Frontend validation
 │
 ▼
POST /api/tickets
 │
 ▼
Backend Zod validation
 │
 ▼
Ticket Service
 │
 ▼
Prisma
 │
 ▼
PostgreSQL
 │
 ▼
201 Created
 │
 ▼
Refresh Dashboard

Notice:
Frontend validates
+
Backend validates

Both are required.     web_application_developer_assig…
19. Update-ticket flow
User opens ticket
        │
        ▼
GET /api/tickets/:id
        │
        ▼
Ticket displayed
        │
        ▼
User changes:

OPEN
   ↓
IN_PROGRESS

        │
        ▼
PATCH /api/tickets/:id
        │
        ▼
Backend validation
        │
        ▼
PostgreSQL UPDATE
        │
        ▼
updated_at automatically changes
        │
        ▼
Return updated ticket

Refresh page:
GET ticket again

Database returns:
IN_PROGRESS

which satisfies the persistence requirement.     web_application_developer_assig…
20. Validation architecture
We should validate requests at three levels.
              User input
                  │
                  ▼

          Frontend validation
                  │
                  ▼

           API validation
                Zod
                  │
                  ▼

         Database constraints

Example:
Title length

Frontend:
Prevent >120
Character counter

Backend:
Zod max(120)

Database:
VARCHAR(120)

That's called:
Defense in depth.

But don't overcomplicate the explanation. You can simply say:
“Frontend validation improves user experience, while backend validation protects the API even if someone bypasses the frontend.”

Excellent answer.
21. Error architecture
All backend errors should pass through one error middleware.
Route
   │
Controller
   │
Service
   │
Something fails
   │
   ▼
Error Middleware
   │
   ▼
Consistent response

Example:
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid ticket data"
  }
}

HTTP statuses:
200 → success

201 → ticket created

400 → invalid request

404 → ticket not found

500 → unexpected server error

This satisfies the requirement for meaningful HTTP status codes and consistent API errors.     web_application_developer_assig…
22. Loading/error/empty architecture
React handles three UI states:
API request
   │
   ├── Waiting
   │     ↓
   │   Loading skeleton
   │
   ├── Success + no tickets
   │     ↓
   │   Empty state
   │
   ├── Success + tickets
   │     ↓
   │   Ticket list
   │
   └── Failure
         ↓
       Error state

This is directly required.     web_application_developer_assig…
23. Optional creative layer
The architecture remains unchanged.
Needs Attention does not become another database table or service.
Simply:
Ticket received from backend
        │
        ▼

priority === HIGH
AND
status === OPEN
        │
        ▼

Display

⚠ Needs Attention

Very cheap feature.
Good product value.
No architectural complexity.
24. Local-development architecture
Required environment:
┌─────────────────────┐
│ Browser             │
│ localhost:5173      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Express             │
│ localhost:5000      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ PostgreSQL          │
│ localhost:5432      │
└─────────────────────┘

The assignment specifically says the application should run locally using documented instructions.     web_application_developer_assig…
25. Optional production architecture
Only after everything works locally:
                   USER
                    │
                    ▼
               Internet
                    │
                    ▼
        ┌────────────────────┐
        │      Vercel        │
        │                    │
        │ React Frontend     │
        └─────────┬──────────┘
                  │
               HTTPS API
                  │
                  ▼
        ┌────────────────────┐
        │      Render        │
        │                    │
        │ Express Backend    │
        └─────────┬──────────┘
                  │
                Prisma
                  │
                  ▼
        ┌────────────────────┐
        │       Neon         │
        │                    │
        │ PostgreSQL         │
        └────────────────────┘

Remember: deployment is a bonus, not a requirement. The assignment explicitly places deployment outside the required scope.     web_application_developer_assig…
26. Complete architecture
So our final architecture becomes:
                 PULSEDESK ARCHITECTURE


                       User
                        │
                        ▼
              ┌───────────────────┐
              │   React + Vite    │
              │                   │
              │ Dashboard         │
              │ Ticket Details    │
              │ Create Ticket     │
              │ Search/Filters    │
              └─────────┬─────────┘
                        │
                   Axios / REST
                        │
                        ▼
              ┌───────────────────┐
              │ Express Router    │
              └─────────┬─────────┘
                        │
                        ▼
              ┌───────────────────┐
              │ Controller        │
              └─────────┬─────────┘
                        │
                        ▼
              ┌───────────────────┐
              │ Zod Validation    │
              └─────────┬─────────┘
                        │
                        ▼
              ┌───────────────────┐
              │ Ticket Service    │
              │                   │
              │ Search            │
              │ Filter            │
              │ Sort              │
              │ Pagination        │
              │ Updates           │
              └─────────┬─────────┘
                        │
                        ▼
              ┌───────────────────┐
              │ Prisma ORM        │
              └─────────┬─────────┘
                        │
                        ▼
              ┌───────────────────┐
              │ PostgreSQL        │
              │                   │
              │ tickets           │
              └───────────────────┘