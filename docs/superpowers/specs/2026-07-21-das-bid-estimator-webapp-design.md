# DAS Construction Bidding Web App — Design

Date: 2026-07-21
Source of truth: `DAS Construction Bidding Workbook.xlsx`

## 1. Purpose

Port the "DAS Construction Bidding Workbook" Excel tool into a web application that automates the same estimating workflow: select materials/equipment, estimate labor, add pass-through expenses, and roll everything up into an Executive Summary with pricing, margins, and a Grand Total to Bid — matching the workbook's calculations exactly.

## 2. Source Workbook Reference (as analyzed)

Sheets and their role in the calculation chain:

- **Cover Sheet** — project info only (client, project, dates, contact, job site address, customer type, overview). Feeds nothing downstream; purely informational.
- **Bill of Materials** (~84 line items) — columns: Type, Manufacturer, Model, Item Description, Quantity (input), Vendor, Category (`Consumable` / `DAS Materials` / `BAT Materials`), Unit Cost, Ext Cost (`=UnitCost*Qty`), % of Total. Category totals via `SUMIF`, + 10% Contingency (`=SUM(categoryTotals)*10%`), + Est S&H (manual input) = Hardware Totals (`I92`).
- **LOE Sheet** (~100 line items) — grouped into categories (Antenna, Boring/Trenching/Coring, Cable Management, Coax, Conduit, Fiber, Head End, Power/Ground, Remote, Rooftop, DAS Turn-Up, Decommissioning, Documentation, Site Walk). Each row: Quantity (input, some formula-derived from other rows, e.g. labeling quantities auto-follow install quantities), Minutes Per Unit (fixed), Unit, Labor Type (Technician/Construction Manager/RF-Engineer/RF-Technician/Project Coordinator/Project Manager/Project Manager), Per Hour (`VLOOKUP` into Labor Projections), Cost (`=Hours*Rate`), Hours (`=(Qty*MinutesPerUnit)/60`). Grand totals per labor role + overall grand total.
- **Additional SOW's** — same row structure as LOE Sheet, categories: Structure Support Labor, Backbone Cabling Labor, Demolition, Miscellaneous (contingency, site walk, excess cable removal). Feeds into Labor Projections alongside LOE Sheet hours.
- **Labor Projections** — rate table (Technician $85/hr, Construction Manager $95, RF-Engineer $100, RF-Technician $75, Project Coordinator $55, Project Manager $100) with a "Reg Bill with MU" markup column. Sums LOE + Additional SOW's hours per role, applies a 5% staging/material time multiplier. Ops Admin Labor (Construction Manager 50%, Project Manager 25%, Project Coordinator 15% of a technician-hours baseline) is sized from a **crew-size scenario table** (rows for 1–20 technicians) that computes man-days/man-weeks/CM's-needed/total CM hours/project duration for each crew size; the actual "Technicians Needed" input (default 4) selects the row used to drive Ops Admin Labor and duration.
- **Pass Throughs** — Per Diem (rate × employee count × days, per labor role), Lodging (same shape), Travel (hourly rate × hours × employee count, per labor role), Airfare (ticket cost × qty, per labor role), Rentals (rate × qty against an equipment list: Fiber Test, Lift, PIM, Sweep, CAT cable tester, Fusion Splicer, Scissor lift, Scaffolding, Storage, Truck, Parking, Soft HEPA Cart), Soft Costs (fixed fee × qty against a list: Benchmark Testing, iBwave design, Commissioning, Leasing, Site Acquisition, Pre/Post Integration, Data Collection, e911 Test, Extra). Grand total = sum of all six section totals.
- **Executive Summary** — rolls up:
  - **Labor**: Operational Labor (Labor Projections `G9`) + Ops Admin Labor (`G14`) + Travel (Pass Throughs `E31`) → Total Project Labor, with a markup % (default 25%, input).
  - **Pass Through**: Per Diem + Lodging + Airfare + Rentals + Soft Costs (Travel is counted under Labor, not here) → Total Pass Through Expense, with markup % (default 25%, input).
  - **Material**: Consumable + DAS Materials + BAT Materials + S&H/Contingency (from Bill of Materials) → Total Materials, with markup % (default 25%, input).
  - **Projected Gross Margins**: Total Direct Cost = Labor + Pass Through + Material (all marked up); Gross Profit $$; Markup %; Gross Margin %; a manual "Tweak for Margin Target" adjustment; PGM Grand Total.
  - **Projected Net Margins**: Corporate markup (default 5%, input) on PGM Grand Total → PNM Grand Total; Net Profit $$; Net Margin %.
  - **Final bid block**: Total Labor to Bid (labor + pass-through totals + corporate + tweak, apportioned), Total Material to Bid (materials + corporate + tweak, apportioned), Grand Total to Bid, Tax Exempt / Tax Included / Tax Amount (default 8.25% tax rate, input).
  - A parallel "Break-Even" column mirrors the same structure with markups zeroed out, for comparison.
  - Optional venue metrics: Venue Covered sqft (input), ACT Cost/Quote per sqft, Client Provided (Active) Equipment cost, Quote+Active+Tax per sqft — relevant for large venue/stadium DAS jobs.

