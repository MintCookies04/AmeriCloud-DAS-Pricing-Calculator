# DAS Construction Bidding Estimator — Project Notes

## What this is

A web app that ports the `DAS Construction Bidding Workbook.xlsx` spreadsheet into a Next.js application: select materials/equipment, estimate labor, add pass-through expenses, and get an Executive Summary with pricing, margins, and a Grand Total to Bid — matching the workbook's calculations exactly. Built for AmeriCloud Telecom (design follows their brand colors/fonts, see below).

Source of truth for requirements: `docs/superpowers/specs/2026-07-21-das-bid-estimator-webapp-design.md`.

## Tech Stack

- **Framework:** Next.js 14 (App Router) + TypeScript, deployed on Vercel
- **Styling:** Tailwind CSS, themed to AmeriCloud brand tokens (extracted from americloudtelecom.com's shipped CSS): navy `#0f1e42`/`#0a1530`/`#16284f`, red `#d8202b`/`#b5121d`, slate `#48566f`/`#64748b`, mist `#f4f6fa`/`#eef1f7`; fonts Archivo (display) + Manrope (body)
- **Database:** Postgres via Prisma ORM (Neon/Vercel Postgres in production; a local Docker Postgres container is used for dev — see below)
- **Testing:** Vitest
- **PDF export (planned):** `@react-pdf/renderer`, client-side, no server round-trip
- **One-time data conversion:** Python 3 + `openpyxl`, converts the source `.xlsx` into `prisma/seed-data/*.json` (checked into the repo) — avoids hand-transcribing ~200 catalog/labor rows

## Local dev database

A local Postgres 16 container provides `DATABASE_URL` for development (see `.env`, gitignored):
```
docker run -d --name das-estimator-postgres -e POSTGRES_USER=das -e POSTGRES_PASSWORD=das -e POSTGRES_DB=das_estimator -p 5433:5432 postgres:16-alpine
```
If the container isn't running: `docker start das-estimator-postgres` (Docker Desktop must be running first — on Windows, launch `C:\Program Files\Docker\Docker\Docker Desktop.exe` if needed).

`.env.example` documents the shape; copy to `.env` and adjust before running `npx prisma migrate dev` or `npm run seed`.

## Status: Foundation & Calculation Engine — COMPLETE (merged to master)

Plan: `docs/superpowers/plans/2026-07-21-foundation-calc-engine.md` (includes a "Plan Amendments" section documenting decisions made mid-implementation — read it before touching the calc engine or schema).

Delivered:
- Next.js/TypeScript/Tailwind scaffold with the brand theme
- Prisma schema + migrations for all reference data (material catalog, labor tasks, labor rates, crew-size table, pass-through rates, estimate defaults)
- `scripts/xlsx_to_seed.py` — converts the workbook to `prisma/seed-data/*.json`; `prisma/seed.ts` loads it into Postgres
- A fully unit-tested, framework-free calculation engine (`src/lib/calc/`) reproducing the workbook's math: `calculateMaterials`, `calculateLabor`, `calculateCrewPlan`, `calculatePassThroughs`, `calculateExecutiveSummary`, orchestrated by `buildEstimateResult()` — 32/32 tests passing, `tsc --noEmit` clean

Notable correctness findings made and fixed during this phase (see the plan's "Plan Amendments" section for full detail):
- Labor roles have TWO distinct hourly rates in the source workbook — a billing rate and a raw wage — which differ specifically for RF-Engineer ($100 billing vs $75 raw wage). LOE/SOW task costs use billing rate; Pass Throughs' Travel section uses raw wage. Both are carried through the schema (`LaborRate.hourlyRate` / `.rawWageRate`) and the engine.
- The workbook's own "Net Profit $$" and "Break-Even" panel formulas have apparent copy-paste bugs (reference pre-corporate-markup figures instead of post-markup ones). Per explicit user decision, this port computes the economically-consistent version instead of replicating the bug — this does **not** affect the Grand Total to Bid chain, which is traced and reproduced exactly.
- `LaborProjectionSettings` and `EstimateDefaults` use a fixed `id: 'singleton'` (not `cuid()`) for deterministic upserts, since each holds exactly one row.

## Status: Estimating Workflow UI — COMPLETE (pending merge to master)

Plan: `docs/superpowers/plans/2026-07-22-estimating-workflow-ui.md` (amended mid-implementation to record the `BlobProvider`/`PDFDownloadLink` decision below — read its "Plan Amendments" for full detail).

Delivered, built as 9 sequential tasks (each independently task-reviewed, then a final whole-branch review on all 9 together):
- Cover Info (landing page), Materials, Labor (LOE + Additional SOW's + Crew Planner), Pass Throughs, and Executive Summary pages, all reading/writing one shared `EstimateInput` via `EstimateContext` — every displayed number (page bodies, sticky summary strip, PDF) derives from a single `buildEstimateResult(input, referenceData)` memo, so there's no duplicated math or state drift between pages
- Collapsible sidebar nav + sticky summary strip app shell
- Client-side PDF export via `@react-pdf/renderer`
- Both Plan 1 follow-ups closed: a real-seed-data integration test through `buildEstimateResult()`, and an explicitly validated `derivedFromJson` (Prisma `Json?`) → `LaborTaskDerivation` round-trip in the Prisma-to-`ReferenceData` loader
- Verified: `tsc --noEmit` clean, 54/54 tests passing (14 files), `npm run build` succeeds (8 routes)

Notable finding from the final whole-branch review (architectural, not a bug — read before starting Plan 3):
- `src/app/layout.tsx` fetches reference data in an `async` Server Component with no `dynamic`/`revalidate` export, so `npm run build` **prerenders all routes as fully static**, with the material/labor catalog baked into the RSC payload at build time. This is fine for Plan 2's read-only scope, but once Plan 3's Admin Area lets users edit reference data, those edits will **not** appear on the estimating pages until a full redeploy. Add `export const dynamic = 'force-dynamic'` (or a `revalidate` value) to `src/app/layout.tsx` when Plan 3 lands, before wiring up any admin CRUD screens.

Deferred (Minor, non-blocking, noted for future polish): PDF generation (`BlobProvider`) regenerates on every summary-page keystroke instead of gating behind the Export click; `pdfFileName.ts` doesn't sanitize filesystem-unsafe characters from client/project names; `Number(e.target.value)` produces `NaN` on empty/partial numeric input across several pages (a shared `parseNumericInput` helper would close this in one place); `EstimateContext`'s value/setters aren't memoized (confirmed low blast radius at the current one-page-per-route structure, revisit if that changes).

## What to do next

Per the design spec, one plan remains:

- **Plan 3 — Admin Area:** CRUD screens for all editable reference data (material catalog, labor task library, labor rates, crew-size table, pass-through rate defaults, markup/tax defaults). **Read the build-time-static-data note above first** — it directly affects how Admin's edits reach the estimating pages.

Minor items noted for later (non-blocking): the Materials `percentOfTotal` display field's denominator should be reconciled against the workbook's display column; the crew-size technician-count input should be constrained to 1–20 in the UI; consider `next/font` instead of the current Google Fonts `@import` in `globals.css`.
