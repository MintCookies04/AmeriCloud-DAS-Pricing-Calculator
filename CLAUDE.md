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

## What to do next

Two follow-up items were flagged by the final whole-branch review as the right **opening work** for the next phase (not blockers for the merged foundation):

1. Add an integration test that loads the real `prisma/seed-data/*.json` through `buildEstimateResult()` (not just the small hand-built fixtures used in unit tests) and asserts against a hand-verified Grand Total — proves the engine is correct against real data, not just internally consistent.
2. Own the mapping between the DB's untyped `LaborTask.derivedFromJson` (Prisma `Json?`) and the calc engine's typed `LaborTaskDerivation | null` shape — nothing currently proves this round-trips correctly; whoever writes the Prisma-to-`ReferenceData` loader must validate it explicitly.

Then, per the design spec, two more plans remain:

- **Plan 2 — Estimating Workflow UI:** Cover Info (landing page), Materials, Labor (LOE + Additional SOW's + Crew Planner), Pass Throughs, Executive Summary pages; collapsible sidebar nav + sticky summary strip; PDF export.
- **Plan 3 — Admin Area:** CRUD screens for all editable reference data (material catalog, labor task library, labor rates, crew-size table, pass-through rate defaults, markup/tax defaults).

Minor items noted for later (non-blocking): the Materials `percentOfTotal` display field's denominator should be reconciled against the workbook's display column when the Materials page is built; the crew-size technician-count input should be constrained to 1–20 in the UI; consider `next/font` instead of the current Google Fonts `@import` in `globals.css`.