## 3. Scope for v1

**Included:**
- Cover Info (display-only, feeds PDF header)
- Materials (Bill of Materials port)
- Labor: LOE tasks + Additional SOW's + Crew-size planner (1–20 technicians)
- Pass Throughs (all six sections)
- Executive Summary (full rollup, PDF export)
- Admin area for editable reference data

**Explicitly not in v1** (confirmed with user):
- User accounts / multi-user auth (single estimator, one session at a time)
- Saved/reloadable estimate history (estimate lives in-session only; only the Executive Summary is exported, as PDF)
- Excel (.xlsx) export

## 4. Architecture & Tech Stack

- **Framework**: Next.js (App Router) + TypeScript, deployed on Vercel.
- **Styling**: Tailwind CSS, themed to AmeriCloud brand tokens (extracted from americloudtelecom.com's shipped CSS):
  - Navy: `--navy: #0f1e42`, `--navy-deep: #0a1530`, `--navy-2: #16284f`, `--navy-700: #1b2f5e`, `--ink: #0c1730`
  - Red: `--red: #d8202b`, `--red-700: #b5121d` (plus lighter accent `#ff5662`/`#ff7c86` seen in imagery gradients)
  - Slate/gray: `--slate: #48566f`, `--slate-2: #64748b`, `--gray: #7d8081`
  - Light neutrals: `--mist: #f4f6fa`, `--mist-2: #eef1f7`, `--line: #e2e7f0`, `--white: #ffffff`
  - Fonts: `--font-display: 'Archivo', system-ui, sans-serif` (headings), `--font-body: 'Manrope', system-ui, sans-serif` (body/data)
  - Radii: `8px` standard, `14px` large (cards/panels)
- **Database**: Neon/Vercel Postgres + Prisma ORM — stores only editable reference data (see §5). No estimate data is persisted server-side.
- **Calculation engine**: A pure, framework-free TypeScript module mirroring every formula in the workbook (see §2), unit-tested against real values pulled from the workbook. All UI (including the PDF) renders from one `EstimateResult` object produced by this engine — single source of truth for the math.
- **PDF export**: Client-side via `@react-pdf/renderer`, generated from the same `EstimateResult`, no server round-trip.

## 5. Data Model

**Reference data (Postgres, editable via Admin):**
- `MaterialItem`: type, manufacturer, model, description, vendor, category (`Consumable`/`DAS Materials`/`BAT Materials`), unit cost.
- `LaborTask`: category, name, minutes-per-unit, unit (`Each`/`Per Foot`), default labor role, and a flag + source-task reference for derived-quantity tasks (e.g. labeling tasks that auto-follow another task's quantity, replicating formulas like `=SUM(A21:A24,A31)`).
- `LaborRate`: role name → hourly rate.
- `CrewSizeTable`: rows for 1–20 technicians with derived days/weeks/CM's-needed/total-CM-hours logic parameters.
- `PassThroughRateDefaults`: per diem/lodging rate per role, travel basis, airfare ticket cost per role, rental equipment list (name, rate, billing unit), soft-cost fixed-fee list (name, fee).
- `EstimateDefaults`: default markup % (labor/pass-through/material = 25% each), corporate markup (5%), tax rate (8.25%) — all overridable per estimate.

**Per-estimate data (session-only, not persisted):**
- Cover info fields.
- Selected material line items + quantities.
- Selected labor tasks + quantities (LOE + Additional SOW's), crew size selection.
- Pass-through inputs (employee counts/days/hours, rental qty, soft-cost qty).
- Markup/tax overrides, margin tweak value.

## 6. Pages & Navigation

- **Global layout**: Collapsible left sidebar listing every page (Cover Info, Materials, Labor, Pass Throughs, Executive Summary, Admin), each a full route, navigable in any order. A sticky summary strip (Materials / Labor / Pass Throughs / Grand Total to Bid totals) stays visible on every estimating page regardless of sidebar state. Each page ends with "Move to →" button(s) advancing to the next stage in the stated workflow order.
- **`/` (Cover Info, landing page)**: Client, project name, RFP/bid dates, estimator, contact, job site address, customer type, project overview. Bottom: "→ Materials".
- **`/materials`**: Catalog table grouped by category, searchable/filterable, quantity input per row, category subtotals, contingency % input, S&H input, Hardware Grand Total. Link to Admin's catalog editor. Bottom: "→ Labor".
- **`/labor`**: Sub-tabs for LOE tasks and Additional SOW's (task, minutes/unit read-only, unit, role, qty input, computed hours/cost; derived-quantity tasks shown greyed out with a tooltip on what drives them). Crew Planner panel (1–20 technician selector showing resulting duration + admin labor cost). Bottom: "→ Pass Throughs".
- **`/pass-throughs`**: Per Diem, Lodging, Travel, Airfare, Rentals, Soft Costs sections. Bottom: "→ Executive Summary".
- **`/summary`**: Full rollup per §2's Executive Summary description, optional collapsed venue $/sqft section, "Export PDF" button.
- **`/admin`**: CRUD screens for material catalog, labor task library, labor rates, crew-size table, pass-through rate defaults, markup/tax defaults.

## 7. Visual Design

- Dark navy (`#0f1e42`/`#0a1530`/`#16284f`) for sidebar, top bar, and summary strip. Main content area on light neutrals (`#f4f6fa` background, white cards, `#e2e7f0` hairlines) — chosen over a fully dark theme because this is a dense data-entry tool, not a marketing page; navy frames it, doesn't fill it.
- Red (`#d8202b`) reserved for primary actions (Export PDF, "Move to →" buttons) and the Grand Total to Bid figure.
- Archivo for headings, Manrope for body/data/inputs.
- 8px radius (buttons/inputs), 14px (cards/panels), soft layered shadows matching the site's shadow tokens.
- Data tables: zebra-striped rows, sticky category headers, right-aligned numeric columns, minimal bordered inputs that highlight navy on focus.

## 8. PDF Export

- Triggered from `/summary` via "Export PDF", generated client-side from the same `EstimateResult` the screen renders — no drift between screen and PDF possible.
- Layout: Cover-info header (client/project/date/estimator/address) in brand style, Labor/Pass-Through/Material rollup tables, Gross/Net Margin block, Grand Total to Bid.
- Filename: `<ClientName>-<ProjectName>-Estimate.pdf`, falling back to a date-stamped name if those fields are blank.

## 9. Testing Approach

- Calculation engine: unit tests reproducing real rows/values from the source workbook (BOM line, LOE task, crew-size table, full Executive Summary rollup) as fixtures — verifies the port against the actual spreadsheet, not just against itself.
- UI: component-level checks that input changes propagate correctly into the summary strip and Executive Summary.
- No E2E/browser automation for v1 (single-user scope) — manual full-workflow walkthrough before considering the build done.
