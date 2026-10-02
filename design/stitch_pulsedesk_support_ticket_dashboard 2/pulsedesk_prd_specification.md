# PulseDesk — Product Requirements Document (PRD)
**Support Ticket Dashboard | Full-stack Web Application**
Version 1.0 — Frozen for implementation

## Executive Summary & Scope
- **Problem**: Small company manages customer support tickets in spreadsheets; difficult to search, prioritize, track, and update consistently.
- **Product Statement**: PulseDesk replaces spreadsheet tracking with a clean, focused web application for support staff to create, search, filter, paginate, and update tickets (status/priority) from a responsive dashboard.
- **Core Entities & Data Model**:
  - `id`: Auto-generated UUID / identifier (e.g. `TICK-1042`)
  - `title`: String (Req, max 120 chars)
  - `description`: Text (Req)
  - `customerEmail`: Valid email string (Req)
  - `priority`: `LOW` | `MEDIUM` | `HIGH` (Req, Medium default assumption)
  - `status`: `OPEN` | `IN_PROGRESS` | `RESOLVED` (Req, defaults to `OPEN`)
  - `createdAt` & `updatedAt`: Timestamps
- **Key Features**:
  1. Summary Metric KPI Cards (Total, Open, In Progress, Resolved - unfiltered baseline)
  2. Search by Title or Customer Email + Filter by Status & Priority + Sort by Date + Pagination (10/page)
  3. Create Ticket Modal / Drawer with real-time validation & error feedback
  4. Ticket Detail View / Modal / Side-panel with status & priority update actions, timestamps, and customer context
  5. UI States: Loading skeleton, Empty dataset, No search results state with Reset filters, Error retry toast/banner
  6. "Needs Attention" visual badge for High Priority + Open tickets
