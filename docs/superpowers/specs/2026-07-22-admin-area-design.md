# Admin Area — Design

Date: 2026-07-22
Source of truth: `docs/superpowers/specs/2026-07-21-das-bid-estimator-webapp-design.md` §5, §6 (line 84)

## 1. Purpose

Plan 3 of the DAS Construction Bidding Estimator port: CRUD screens for all editable reference data (material catalog, labor task library, labor rates, crew-size table, pass-through rate defaults, markup/tax defaults), gated behind a simple shared-password check. This is the last of the three planned phases (Foundation & Calc Engine, Estimating Workflow UI, Admin Area).

## 2. Scope for v1

**Included:**
- Full add/edit/delete CRUD for open-ended catalogs: Material catalog, Labor task library, Rentals, Soft Costs.
- Edit-only (no add/delete) for enum-/range-bound tables: Labor rates (6 fixed roles), Crew-size table (fixed rows 1–20), Pass-through role rates (fixed 18 combos: 3 kinds × 6 roles).
- Singleton edit form for Estimate Defaults (markup %'s, corporate markup, tax rate, contingency %).
- Simple shared-password gate protecting all of `/admin`.
- The fix that makes Admin edits actually visible elsewhere: root layout switches from static to forced-dynamic rendering.

**Explicitly not in v1** (confirmed with user):
- User accounts, roles, or per-user permissions — one shared password, no accounts table.
- Editing a Labor task's derivation formula (`derivedFromJson`) through the UI — shown read-only (e.g. `= (Cable-Install-A + Cable-Install-B) ÷ 2`); changing which tasks derive from which still requires editing seed data.
- Add/delete on Labor rates, Crew-size rows, or Pass-through role rates — these are fixed enumerations, not open catalogs.
- Audit log / change history for reference-data edits.
- Bulk import/export (CSV, re-running the xlsx importer) from within Admin.

## 3. Architecture

- **Framework**: Next.js 14 App Router, consistent with Plans 1–2.
- **Routing**: `src/app/admin/` route group with its own layout providing a sub-nav across the 6 sections, plus `src/app/admin/login/page.tsx` (outside the auth gate).
- **Static-data fix**: `src/app/layout.tsx` (the root layout, which fetches `loadReferenceData()`/`loadEstimateDefaults()` once for the whole app) gets `export const dynamic = 'force-dynamic'`, so every request refetches current DB state. This is a hard prerequisite — without it, Admin edits won't appear on `/materials`, `/labor`, etc. until a redeploy. Acceptable here since this is a low-traffic, single-estimator internal tool; static-prerendering performance was never a real requirement.
- **Mutations**: Next.js Server Actions (`'use server'`), colocated per entity (e.g. `src/app/admin/materials/actions.ts` exporting `listMaterials`, `createMaterial`, `updateMaterial`, `deleteMaterial`), called directly from client-side form components. No separate REST/API route layer.
- **Auth**: `middleware.ts` matches `/admin/:path*`, excluding `/admin/login`. A login Server Action compares the submitted password to `process.env.ADMIN_PASSWORD` and, on match, sets an httpOnly cookie (`das_admin_session`) whose value is a SHA-256 hash of the password (so the plaintext password never sits in a cookie). Middleware validates the cookie by recomputing that same hash from the env var and comparing — no session store, no per-user state, matches the app's no-accounts model. Logout clears the cookie.

## 4. Data Model (existing, from Plan 1's schema — no migrations needed)

Reusing the Prisma models already in place (`prisma/schema.prisma`):
- `MaterialItem` — full CRUD.
- `LaborTask` — full CRUD; `derivedFromJson` read-only in the UI; deleting a task that another task's `derivedFromJson` references is blocked with a clear validation error.
- `LaborRate` — edit-only (role is a fixed enum, unique).
- `CrewSizeRow` — edit-only (`technicianCount` 1–20 fixed, only `cmsNeeded` editable).
- `PassThroughRoleRate` — edit-only (`kind` × `role`, all 18 combos pre-seeded).
- `RentalRate` — full CRUD.
- `SoftCostRate` — full CRUD.
- `LaborProjectionSettings` — singleton; folded into the same page as Labor rates/Crew-size (all under a "Rates" admin section) since it's a handful of related numeric constants (hours per man-day/week, staging multiplier, CM/PM/Coordinator percentages).
- `EstimateDefaults` — singleton edit form (markup %'s, corporate markup, tax rate, contingency %).

## 5. Pages & Navigation

- Sidebar (`src/components/Sidebar.tsx`) gains an "Admin" entry, same brand-styled nav pattern as the estimating pages.
- `/admin/login`: centered card, brand-styled, password field + submit. Wrong password shows an inline error; no lockout/rate-limiting (out of scope, single shared password, low-stakes internal tool).
- `/admin` (layout + sub-nav): Materials, Labor Tasks, Rates (Labor rates + Crew-size table + Labor Projection Settings), Pass Throughs (Pass-through role rates + Rentals + Soft Costs), Defaults (Estimate Defaults).
- `/admin/materials`: `<AdminTable>` over `MaterialItem` — columns: key, type, manufacturer, model, description, vendor, category (select), unit cost. Add/edit/delete.
- `/admin/labor-tasks`: `<AdminTable>` over `LaborTask` — columns: key, sheet (LOE/SOW), category, name, minutes-per-unit, unit, labor role (select), included-in-subtotal (checkbox), derivation formula (read-only display when present). Add/edit/delete (delete blocked if referenced by another task's derivation).
- `/admin/rates`: three sub-sections on one page — Labor rates (6 rows, edit-only: hourly rate + raw wage rate), Crew-size table (20 rows, edit-only: CM's-needed per technician count), Labor Projection Settings (single form: hours/man-day, hours/man-week, staging multiplier, CM/PM/Coordinator percentages).
- `/admin/pass-throughs`: Pass-through role rates (18 rows, edit-only: amount per kind×role), Rentals (`<AdminTable>`, full CRUD), Soft Costs (`<AdminTable>`, full CRUD).
- `/admin/defaults`: Estimate Defaults singleton form (labor/pass-through/material markup %, corporate markup %, tax rate, contingency %).

## 6. Shared CRUD Component

One generic `<AdminTable>` client component drives every list-type entity (Materials, Labor Tasks, Rentals, Soft Costs, and the edit-only tables via an `allowAddDelete: false` flag):
- Column config: `{ key, label, type: 'text' | 'number' | 'select' | 'checkbox' | 'readonly', required?, options? }`.
- Props: `columns`, `rows`, and the entity's Server Actions (`onCreate`, `onUpdate`, `onDelete` — the latter two omitted when `allowAddDelete` is false).
- Inline row editing (click a row → fields become editable → Save/Cancel), matching the existing brand table styling (zebra-striped rows, sticky header, right-aligned numeric columns) already established on `/materials`.
- `EstimateDefaults` and `LaborProjectionSettings` don't use `<AdminTable>` — they're single-row forms, not tables.

## 7. Validation

- Required fields and non-negative numeric ranges (costs, rates, minutes, percentages) enforced in the Server Action, not just client-side.
- Uniqueness on `key` (Materials/Labor Tasks/Rentals/Soft Costs) enforced via the existing Prisma `@unique` constraint, surfaced as a friendly form error on conflict.
- Deleting a `LaborTask` checks whether any other `LaborTask.derivedFromJson.terms[].key` references the target's `key`; if so, the delete is rejected with an error naming the referencing task(s).
- Percentage fields (markups, tax rate, contingency, CM/PM/Coordinator percentages) are constrained to a sane 0–100 range in the form and the Server Action.

## 8. Testing Approach

- Component tests for `<AdminTable>`: render, add row, edit row, delete row (happy path) — same weight as existing component tests (`SummaryStrip.test.tsx`), not exhaustive.
- Server Action tests against the real seeded local Postgres (same pattern as `loadReferenceData.integration.test.ts`): create/update/delete round-trips, validation rejects bad input (negative cost, duplicate key, delete-while-referenced).
- Middleware/login test: correct password sets the cookie and grants access to a protected route; wrong password is rejected; an unauthenticated request to any `/admin/*` route redirects to `/admin/login`.
- Manual click-through (per the project's established testing philosophy) confirming an Admin edit shows up on the corresponding estimating page without a redeploy — the concrete proof the static-data fix works.

## 9. Out of Scope (confirmed)

See §2. Notably: no derivation-formula editor, no add/delete on fixed-enumeration tables, no audit log, no bulk import/export, no user accounts.
