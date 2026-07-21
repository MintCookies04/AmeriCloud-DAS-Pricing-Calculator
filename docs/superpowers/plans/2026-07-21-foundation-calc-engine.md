# Foundation & Calculation Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Next.js/TypeScript/Prisma project, convert the source workbook into seed data with zero transcription error, and build a fully unit-tested calculation engine that reproduces the workbook's math exactly (with the two disclosed, deliberate simplifications agreed with the user). This plan produces no UI — that's Plan 2. It produces a working, importable `buildEstimateResult()` function proven correct against real workbook values.

**Architecture:** A Next.js (App Router) + TypeScript app deployed on Vercel, Tailwind CSS themed to AmeriCloud brand tokens, Prisma + Postgres for editable reference data. Reference data is generated once from the source `.xlsx` via a Python script (using the already-proven `openpyxl` library) into checked-in JSON, then loaded into Postgres via a Prisma seed script — this avoids hand-transcribing ~200 catalog/labor rows, which is both enormous and error-prone for a tool whose whole purpose is pricing accuracy. The calculation engine is a pure, framework-free TypeScript module with no DB or React dependency, unit-tested against fixture values pulled directly from the workbook.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Tailwind CSS, Prisma ORM, Postgres (Neon/Vercel Postgres), Vitest for testing, Python 3 + openpyxl for the one-time workbook→JSON conversion.

## Global Constraints

- Reference data (material catalog, labor tasks, rates, crew-size table, pass-through rates) is stored in Postgres and must be editable later via an Admin UI (Plan 3) — the schema must support CRUD, not just read.
- No user accounts/auth (single estimator, single session) — confirmed with user.
- No saved/reloadable estimate history — an estimate lives in browser/session state only; only the Executive Summary is exported (as PDF, built in Plan 2).
- The "Grand Total to Bid" calculation chain must exactly reproduce the workbook's formulas (see spec `docs/superpowers/specs/2026-07-21-das-bid-estimator-webapp-design.md` §2).
- Per user decision: display-only profit/margin figures (Net Profit $$, margin %, the Break-Even comparison) are computed with economically-consistent formulas rather than replicating the source workbook's apparent copy-paste formula slips — this does not affect the Grand Total to Bid, which is traced and reproduced exactly.
- Brand colors/fonts (from spec §4/§7): navy `#0f1e42`/`#0a1530`/`#16284f`, red `#d8202b`/`#b5121d`, slate `#48566f`/`#64748b`, mist `#f4f6fa`/`#eef1f7`, line `#e2e7f0`; fonts Archivo (display) + Manrope (body); radii 8px/14px.
- No placeholders, no `TODO`s in committed code — every function must be fully implemented and tested before merging.

---

## Plan Amendments (post-review)

- **Task 2 review finding, approved by user:** `LaborProjectionSettings.id` and `EstimateDefaults.id` use `@default("singleton")` instead of `@default(cuid())`, so callers can always upsert against the known id `"singleton"` rather than doing find-first-then-create-or-update. Task 4's seed script below already reflects this (uses `upsert({ where: { id: 'singleton' }, ... })` for both models). Applied in commit `a00b4f7`.
- **Task 2 review finding, kept as-is by user:** monetary/percentage fields remain `Float` rather than `Decimal` — matches the source workbook's own double-precision arithmetic and avoids reworking Tasks 5–11's calculation engine to use decimal arithmetic for a precision risk that doesn't apply at these magnitudes.

### Task 1: Project scaffold — Next.js, TypeScript, Tailwind, brand theme

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.mjs`
- Create: `tailwind.config.ts`
- Create: `postcss.config.mjs`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `src/app/layout.tsx`
- Create: `src/app/globals.css`
- Create: `src/app/page.tsx`
- Create: `src/lib/utils/cn.ts`
- Test: `src/lib/utils/cn.test.ts`

**Interfaces:**
- Produces: `cn(...classes: (string | false | null | undefined)[]): string` — a small classnames helper every later component uses.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "das-bid-estimator",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "seed": "tsx prisma/seed.ts"
  },
  "dependencies": {
    "next": "^14.2.5",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "@prisma/client": "^5.16.1"
  },
  "devDependencies": {
    "typescript": "^5.5.3",
    "@types/node": "^20.14.9",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "tailwindcss": "^3.4.4",
    "postcss": "^8.4.39",
    "autoprefixer": "^10.4.19",
    "prisma": "^5.16.1",
    "vitest": "^1.6.0",
    "tsx": "^4.16.2"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`
Expected: installs without error, creates `package-lock.json`.

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Create `next.config.mjs`**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {};
export default nextConfig;
```

- [ ] **Step 5: Create `postcss.config.mjs`**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 6: Create `tailwind.config.ts` with brand theme**

```ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#0f1e42',
          deep: '#0a1530',
          2: '#16284f',
          700: '#1b2f5e',
        },
        ink: '#0c1730',
        red: {
          DEFAULT: '#d8202b',
          700: '#b5121d',
        },
        slate: {
          DEFAULT: '#48566f',
          2: '#64748b',
        },
        mist: {
          DEFAULT: '#f4f6fa',
          2: '#eef1f7',
        },
        line: '#e2e7f0',
      },
      fontFamily: {
        display: ['Archivo', 'system-ui', 'sans-serif'],
        body: ['Manrope', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '8px',
        lg: '14px',
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 7: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

- [ ] **Step 8: Create `.gitignore`**

```
node_modules/
.next/
.env
.env.local
prisma/dev.db
*.tsbuildinfo
```

- [ ] **Step 9: Write the failing test for the `cn` helper**

```ts
// src/lib/utils/cn.test.ts
import { describe, it, expect } from 'vitest';
import { cn } from './cn';

describe('cn', () => {
  it('joins truthy class names with a space', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });

  it('drops falsy values', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b');
  });
});
```

- [ ] **Step 10: Run test to verify it fails**

Run: `npx vitest run src/lib/utils/cn.test.ts`
Expected: FAIL — `Cannot find module './cn'`

- [ ] **Step 11: Implement `cn`**

```ts
// src/lib/utils/cn.ts
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter((c): c is string => Boolean(c)).join(' ');
}
```

- [ ] **Step 12: Run test to verify it passes**

Run: `npx vitest run src/lib/utils/cn.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 13: Create global styles with brand fonts**

```css
/* src/app/globals.css */
@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700;800&family=Manrope:wght@400;500;600;700&display=swap');
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  @apply bg-mist text-ink font-body;
}
```

- [ ] **Step 14: Create root layout**

```tsx
// src/app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DAS Bid Estimator',
  description: 'AmeriCloud DAS construction bid estimator',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 15: Create placeholder home page**

```tsx
// src/app/page.tsx
export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <h1 className="font-display text-2xl text-navy">DAS Bid Estimator</h1>
    </main>
  );
}
```

- [ ] **Step 16: Verify the app builds**

Run: `npm run build`
Expected: Build succeeds with no type errors, produces `.next/` output.

- [ ] **Step 17: Commit**

```bash
git add package.json package-lock.json tsconfig.json next.config.mjs tailwind.config.ts postcss.config.mjs vitest.config.ts .gitignore src/
git commit -m "Scaffold Next.js/TypeScript/Tailwind project with brand theme"
```

---

### Task 2: Prisma schema and Postgres connection

**Files:**
- Create: `prisma/schema.prisma`
- Create: `.env.example`
- Create: `src/lib/db.ts`

**Interfaces:**
- Consumes: `@prisma/client` from Task 1.
- Produces: `prisma` — a singleton `PrismaClient` instance importable as `import { prisma } from '@/lib/db'`. Produces the Prisma models `MaterialItem`, `LaborTask`, `LaborRate`, `CrewSizeRow`, `LaborProjectionSettings`, `PassThroughRoleRate`, `RentalRate`, `SoftCostRate`, `EstimateDefaults` — all later tasks (seed script, calc engine data loaders, Admin UI in Plan 3) read/write through these exact model names and fields.

- [ ] **Step 1: Create `.env.example`**

```
DATABASE_URL="postgresql://user:password@host/dbname?sslmode=require"
```

Copy this to `.env` locally and fill in your actual Neon/Vercel Postgres connection string before running migrations.

- [ ] **Step 2: Create `prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum MaterialCategory {
  Consumable
  DAS_Materials  @map("DAS Materials")
  BAT_Materials  @map("BAT Materials")
}

enum LaborRoleName {
  Technician
  Construction_Manager  @map("Construction Manager")
  RF_Engineer           @map("RF-Engineer")
  RF_Technician         @map("RF-Technician")
  Project_Coordinator   @map("Project Coordinator")
  Project_Manager       @map("Project Manager")
}

enum LaborSheet {
  LOE
  SOW
}

model MaterialItem {
  id           String            @id @default(cuid())
  key          String            @unique
  type         String
  manufacturer String?
  model        String?
  description  String
  vendor       String?
  category     MaterialCategory
  unitCost     Float
  createdAt    DateTime          @default(now())
  updatedAt    DateTime          @updatedAt
}

model LaborTask {
  id                  String        @id @default(cuid())
  key                 String        @unique
  sheet               LaborSheet
  category            String
  name                String
  minutesPerUnit      Float
  unit                String
  laborRole           LaborRoleName
  includedInSubtotal  Boolean       @default(true)
  derivedFromJson      Json?        // { terms: { key: string; coeff: number }[]; divisor: number } | null
  createdAt           DateTime      @default(now())
  updatedAt           DateTime      @updatedAt
}

model LaborRate {
  id         String        @id @default(cuid())
  role       LaborRoleName @unique
  hourlyRate Float
  updatedAt  DateTime      @updatedAt
}

model CrewSizeRow {
  id               String @id @default(cuid())
  technicianCount  Int    @unique
  cmsNeeded        Int
}

model LaborProjectionSettings {
  id                          String @id @default("singleton")
  hoursPerManDay              Float
  hoursPerManWeek             Float
  stagingMaterialMultiplier   Float
  cmPercentOfTechHours        Float
  pmPercentOfTechHours        Float
  coordinatorPercentOfTechHours Float
  updatedAt                   DateTime @updatedAt
}

enum PassThroughRateKind {
  PerDiem
  Lodging
  Airfare
}

model PassThroughRoleRate {
  id     String              @id @default(cuid())
  kind   PassThroughRateKind
  role   LaborRoleName
  amount Float

  @@unique([kind, role])
}

model RentalRate {
  id     String @id @default(cuid())
  key    String @unique
  name   String
  rate   Float
  unit   String
}

model SoftCostRate {
  id   String @id @default(cuid())
  key  String @unique
  name String
  fee  Float
}

model EstimateDefaults {
  id                    String @id @default("singleton")
  laborMarkupPct        Float
  passThroughMarkupPct  Float
  materialMarkupPct     Float
  corporateMarkupPct    Float
  taxRate               Float
  contingencyPct        Float
  updatedAt             DateTime @updatedAt
}
```

- [ ] **Step 3: Create the Prisma client singleton**

```ts
// src/lib/db.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
```

- [ ] **Step 4: Generate the Prisma client**

Run: `npx prisma generate`
Expected: "Generated Prisma Client" with no errors.

- [ ] **Step 5: Run the migration against your Postgres database**

Run: `npx prisma migrate dev --name init`
Expected: Creates `prisma/migrations/<timestamp>_init/migration.sql` and applies it; prints "Your database is now in sync with your schema."

*(Requires `DATABASE_URL` in `.env` pointing at a real Neon/Vercel Postgres instance — create one at neon.tech or via the Vercel dashboard's Storage tab before this step.)*

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma .env.example src/lib/db.ts prisma/migrations
git commit -m "Add Prisma schema for reference data and connect Postgres"
```

---

### Task 3: Workbook → seed JSON conversion script

**Files:**
- Create: `scripts/xlsx_to_seed.py`
- Create: `prisma/seed-data/` (output directory, generated by running the script)

**Interfaces:**
- Consumes: `DAS Construction Bidding Workbook.xlsx` at the repo root (already present).
- Produces: `prisma/seed-data/material-items.json`, `labor-tasks.json`, `labor-rates.json`, `crew-size-table.json`, `labor-projection-settings.json`, `pass-through-rates.json` — Task 4's seed script reads these exact files and shapes.

- [ ] **Step 1: Write the conversion script**

```python
#!/usr/bin/env python3
"""Convert DAS Construction Bidding Workbook.xlsx into seed JSON files.

Run: python scripts/xlsx_to_seed.py
Reads:  ./DAS Construction Bidding Workbook.xlsx
Writes: ./prisma/seed-data/*.json
"""
import json
import re
from pathlib import Path
import openpyxl

ROOT = Path(__file__).resolve().parent.parent
WORKBOOK_PATH = ROOT / "DAS Construction Bidding Workbook.xlsx"
OUT_DIR = ROOT / "prisma" / "seed-data"

ROLE_NAMES = [
    "Technician", "Construction Manager", "RF-Engineer",
    "RF-Technician", "Project Coordinator", "Project Manager",
]

# LOE Sheet rows whose Quantity (column A) is itself a formula (a derived
# quantity) rather than a direct user input. Resolved by hand from the
# workbook's actual formula text (verified against the source file) into a
# linear combination: quantity = (sum of coeff * source_row_quantity) / divisor.
#   loe-25 = SUM(A21:A24, A31)         -> labeling coax/category cable
#   loe-28 = A27*4                     -> labeling for splitter
#   loe-32 = A31/2                     -> test category cable per drop
#   loe-33 = SUM(A21:A24)/2            -> sweep test per line
#   loe-46 = SUM(A43:A44)*2 - A43      -> labeling fiber (= A43 + 2*A44)
#   loe-49 = A48+A47                   -> labeling fiber housing
#   loe-67 = SUM(A65,A64,A63,A62,A56,A57) -> labeling DAS equipment
#   loe-71 = SUM(A83,A72,A73,A75,A76,A77,A78,A79,A82,A70) -> labeling grounding
LOE_DERIVED_QUANTITIES = {
    25: {"terms": [(21, 1), (22, 1), (23, 1), (24, 1), (31, 1)], "divisor": 1},
    28: {"terms": [(27, 4)], "divisor": 1},
    32: {"terms": [(31, 1)], "divisor": 2},
    33: {"terms": [(21, 1), (22, 1), (23, 1), (24, 1)], "divisor": 2},
    46: {"terms": [(43, 1), (44, 2)], "divisor": 1},
    49: {"terms": [(48, 1), (47, 1)], "divisor": 1},
    67: {"terms": [(65, 1), (64, 1), (63, 1), (62, 1), (56, 1), (57, 1)], "divisor": 1},
    71: {"terms": [(83, 1), (72, 1), (73, 1), (75, 1), (76, 1), (77, 1),
                    (78, 1), (79, 1), (82, 1), (70, 1)], "divisor": 1},
}

SUM_RANGE_RE = re.compile(r"SUM\(G(\d+):G(\d+)\)")


def load_wb():
    return openpyxl.load_workbook(WORKBOOK_PATH, data_only=False)


def parse_material_items(wb):
    ws = wb["Bill of Materials"]
    items = []
    for row in range(3, 87):
        item_type = ws[f"A{row}"].value
        category = ws[f"G{row}"].value
        unit_cost = ws[f"H{row}"].value
        if item_type is None or category is None or unit_cost is None:
            continue
        items.append({
            "key": f"bom-{row}",
            "type": item_type,
            "manufacturer": ws[f"B{row}"].value,
            "model": str(ws[f"C{row}"].value) if ws[f"C{row}"].value is not None else None,
            "description": ws[f"D{row}"].value,
            "vendor": ws[f"F{row}"].value,
            "category": category,
            "unitCost": float(unit_cost),
        })
    return items


def parse_labor_sheet(wb, sheet_name, key_prefix, derived_quantities):
    ws = wb[sheet_name]
    tasks = []
    current_category = None
    current_subtotal_range = None
    for row in range(3, ws.max_row + 1):
        marker = ws[f"A{row}"].value
        if marker == "~":
            current_category = ws[f"B{row}"].value
            g_formula = ws[f"G{row}"].value
            match = SUM_RANGE_RE.search(g_formula) if isinstance(g_formula, str) else None
            if not match:
                raise ValueError(
                    f"{sheet_name}!G{row}: expected a SUM(G#:G#) subtotal formula, got {g_formula!r}"
                )
            current_subtotal_range = (int(match.group(1)), int(match.group(2)))
            continue
        name = ws[f"B{row}"].value
        minutes = ws[f"C{row}"].value
        unit = ws[f"D{row}"].value
        role = ws[f"E{row}"].value
        if name is None or role is None:
            continue
        if role not in ROLE_NAMES:
            raise ValueError(f"{sheet_name}!E{row}: unrecognized labor role {role!r}")
        derived = derived_quantities.get(row)
        derived_out = None
        if derived is not None:
            derived_out = {
                "terms": [{"key": f"{key_prefix}-{r}", "coeff": c} for r, c in derived["terms"]],
                "divisor": derived["divisor"],
            }
        included = (
            current_subtotal_range is not None
            and current_subtotal_range[0] <= row <= current_subtotal_range[1]
        )
        tasks.append({
            "key": f"{key_prefix}-{row}",
            "sheet": "LOE" if key_prefix == "loe" else "SOW",
            "category": current_category,
            "name": name,
            "minutesPerUnit": float(minutes) if isinstance(minutes, (int, float)) else 0.0,
            "unit": unit or "Each",
            "laborRole": role,
            "includedInSubtotal": included,
            "derivedFrom": derived_out,
        })
    return tasks


def parse_labor_rates(wb):
    ws = wb["Labor Projections"]
    rates = []
    for row in range(3, 9):
        role = ws[f"A{row}"].value
        rate = ws[f"B{row}"].value
        if role is None or rate is None:
            continue
        rates.append({"role": role, "hourlyRate": float(rate)})
    return rates


def parse_crew_size_table(wb):
    ws = wb["Labor Projections"]
    rows = []
    for row in range(3, 23):
        tech_count = ws[f"I{row}"].value
        cms_needed = ws[f"L{row}"].value
        if tech_count is None or cms_needed is None:
            continue
        rows.append({"technicianCount": int(tech_count), "cmsNeeded": int(cms_needed)})
    return rows


def parse_labor_projection_settings(wb):
    ws = wb["Labor Projections"]
    return {
        "hoursPerManDay": float(ws["B22"].value),
        "hoursPerManWeek": float(ws["B24"].value),
        "stagingMaterialMultiplier": float(ws["B18"].value),
        "cmPercentOfTechHours": float(ws["E11"].value),
        "pmPercentOfTechHours": float(ws["E12"].value),
        "coordinatorPercentOfTechHours": float(ws["E13"].value),
    }


def parse_pass_through_rates(wb):
    ws = wb["Pass Throughs"]

    def role_rate_rows(rows, value_col):
        out = []
        for row in rows:
            role = ws[f"A{row}"].value
            value = ws[f"{value_col}{row}"].value
            if role is not None and value is not None:
                out.append({"role": role, "value": float(value)})
        return out

    per_diem = role_rate_rows(range(5, 11), "B")
    lodging = role_rate_rows(range(15, 21), "B")
    airfare = role_rate_rows(range(35, 41), "B")

    rentals = []
    for row in range(45, 58):
        name = ws[f"A{row}"].value
        rate = ws[f"B{row}"].value
        unit = ws[f"C{row}"].value
        if name is None or rate is None:
            continue
        rentals.append({"key": f"rental-{row}", "name": name, "rate": float(rate), "unit": unit or "Each"})

    soft_costs = []
    for row in range(62, 72):
        name = ws[f"A{row}"].value
        fee = ws[f"D{row}"].value
        if name is None:
            continue
        soft_costs.append({"key": f"softcost-{row}", "name": name, "fee": float(fee) if fee is not None else 0.0})

    return {
        "perDiemRateByRole": [{"role": r["role"], "rate": r["value"]} for r in per_diem],
        "lodgingRateByRole": [{"role": r["role"], "rate": r["value"]} for r in lodging],
        "airfareCostByRole": [{"role": r["role"], "cost": r["value"]} for r in airfare],
        "rentals": rentals,
        "softCosts": soft_costs,
    }


def main():
    wb = load_wb()
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    material_items = parse_material_items(wb)
    assert len(material_items) >= 80, f"expected ~84 material items, got {len(material_items)}"

    loe_tasks = parse_labor_sheet(wb, "LOE Sheet", "loe", LOE_DERIVED_QUANTITIES)
    sow_tasks = parse_labor_sheet(wb, "Additional SOW's", "sow", {})
    assert len(loe_tasks) >= 90, f"expected ~100 LOE tasks, got {len(loe_tasks)}"
    assert len(sow_tasks) >= 20, f"expected ~28 Additional SOW tasks, got {len(sow_tasks)}"
    labor_tasks = loe_tasks + sow_tasks

    labor_rates = parse_labor_rates(wb)
    assert len(labor_rates) == 6, f"expected 6 labor rates, got {len(labor_rates)}"

    crew_size_table = parse_crew_size_table(wb)
    assert len(crew_size_table) == 20, f"expected 20 crew-size rows, got {len(crew_size_table)}"

    labor_projection_settings = parse_labor_projection_settings(wb)
    pass_through_rates = parse_pass_through_rates(wb)

    def write(name, data):
        with open(OUT_DIR / name, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        count = len(data) if isinstance(data, list) else "object"
        print(f"wrote {name}: {count}")

    write("material-items.json", material_items)
    write("labor-tasks.json", labor_tasks)
    write("labor-rates.json", labor_rates)
    write("crew-size-table.json", crew_size_table)
    write("labor-projection-settings.json", labor_projection_settings)
    write("pass-through-rates.json", pass_through_rates)


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run the script**

Run: `python scripts/xlsx_to_seed.py`
Expected: Six "wrote ..." lines printed, no assertion errors, `prisma/seed-data/*.json` files created.

- [ ] **Step 3: Spot-check the output against known workbook values**

Run:
```bash
python -c "
import json
items = json.load(open('prisma/seed-data/material-items.json'))
das_power = next(i for i in items if i['key'] == 'bom-3')
assert das_power['unitCost'] == 4685, das_power
assert das_power['category'] == 'DAS Materials', das_power
tasks = json.load(open('prisma/seed-data/labor-tasks.json'))
labeling = next(t for t in tasks if t['key'] == 'loe-25')
assert labeling['derivedFrom']['divisor'] == 1, labeling
assert {'key': 'loe-31', 'coeff': 1} in labeling['derivedFrom']['terms'], labeling
rates = json.load(open('prisma/seed-data/labor-rates.json'))
tech = next(r for r in rates if r['role'] == 'Technician')
assert tech['hourlyRate'] == 85, tech
print('all spot checks passed')
"
```
Expected: `all spot checks passed`

- [ ] **Step 4: Commit**

```bash
git add scripts/xlsx_to_seed.py prisma/seed-data/
git commit -m "Add workbook-to-seed-JSON conversion script and generated seed data"
```

---

### Task 4: Prisma seed script

**Files:**
- Create: `prisma/seed.ts`
- Modify: `package.json` (add `"prisma": { "seed": "tsx prisma/seed.ts" }` block)

**Interfaces:**
- Consumes: `prisma/seed-data/*.json` from Task 3; `prisma` client from Task 2.
- Produces: A populated Postgres database — Task 5+ calc-engine data loaders and Plan 2's UI both read reference data through `prisma.materialItem.findMany()` etc.

- [ ] **Step 1: Add the `prisma.seed` config to `package.json`**

Add this top-level key to `package.json` (alongside `"scripts"`):

```json
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
```

- [ ] **Step 2: Write the seed script**

```ts
// prisma/seed.ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient, MaterialCategory, LaborRoleName, LaborSheet, PassThroughRateKind } from '@prisma/client';

const prisma = new PrismaClient();
const DATA_DIR = join(__dirname, 'seed-data');

function readJson<T>(filename: string): T {
  return JSON.parse(readFileSync(join(DATA_DIR, filename), 'utf-8')) as T;
}

const CATEGORY_MAP: Record<string, MaterialCategory> = {
  Consumable: 'Consumable',
  'DAS Materials': 'DAS_Materials',
  'BAT Materials': 'BAT_Materials',
};

const ROLE_MAP: Record<string, LaborRoleName> = {
  Technician: 'Technician',
  'Construction Manager': 'Construction_Manager',
  'RF-Engineer': 'RF_Engineer',
  'RF-Technician': 'RF_Technician',
  'Project Coordinator': 'Project_Coordinator',
  'Project Manager': 'Project_Manager',
};

interface SeedMaterialItem {
  key: string; type: string; manufacturer: string | null; model: string | null;
  description: string; vendor: string | null; category: string; unitCost: number;
}

interface SeedLaborTask {
  key: string; sheet: 'LOE' | 'SOW'; category: string; name: string;
  minutesPerUnit: number; unit: string; laborRole: string;
  includedInSubtotal: boolean;
  derivedFrom: { terms: { key: string; coeff: number }[]; divisor: number } | null;
}

interface SeedLaborRate { role: string; hourlyRate: number }
interface SeedCrewSizeRow { technicianCount: number; cmsNeeded: number }
interface SeedLaborProjectionSettings {
  hoursPerManDay: number; hoursPerManWeek: number; stagingMaterialMultiplier: number;
  cmPercentOfTechHours: number; pmPercentOfTechHours: number; coordinatorPercentOfTechHours: number;
}
interface SeedPassThroughRates {
  perDiemRateByRole: { role: string; rate: number }[];
  lodgingRateByRole: { role: string; rate: number }[];
  airfareCostByRole: { role: string; cost: number }[];
  rentals: { key: string; name: string; rate: number; unit: string }[];
  softCosts: { key: string; name: string; fee: number }[];
}

async function main() {
  const materialItems = readJson<SeedMaterialItem[]>('material-items.json');
  for (const item of materialItems) {
    await prisma.materialItem.upsert({
      where: { key: item.key },
      create: { ...item, category: CATEGORY_MAP[item.category] },
      update: { ...item, category: CATEGORY_MAP[item.category] },
    });
  }

  const laborTasks = readJson<SeedLaborTask[]>('labor-tasks.json');
  for (const task of laborTasks) {
    await prisma.laborTask.upsert({
      where: { key: task.key },
      create: {
        key: task.key,
        sheet: task.sheet as LaborSheet,
        category: task.category,
        name: task.name,
        minutesPerUnit: task.minutesPerUnit,
        unit: task.unit,
        laborRole: ROLE_MAP[task.laborRole],
        includedInSubtotal: task.includedInSubtotal,
        derivedFromJson: task.derivedFrom ?? undefined,
      },
      update: {
        sheet: task.sheet as LaborSheet,
        category: task.category,
        name: task.name,
        minutesPerUnit: task.minutesPerUnit,
        unit: task.unit,
        laborRole: ROLE_MAP[task.laborRole],
        includedInSubtotal: task.includedInSubtotal,
        derivedFromJson: task.derivedFrom ?? undefined,
      },
    });
  }

  const laborRates = readJson<SeedLaborRate[]>('labor-rates.json');
  for (const rate of laborRates) {
    const role = ROLE_MAP[rate.role];
    await prisma.laborRate.upsert({
      where: { role },
      create: { role, hourlyRate: rate.hourlyRate },
      update: { hourlyRate: rate.hourlyRate },
    });
  }

  const crewSizeTable = readJson<SeedCrewSizeRow[]>('crew-size-table.json');
  for (const row of crewSizeTable) {
    await prisma.crewSizeRow.upsert({
      where: { technicianCount: row.technicianCount },
      create: row,
      update: row,
    });
  }

  const settings = readJson<SeedLaborProjectionSettings>('labor-projection-settings.json');
  await prisma.laborProjectionSettings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', ...settings },
    update: settings,
  });

  const passThroughRates = readJson<SeedPassThroughRates>('pass-through-rates.json');
  for (const r of passThroughRates.perDiemRateByRole) {
    const role = ROLE_MAP[r.role];
    await prisma.passThroughRoleRate.upsert({
      where: { kind_role: { kind: PassThroughRateKind.PerDiem, role } },
      create: { kind: PassThroughRateKind.PerDiem, role, amount: r.rate },
      update: { amount: r.rate },
    });
  }
  for (const r of passThroughRates.lodgingRateByRole) {
    const role = ROLE_MAP[r.role];
    await prisma.passThroughRoleRate.upsert({
      where: { kind_role: { kind: PassThroughRateKind.Lodging, role } },
      create: { kind: PassThroughRateKind.Lodging, role, amount: r.rate },
      update: { amount: r.rate },
    });
  }
  for (const r of passThroughRates.airfareCostByRole) {
    const role = ROLE_MAP[r.role];
    await prisma.passThroughRoleRate.upsert({
      where: { kind_role: { kind: PassThroughRateKind.Airfare, role } },
      create: { kind: PassThroughRateKind.Airfare, role, amount: r.cost },
      update: { amount: r.cost },
    });
  }
  for (const r of passThroughRates.rentals) {
    await prisma.rentalRate.upsert({ where: { key: r.key }, create: r, update: r });
  }
  for (const r of passThroughRates.softCosts) {
    await prisma.softCostRate.upsert({ where: { key: r.key }, create: r, update: r });
  }

  const defaults = {
    laborMarkupPct: 0.25,
    passThroughMarkupPct: 0.25,
    materialMarkupPct: 0.25,
    corporateMarkupPct: 0.05,
    taxRate: 0.0825,
    contingencyPct: 0.10,
  };
  await prisma.estimateDefaults.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', ...defaults },
    update: defaults,
  });

  console.log(
    `Seeded ${materialItems.length} material items, ${laborTasks.length} labor tasks, ` +
    `${laborRates.length} labor rates, ${crewSizeTable.length} crew-size rows, ` +
    `${passThroughRates.rentals.length} rentals, ${passThroughRates.softCosts.length} soft costs.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

*Note: `derivedFromJson` needs a unique compound key `kind_role` on `PassThroughRoleRate` — Prisma generates this automatically from the `@@unique([kind, role])` in Task 2's schema; the generated field name is `kind_role`.*

- [ ] **Step 3: Run the seed script**

Run: `npm run seed`
Expected: Prints `Seeded 84 material items, ~123 labor tasks, 6 labor rates, 20 crew-size rows, 13 rentals, 10 soft costs.` (exact counts will match whatever Task 3's script produced) with no errors.

- [ ] **Step 4: Verify row counts directly**

Run:
```bash
npx tsx -e "
import { prisma } from './src/lib/db';
(async () => {
  console.log('materials:', await prisma.materialItem.count());
  console.log('laborTasks:', await prisma.laborTask.count());
  console.log('laborRates:', await prisma.laborRate.count());
  console.log('crewSizeRows:', await prisma.crewSizeRow.count());
  await prisma.\$disconnect();
})();
"
```
Expected: `laborRates: 6`, `crewSizeRows: 20`, and non-zero counts for the others matching Task 3's assertions.

- [ ] **Step 5: Commit**

```bash
git add prisma/seed.ts package.json
git commit -m "Add Prisma seed script loading workbook-derived JSON into Postgres"
```

---

### Task 5: Calculation engine — shared types

**Files:**
- Create: `src/lib/calc/types.ts`

**Interfaces:**
- Produces: every type used by Tasks 6–11 (`MaterialItem`, `MaterialLineInput`, `MaterialResult`, `LaborRole`, `LaborTask`, `LaborTaskLineInput`, `LaborResult`, `CrewSizeRow`, `LaborProjectionSettings`, `CrewPlanResult`, `PassThroughInput`, `PassThroughResult`, `MarkupInputs`, `ExecutiveSummaryResult`, `ReferenceData`, `EstimateInput`, `EstimateResult`).

- [ ] **Step 1: Write the types file**

```ts
// src/lib/calc/types.ts

export type MaterialCategory = 'Consumable' | 'DAS Materials' | 'BAT Materials';

export interface MaterialItem {
  key: string;
  type: string;
  manufacturer: string | null;
  model: string | null;
  description: string;
  vendor: string | null;
  category: MaterialCategory;
  unitCost: number;
}

export interface MaterialLineInput {
  key: string;
  quantity: number;
}

export interface MaterialCategoryTotal {
  category: MaterialCategory;
  total: number;
}

export interface MaterialLineResult {
  key: string;
  extCost: number;
  percentOfTotal: number;
}

export interface MaterialResult {
  lines: MaterialLineResult[];
  categoryTotals: MaterialCategoryTotal[];
  contingency: number;
  shippingHandling: number;
  hardwareTotal: number;
}

export type LaborRole =
  | 'Technician'
  | 'Construction Manager'
  | 'RF-Engineer'
  | 'RF-Technician'
  | 'Project Coordinator'
  | 'Project Manager';

export interface LaborTaskDerivation {
  terms: { key: string; coeff: number }[];
  divisor: number;
}

export interface LaborTask {
  key: string;
  sheet: 'LOE' | 'SOW';
  category: string;
  name: string;
  minutesPerUnit: number;
  unit: string;
  laborRole: LaborRole;
  includedInSubtotal: boolean;
  derivedFrom: LaborTaskDerivation | null;
}

export interface LaborTaskLineInput {
  key: string;
  quantity: number;
}

export interface LaborTaskResult {
  key: string;
  quantity: number;
  hours: number;
  cost: number;
}

export interface LaborCategorySubtotal {
  sheet: 'LOE' | 'SOW';
  category: string;
  hours: number;
  cost: number;
}

export interface LaborRoleTotal {
  role: LaborRole;
  hours: number;
  cost: number;
}

export interface LaborResult {
  taskResults: LaborTaskResult[];
  categorySubtotals: LaborCategorySubtotal[];
  roleTotals: LaborRoleTotal[];
  grandHours: number;
  grandCost: number;
}

export interface CrewSizeRow {
  technicianCount: number;
  cmsNeeded: number;
}

export interface LaborProjectionSettings {
  hoursPerManDay: number;
  hoursPerManWeek: number;
  stagingMaterialMultiplier: number;
  cmPercentOfTechHours: number;
  pmPercentOfTechHours: number;
  coordinatorPercentOfTechHours: number;
}

export interface CrewPlanRoleAdmin {
  role: LaborRole;
  hours: number;
  cost: number;
}

export interface CrewPlanResult {
  totalHoursInProject: number;
  stagingHours: number;
  totalProjectTime: number;
  manDays: number;
  manWeeks: number;
  calendarDays: number;
  calendarWeeks: number;
  cmsNeeded: number;
  totalCmHours: number;
  averageOpsLaborRate: number;
  opsAdminLaborByRole: CrewPlanRoleAdmin[];
  opsAdminLaborTotal: { hours: number; cost: number };
}

export interface RoleHeadcountDays {
  role: LaborRole;
  employeeCount: number;
  days: number;
}

export interface RoleHeadcountHours {
  role: LaborRole;
  employeeCount: number;
  hours: number;
}

export interface RoleTicketQty {
  role: LaborRole;
  qty: number;
}

export interface RentalLineInput {
  key: string;
  qty: number;
}

export interface SoftCostLineInput {
  key: string;
  qty: number;
}

export interface PassThroughInput {
  perDiem: RoleHeadcountDays[];
  lodging: RoleHeadcountDays[];
  travel: RoleHeadcountHours[];
  airfare: RoleTicketQty[];
  rentals: RentalLineInput[];
  softCosts: SoftCostLineInput[];
}

export interface PassThroughResult {
  perDiemTotal: number;
  lodgingTotal: number;
  travelTotal: number;
  travelHours: number;
  airfareTotal: number;
  rentalsTotal: number;
  softCostsTotal: number;
  grandTotal: number;
}

export interface MarkupInputs {
  laborMarkupPct: number;
  passThroughMarkupPct: number;
  materialMarkupPct: number;
  corporateMarkupPct: number;
  marginTweak: number;
  taxRate: number;
}

export interface ExecutiveSummaryResult {
  operationalLaborCost: number;
  opsAdminLaborCost: number;
  travelCost: number;
  totalProjectLaborCost: number;
  totalProjectLaborBilled: number;
  perDiemCost: number;
  lodgingCost: number;
  airfareCost: number;
  rentalsCost: number;
  softCostsCost: number;
  totalPassThroughCost: number;
  totalPassThroughBilled: number;
  consumableCost: number;
  dasMaterialsCost: number;
  batMaterialsCost: number;
  materialContingencyAndSH: number;
  totalMaterialCost: number;
  totalMaterialBilled: number;
  totalDirectCost: number;
  totalDirectCostBreakEven: number;
  grossProfit: number;
  markupPercent: number;
  grossMarginPercent: number;
  projectedGrossMarginTotal: number;
  corporateMarkupCost: number;
  projectedNetMarginTotal: number;
  netProfit: number;
  netMarkupPercent: number;
  netMarginPercent: number;
  totalLaborToBid: number;
  totalMaterialToBid: number;
  grandTotalToBidTaxExempt: number;
  taxAmount: number;
  grandTotalToBidTaxIncluded: number;
}

export interface ReferenceData {
  materialItems: MaterialItem[];
  laborTasks: LaborTask[];
  laborRates: { role: LaborRole; hourlyRate: number }[];
  crewSizeTable: CrewSizeRow[];
  laborProjectionSettings: LaborProjectionSettings;
  passThroughRates: {
    perDiemRateByRole: { role: LaborRole; rate: number }[];
    lodgingRateByRole: { role: LaborRole; rate: number }[];
    airfareCostByRole: { role: LaborRole; cost: number }[];
    rentals: { key: string; name: string; rate: number; unit: string }[];
    softCosts: { key: string; name: string; fee: number }[];
  };
}

export interface EstimateInput {
  materials: MaterialLineInput[];
  contingencyPct: number;
  shippingHandling: number;
  loeTasks: LaborTaskLineInput[];
  sowTasks: LaborTaskLineInput[];
  technicianCount: number;
  passThroughs: PassThroughInput;
  markups: MarkupInputs;
}

export interface EstimateResult {
  materials: MaterialResult;
  labor: LaborResult;
  crewPlan: CrewPlanResult;
  passThroughs: PassThroughResult;
  executiveSummary: ExecutiveSummaryResult;
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/calc/types.ts
git commit -m "Add calculation engine shared types"
```

---

### Task 6: Calculation engine — materials

**Files:**
- Create: `src/lib/calc/materials.ts`
- Test: `src/lib/calc/materials.test.ts`

**Interfaces:**
- Consumes: `MaterialItem`, `MaterialLineInput`, `MaterialResult` from Task 5.
- Produces: `calculateMaterials(items: MaterialItem[], lines: MaterialLineInput[], contingencyPct: number, shippingHandling: number): MaterialResult` — used by Task 11's orchestrator.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/calc/materials.test.ts
import { describe, it, expect } from 'vitest';
import { calculateMaterials } from './materials';
import type { MaterialItem } from './types';

const items: MaterialItem[] = [
  { key: 'bom-3', type: 'DC Power Plant', manufacturer: 'Vertiv', model: '582137200', description: 'NetSure 5100', vendor: 'Anixter', category: 'DAS Materials', unitCost: 4685 },
  { key: 'bom-65', type: 'Electrical', manufacturer: 'HD', model: null, description: '3/8 x 1 bolts', vendor: 'HD', category: 'Consumable', unitCost: 1 },
];

describe('calculateMaterials', () => {
  it('computes extended cost, category totals, contingency, and hardware total', () => {
    const result = calculateMaterials(items, [
      { key: 'bom-3', quantity: 2 },
      { key: 'bom-65', quantity: 100 },
    ], 0.10, 50);

    expect(result.lines.find((l) => l.key === 'bom-3')?.extCost).toBe(9370);
    expect(result.lines.find((l) => l.key === 'bom-65')?.extCost).toBe(100);

    const dasTotal = result.categoryTotals.find((c) => c.category === 'DAS Materials')?.total;
    const consumableTotal = result.categoryTotals.find((c) => c.category === 'Consumable')?.total;
    expect(dasTotal).toBe(9370);
    expect(consumableTotal).toBe(100);

    // contingency = (9370 + 100 + 0[BAT]) * 0.10
    expect(result.contingency).toBeCloseTo(947, 5);
    // hardwareTotal = 9370 + 100 + 947 + 50 (S&H)
    expect(result.hardwareTotal).toBeCloseTo(10467, 5);
  });

  it('returns zero percentOfTotal when hardwareTotal is zero', () => {
    const result = calculateMaterials(items, [], 0.10, 0);
    expect(result.hardwareTotal).toBe(0);
    expect(result.lines.every((l) => l.percentOfTotal === 0)).toBe(true);
  });

  it('computes percentOfTotal against the hardware total, not the category sum', () => {
    const result = calculateMaterials(items, [
      { key: 'bom-3', quantity: 1 },
    ], 0, 0);
    // extCost 4685, hardwareTotal = 4685 (no contingency, no S&H, no other items)
    expect(result.lines.find((l) => l.key === 'bom-3')?.percentOfTotal).toBeCloseTo(1, 10);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/calc/materials.test.ts`
Expected: FAIL — `Cannot find module './materials'`

- [ ] **Step 3: Implement `calculateMaterials`**

```ts
// src/lib/calc/materials.ts
import type { MaterialCategory, MaterialItem, MaterialLineInput, MaterialResult } from './types';

const CATEGORIES: MaterialCategory[] = ['Consumable', 'DAS Materials', 'BAT Materials'];

export function calculateMaterials(
  items: MaterialItem[],
  lines: MaterialLineInput[],
  contingencyPct: number,
  shippingHandling: number,
): MaterialResult {
  const qtyByKey = new Map(lines.map((l) => [l.key, l.quantity]));

  const extCostByKey = new Map(
    items.map((item) => [item.key, item.unitCost * (qtyByKey.get(item.key) ?? 0)]),
  );

  const categoryTotals = CATEGORIES.map((category) => ({
    category,
    total: items
      .filter((i) => i.category === category)
      .reduce((sum, i) => sum + (extCostByKey.get(i.key) ?? 0), 0),
  }));

  const categorySum = categoryTotals.reduce((sum, c) => sum + c.total, 0);
  const contingency = categorySum * contingencyPct;
  const hardwareTotal = categorySum + contingency + shippingHandling;

  const lineResults = items.map((item) => {
    const extCost = extCostByKey.get(item.key) ?? 0;
    return {
      key: item.key,
      extCost,
      percentOfTotal: hardwareTotal === 0 ? 0 : extCost / hardwareTotal,
    };
  });

  return { lines: lineResults, categoryTotals, contingency, shippingHandling, hardwareTotal };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/calc/materials.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/calc/materials.ts src/lib/calc/materials.test.ts
git commit -m "Add materials calculation module"
```

---

### Task 7: Calculation engine — labor (LOE + Additional SOW's)

**Files:**
- Create: `src/lib/calc/labor.ts`
- Test: `src/lib/calc/labor.test.ts`

**Interfaces:**
- Consumes: `LaborTask`, `LaborTaskLineInput`, `LaborResult`, `LaborRole` from Task 5.
- Produces: `calculateLabor(tasks: LaborTask[], loeInputs: LaborTaskLineInput[], sowInputs: LaborTaskLineInput[], rates: { role: LaborRole; hourlyRate: number }[]): LaborResult` — used by Task 8 (crew plan) and Task 11 (orchestrator).

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/calc/labor.test.ts
import { describe, it, expect } from 'vitest';
import { calculateLabor } from './labor';
import type { LaborTask } from './types';

const rates = [
  { role: 'Technician' as const, hourlyRate: 85 },
  { role: 'Construction Manager' as const, hourlyRate: 95 },
];

const baseTasks: LaborTask[] = [
  { key: 'loe-21', sheet: 'LOE', category: 'Coax', name: 'Connectorize captive coax up to half inch', minutesPerUnit: 15, unit: 'Each', laborRole: 'Technician', includedInSubtotal: true, derivedFrom: null },
  { key: 'loe-22', sheet: 'LOE', category: 'Coax', name: 'Connectorize compression coax up to half inch', minutesPerUnit: 10, unit: 'Each', laborRole: 'Technician', includedInSubtotal: true, derivedFrom: null },
  { key: 'loe-31', sheet: 'LOE', category: 'Coax', name: 'Connectorize RG6/Ethernet cable', minutesPerUnit: 15, unit: 'Each', laborRole: 'Technician', includedInSubtotal: false, derivedFrom: null },
  {
    key: 'loe-25', sheet: 'LOE', category: 'Coax', name: 'Labeling Coax and Category Cable', minutesPerUnit: 2, unit: 'Each',
    laborRole: 'Technician', includedInSubtotal: true,
    derivedFrom: { terms: [{ key: 'loe-21', coeff: 1 }, { key: 'loe-22', coeff: 1 }, { key: 'loe-31', coeff: 1 }], divisor: 1 },
  },
];

describe('calculateLabor', () => {
  it('computes hours and cost for direct-input tasks', () => {
    const result = calculateLabor(baseTasks, [
      { key: 'loe-21', quantity: 4 },
      { key: 'loe-22', quantity: 2 },
      { key: 'loe-31', quantity: 10 },
    ], [], rates);

    const t21 = result.taskResults.find((t) => t.key === 'loe-21')!;
    expect(t21.hours).toBeCloseTo((4 * 15) / 60, 10); // 1 hour
    expect(t21.cost).toBeCloseTo(1 * 85, 10);
  });

  it('resolves a derived quantity from its source tasks', () => {
    const result = calculateLabor(baseTasks, [
      { key: 'loe-21', quantity: 4 },
      { key: 'loe-22', quantity: 2 },
      { key: 'loe-31', quantity: 10 },
    ], [], rates);

    const derived = result.taskResults.find((t) => t.key === 'loe-25')!;
    // 4 + 2 + 10 = 16 units of labeling, divisor 1
    expect(derived.quantity).toBe(16);
    expect(derived.hours).toBeCloseTo((16 * 2) / 60, 10);
  });

  it('excludes includedInSubtotal=false tasks from category subtotals but not from role totals', () => {
    const result = calculateLabor(baseTasks, [
      { key: 'loe-21', quantity: 4 },
      { key: 'loe-22', quantity: 2 },
      { key: 'loe-31', quantity: 10 },
    ], [], rates);

    const coaxSubtotal = result.categorySubtotals.find((c) => c.sheet === 'LOE' && c.category === 'Coax')!;
    const loe31 = result.taskResults.find((t) => t.key === 'loe-31')!;
    const loe21 = result.taskResults.find((t) => t.key === 'loe-21')!;
    const loe22 = result.taskResults.find((t) => t.key === 'loe-22')!;
    const loe25 = result.taskResults.find((t) => t.key === 'loe-25')!;
    // subtotal should include loe-21, loe-22, loe-25 but NOT loe-31 (includedInSubtotal: false)
    expect(coaxSubtotal.hours).toBeCloseTo(loe21.hours + loe22.hours + loe25.hours, 10);

    const techTotal = result.roleTotals.find((r) => r.role === 'Technician')!;
    // role total DOES include loe-31
    expect(techTotal.hours).toBeCloseTo(loe21.hours + loe22.hours + loe31.hours + loe25.hours, 10);
  });

  it('combines LOE and SOW grand totals', () => {
    const sowTask: LaborTask = {
      key: 'sow-4', sheet: 'SOW', category: 'Structure Support Labor', name: "6x2 Ladder Rack",
      minutesPerUnit: 5.19, unit: 'Per Foot', laborRole: 'Technician', includedInSubtotal: true, derivedFrom: null,
    };
    const result = calculateLabor([...baseTasks, sowTask], [
      { key: 'loe-21', quantity: 4 },
    ], [
      { key: 'sow-4', quantity: 100 },
    ], rates);

    const sowHours = (100 * 5.19) / 60;
    const loeHours = (4 * 15) / 60;
    expect(result.grandHours).toBeCloseTo(sowHours + loeHours, 8);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/calc/labor.test.ts`
Expected: FAIL — `Cannot find module './labor'`

- [ ] **Step 3: Implement `calculateLabor`**

```ts
// src/lib/calc/labor.ts
import type { LaborRole, LaborTask, LaborTaskLineInput, LaborResult, LaborTaskResult } from './types';

const ALL_ROLES: LaborRole[] = [
  'Technician', 'Construction Manager', 'RF-Engineer',
  'RF-Technician', 'Project Coordinator', 'Project Manager',
];

function resolveQuantities(
  tasks: LaborTask[],
  inputs: LaborTaskLineInput[],
): Map<string, number> {
  const inputMap = new Map(inputs.map((i) => [i.key, i.quantity]));
  const taskMap = new Map(tasks.map((t) => [t.key, t]));
  const resolved = new Map<string, number>();
  const resolving = new Set<string>();

  function resolve(key: string): number {
    if (resolved.has(key)) return resolved.get(key)!;
    const task = taskMap.get(key);
    if (!task) return 0;
    if (!task.derivedFrom) {
      const qty = inputMap.get(key) ?? 0;
      resolved.set(key, qty);
      return qty;
    }
    if (resolving.has(key)) {
      throw new Error(`Circular derived-quantity reference detected at task "${key}"`);
    }
    resolving.add(key);
    const sum = task.derivedFrom.terms.reduce((s, term) => s + term.coeff * resolve(term.key), 0);
    const qty = sum / task.derivedFrom.divisor;
    resolving.delete(key);
    resolved.set(key, qty);
    return qty;
  }

  for (const task of tasks) resolve(task.key);
  return resolved;
}

export function calculateLabor(
  tasks: LaborTask[],
  loeInputs: LaborTaskLineInput[],
  sowInputs: LaborTaskLineInput[],
  rates: { role: LaborRole; hourlyRate: number }[],
): LaborResult {
  const rateByRole = new Map(rates.map((r) => [r.role, r.hourlyRate]));
  const quantities = resolveQuantities(tasks, [...loeInputs, ...sowInputs]);

  const taskResults: LaborTaskResult[] = tasks.map((task) => {
    const quantity = quantities.get(task.key) ?? 0;
    const hours = (quantity * task.minutesPerUnit) / 60;
    const rate = rateByRole.get(task.laborRole) ?? 0;
    return { key: task.key, quantity, hours, cost: hours * rate };
  });

  const resultByKey = new Map(taskResults.map((r) => [r.key, r]));

  const categoryKeys = Array.from(new Set(tasks.map((t) => `${t.sheet}::${t.category}`)));
  const categorySubtotals = categoryKeys.map((ck) => {
    const [sheet, category] = ck.split('::') as ['LOE' | 'SOW', string];
    const inCategory = tasks.filter((t) => t.sheet === sheet && t.category === category && t.includedInSubtotal);
    const hours = inCategory.reduce((s, t) => s + (resultByKey.get(t.key)?.hours ?? 0), 0);
    const cost = inCategory.reduce((s, t) => s + (resultByKey.get(t.key)?.cost ?? 0), 0);
    return { sheet, category, hours, cost };
  });

  const roleTotals = ALL_ROLES.map((role) => {
    const inRole = tasks.filter((t) => t.laborRole === role);
    const hours = inRole.reduce((s, t) => s + (resultByKey.get(t.key)?.hours ?? 0), 0);
    const cost = inRole.reduce((s, t) => s + (resultByKey.get(t.key)?.cost ?? 0), 0);
    return { role, hours, cost };
  });

  const grandHours = roleTotals.reduce((s, r) => s + r.hours, 0);
  const grandCost = roleTotals.reduce((s, r) => s + r.cost, 0);

  return { taskResults, categorySubtotals, roleTotals, grandHours, grandCost };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/calc/labor.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/calc/labor.ts src/lib/calc/labor.test.ts
git commit -m "Add labor calculation module with derived-quantity resolution"
```

---

### Task 8: Calculation engine — crew plan (Labor Projections)

**Files:**
- Create: `src/lib/calc/crew.ts`
- Test: `src/lib/calc/crew.test.ts`

**Interfaces:**
- Consumes: `LaborResult` from Task 7; `LaborProjectionSettings`, `CrewSizeRow`, `LaborRole`, `CrewPlanResult` from Task 5.
- Produces: `calculateCrewPlan(labor: LaborResult, settings: LaborProjectionSettings, crewSizeTable: CrewSizeRow[], rates: { role: LaborRole; hourlyRate: number }[], technicianCount: number): CrewPlanResult` — used by Task 11.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/calc/crew.test.ts
import { describe, it, expect } from 'vitest';
import { calculateCrewPlan } from './crew';
import type { LaborResult } from './types';

const labor: LaborResult = {
  taskResults: [],
  categorySubtotals: [],
  roleTotals: [],
  grandHours: 1000,
  grandCost: 85000,
};

const settings = {
  hoursPerManDay: 8,
  hoursPerManWeek: 40,
  stagingMaterialMultiplier: 0.05,
  cmPercentOfTechHours: 0.5,
  pmPercentOfTechHours: 0.25,
  coordinatorPercentOfTechHours: 0.15,
};

const crewSizeTable = [
  { technicianCount: 4, cmsNeeded: 2 },
  { technicianCount: 10, cmsNeeded: 1 },
];

const rates = [
  { role: 'Construction Manager' as const, hourlyRate: 95 },
  { role: 'Project Manager' as const, hourlyRate: 100 },
  { role: 'Project Coordinator' as const, hourlyRate: 55 },
];

describe('calculateCrewPlan', () => {
  it('applies the 5% staging multiplier to total project time', () => {
    const result = calculateCrewPlan(labor, settings, crewSizeTable, rates, 4);
    expect(result.stagingHours).toBeCloseTo(1000 * 0.05, 8);
    expect(result.totalProjectTime).toBeCloseTo(1050, 8);
  });

  it('converts total project time into man-days and man-weeks', () => {
    const result = calculateCrewPlan(labor, settings, crewSizeTable, rates, 4);
    expect(result.manDays).toBeCloseTo(1050 / 8, 8);
    expect(result.manWeeks).toBeCloseTo(1050 / 40, 8);
  });

  it('looks up cmsNeeded for the chosen technician count and computes total CM hours', () => {
    const result = calculateCrewPlan(labor, settings, crewSizeTable, rates, 4);
    expect(result.cmsNeeded).toBe(2);
    // calendarWeeks = manWeeks / technicianCount = (1050/40) / 4
    const expectedCalendarWeeks = (1050 / 40) / 4;
    expect(result.calendarWeeks).toBeCloseTo(expectedCalendarWeeks, 8);
    // totalCmHours = hoursPerManWeek * cmsNeeded * calendarWeeks
    expect(result.totalCmHours).toBeCloseTo(40 * 2 * expectedCalendarWeeks, 6);
  });

  it('computes ops admin labor cost per role from percentages of total CM hours', () => {
    const result = calculateCrewPlan(labor, settings, crewSizeTable, rates, 4);
    const cmAdmin = result.opsAdminLaborByRole.find((r) => r.role === 'Construction Manager')!;
    expect(cmAdmin.hours).toBeCloseTo(result.totalCmHours * 0.5, 6);
    expect(cmAdmin.cost).toBeCloseTo(cmAdmin.hours * 95, 6);

    const pmAdmin = result.opsAdminLaborByRole.find((r) => r.role === 'Project Manager')!;
    expect(pmAdmin.hours).toBeCloseTo(result.totalCmHours * 0.25, 6);

    const total = result.opsAdminLaborTotal;
    expect(total.cost).toBeCloseTo(
      result.opsAdminLaborByRole.reduce((s, r) => s + r.cost, 0), 8,
    );
  });

  it('returns zero cmsNeeded when the technician count has no matching row', () => {
    const result = calculateCrewPlan(labor, settings, crewSizeTable, rates, 7);
    expect(result.cmsNeeded).toBe(0);
    expect(result.totalCmHours).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/calc/crew.test.ts`
Expected: FAIL — `Cannot find module './crew'`

- [ ] **Step 3: Implement `calculateCrewPlan`**

```ts
// src/lib/calc/crew.ts
import type { CrewPlanResult, CrewSizeRow, LaborProjectionSettings, LaborResult, LaborRole } from './types';

export function calculateCrewPlan(
  labor: LaborResult,
  settings: LaborProjectionSettings,
  crewSizeTable: CrewSizeRow[],
  rates: { role: LaborRole; hourlyRate: number }[],
  technicianCount: number,
): CrewPlanResult {
  const rateByRole = new Map(rates.map((r) => [r.role, r.hourlyRate]));

  const totalHoursInProject = labor.grandHours;
  const stagingHours = totalHoursInProject * settings.stagingMaterialMultiplier;
  const totalProjectTime = totalHoursInProject + stagingHours;

  const manDays = totalProjectTime / settings.hoursPerManDay;
  const manWeeks = totalProjectTime / settings.hoursPerManWeek;

  const row = crewSizeTable.find((r) => r.technicianCount === technicianCount);
  const cmsNeeded = row?.cmsNeeded ?? 0;
  const calendarDays = technicianCount ? manDays / technicianCount : 0;
  const calendarWeeks = technicianCount ? manWeeks / technicianCount : 0;
  const totalCmHours = settings.hoursPerManWeek * cmsNeeded * calendarWeeks;

  const averageOpsLaborRate = totalHoursInProject ? labor.grandCost / totalHoursInProject : 0;

  const opsAdminLaborByRole = [
    { role: 'Construction Manager' as const, percent: settings.cmPercentOfTechHours },
    { role: 'Project Manager' as const, percent: settings.pmPercentOfTechHours },
    { role: 'Project Coordinator' as const, percent: settings.coordinatorPercentOfTechHours },
  ].map(({ role, percent }) => {
    const hours = totalCmHours * percent;
    const cost = hours * (rateByRole.get(role) ?? 0);
    return { role, hours, cost };
  });

  const opsAdminLaborTotal = opsAdminLaborByRole.reduce(
    (acc, r) => ({ hours: acc.hours + r.hours, cost: acc.cost + r.cost }),
    { hours: 0, cost: 0 },
  );

  return {
    totalHoursInProject,
    stagingHours,
    totalProjectTime,
    manDays,
    manWeeks,
    calendarDays,
    calendarWeeks,
    cmsNeeded,
    totalCmHours,
    averageOpsLaborRate,
    opsAdminLaborByRole,
    opsAdminLaborTotal,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/calc/crew.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/calc/crew.ts src/lib/calc/crew.test.ts
git commit -m "Add crew-size planning calculation module"
```

---

### Task 9: Calculation engine — pass throughs

**Files:**
- Create: `src/lib/calc/passThroughs.ts`
- Test: `src/lib/calc/passThroughs.test.ts`

**Interfaces:**
- Consumes: `PassThroughInput`, `PassThroughResult`, `LaborRole` from Task 5.
- Produces: `calculatePassThroughs(input: PassThroughInput, rates: ReferenceData['passThroughRates'], laborRates: { role: LaborRole; hourlyRate: number }[]): PassThroughResult` — used by Task 11.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/calc/passThroughs.test.ts
import { describe, it, expect } from 'vitest';
import { calculatePassThroughs } from './passThroughs';

const rates = {
  perDiemRateByRole: [{ role: 'Technician' as const, rate: 50 }],
  lodgingRateByRole: [{ role: 'Technician' as const, rate: 120 }],
  airfareCostByRole: [{ role: 'Technician' as const, cost: 500 }],
  rentals: [{ key: 'rental-46', name: 'Lift', rate: 1200, unit: 'Month' }],
  softCosts: [{ key: 'softcost-62', name: 'Benchmark Testing', fee: 4500 }],
};

const laborRates = [{ role: 'Technician' as const, hourlyRate: 85 }];

describe('calculatePassThroughs', () => {
  it('computes per diem as rate * employeeCount * days', () => {
    const result = calculatePassThroughs({
      perDiem: [{ role: 'Technician', employeeCount: 4, days: 10 }],
      lodging: [], travel: [], airfare: [], rentals: [], softCosts: [],
    }, rates, laborRates);
    expect(result.perDiemTotal).toBe(50 * 4 * 10);
  });

  it('computes travel using the labor hourly rate, not a separate rate table', () => {
    const result = calculatePassThroughs({
      perDiem: [], lodging: [],
      travel: [{ role: 'Technician', employeeCount: 3, hours: 8 }],
      airfare: [], rentals: [], softCosts: [],
    }, rates, laborRates);
    expect(result.travelTotal).toBe(85 * 3 * 8);
    expect(result.travelHours).toBe(3 * 8);
  });

  it('computes airfare as ticket cost * qty, rentals as rate * qty, soft costs as fee * qty', () => {
    const result = calculatePassThroughs({
      perDiem: [], lodging: [], travel: [],
      airfare: [{ role: 'Technician', qty: 2 }],
      rentals: [{ key: 'rental-46', qty: 3 }],
      softCosts: [{ key: 'softcost-62', qty: 1 }],
    }, rates, laborRates);
    expect(result.airfareTotal).toBe(500 * 2);
    expect(result.rentalsTotal).toBe(1200 * 3);
    expect(result.softCostsTotal).toBe(4500 * 1);
  });

  it('grand total sums all six categories including travel', () => {
    const result = calculatePassThroughs({
      perDiem: [{ role: 'Technician', employeeCount: 1, days: 1 }],
      lodging: [{ role: 'Technician', employeeCount: 1, days: 1 }],
      travel: [{ role: 'Technician', employeeCount: 1, hours: 1 }],
      airfare: [{ role: 'Technician', qty: 1 }],
      rentals: [{ key: 'rental-46', qty: 1 }],
      softCosts: [{ key: 'softcost-62', qty: 1 }],
    }, rates, laborRates);
    expect(result.grandTotal).toBe(
      result.perDiemTotal + result.lodgingTotal + result.travelTotal +
      result.airfareTotal + result.rentalsTotal + result.softCostsTotal,
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/calc/passThroughs.test.ts`
Expected: FAIL — `Cannot find module './passThroughs'`

- [ ] **Step 3: Implement `calculatePassThroughs`**

```ts
// src/lib/calc/passThroughs.ts
import type { LaborRole, PassThroughInput, PassThroughResult, ReferenceData } from './types';

export function calculatePassThroughs(
  input: PassThroughInput,
  rates: ReferenceData['passThroughRates'],
  laborRates: { role: LaborRole; hourlyRate: number }[],
): PassThroughResult {
  const perDiemRateByRole = new Map(rates.perDiemRateByRole.map((r) => [r.role, r.rate]));
  const perDiemTotal = input.perDiem.reduce(
    (s, l) => s + (perDiemRateByRole.get(l.role) ?? 0) * l.employeeCount * l.days, 0,
  );

  const lodgingRateByRole = new Map(rates.lodgingRateByRole.map((r) => [r.role, r.rate]));
  const lodgingTotal = input.lodging.reduce(
    (s, l) => s + (lodgingRateByRole.get(l.role) ?? 0) * l.employeeCount * l.days, 0,
  );

  const hourlyByRole = new Map(laborRates.map((r) => [r.role, r.hourlyRate]));
  const travelTotal = input.travel.reduce(
    (s, l) => s + (hourlyByRole.get(l.role) ?? 0) * l.employeeCount * l.hours, 0,
  );
  const travelHours = input.travel.reduce((s, l) => s + l.employeeCount * l.hours, 0);

  const airfareCostByRole = new Map(rates.airfareCostByRole.map((r) => [r.role, r.cost]));
  const airfareTotal = input.airfare.reduce(
    (s, l) => s + (airfareCostByRole.get(l.role) ?? 0) * l.qty, 0,
  );

  const rentalRateByKey = new Map(rates.rentals.map((r) => [r.key, r.rate]));
  const rentalsTotal = input.rentals.reduce(
    (s, l) => s + (rentalRateByKey.get(l.key) ?? 0) * l.qty, 0,
  );

  const softCostFeeByKey = new Map(rates.softCosts.map((r) => [r.key, r.fee]));
  const softCostsTotal = input.softCosts.reduce(
    (s, l) => s + (softCostFeeByKey.get(l.key) ?? 0) * l.qty, 0,
  );

  const grandTotal = perDiemTotal + lodgingTotal + travelTotal + airfareTotal + rentalsTotal + softCostsTotal;

  return { perDiemTotal, lodgingTotal, travelTotal, travelHours, airfareTotal, rentalsTotal, softCostsTotal, grandTotal };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/calc/passThroughs.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/calc/passThroughs.ts src/lib/calc/passThroughs.test.ts
git commit -m "Add pass-throughs calculation module"
```

---

### Task 10: Calculation engine — Executive Summary rollup

**Files:**
- Create: `src/lib/calc/executiveSummary.ts`
- Test: `src/lib/calc/executiveSummary.test.ts`

**Interfaces:**
- Consumes: `LaborResult` (Task 7), `CrewPlanResult` (Task 8), `PassThroughResult` (Task 9), `MaterialResult` (Task 6), `LaborProjectionSettings`/`MarkupInputs`/`ExecutiveSummaryResult` (Task 5).
- Produces: `calculateExecutiveSummary(labor, crewPlan, passThroughs, materials, settings, markups): ExecutiveSummaryResult` — used by Task 11.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/calc/executiveSummary.test.ts
import { describe, it, expect } from 'vitest';
import { calculateExecutiveSummary } from './executiveSummary';
import type { LaborResult, CrewPlanResult, PassThroughResult, MaterialResult } from './types';

const labor: LaborResult = { taskResults: [], categorySubtotals: [], roleTotals: [], grandHours: 1000, grandCost: 85000 };

const crewPlan: CrewPlanResult = {
  totalHoursInProject: 1000, stagingHours: 50, totalProjectTime: 1050,
  manDays: 131.25, manWeeks: 26.25, calendarDays: 32.8125, calendarWeeks: 6.5625,
  cmsNeeded: 2, totalCmHours: 525, averageOpsLaborRate: 85,
  opsAdminLaborByRole: [
    { role: 'Construction Manager', hours: 262.5, cost: 262.5 * 95 },
    { role: 'Project Manager', hours: 131.25, cost: 131.25 * 100 },
    { role: 'Project Coordinator', hours: 78.75, cost: 78.75 * 55 },
  ],
  opsAdminLaborTotal: { hours: 472.5, cost: 262.5 * 95 + 131.25 * 100 + 78.75 * 55 },
};

const passThroughs: PassThroughResult = {
  perDiemTotal: 2000, lodgingTotal: 4800, travelTotal: 2040, travelHours: 24,
  airfareTotal: 1000, rentalsTotal: 3600, softCostsTotal: 4500,
  grandTotal: 2000 + 4800 + 2040 + 1000 + 3600 + 4500,
};

const materials: MaterialResult = {
  lines: [],
  categoryTotals: [
    { category: 'Consumable', total: 500 },
    { category: 'DAS Materials', total: 40000 },
    { category: 'BAT Materials', total: 0 },
  ],
  contingency: 4050,
  shippingHandling: 200,
  hardwareTotal: 500 + 40000 + 0 + 4050 + 200,
};

const settings = {
  hoursPerManDay: 8, hoursPerManWeek: 40, stagingMaterialMultiplier: 0.05,
  cmPercentOfTechHours: 0.5, pmPercentOfTechHours: 0.25, coordinatorPercentOfTechHours: 0.15,
};

const markups = {
  laborMarkupPct: 0.25, passThroughMarkupPct: 0.25, materialMarkupPct: 0.25,
  corporateMarkupPct: 0.05, marginTweak: 0, taxRate: 0.0825,
};

describe('calculateExecutiveSummary', () => {
  it('applies the 5% staging multiplier to operational labor cost', () => {
    const result = calculateExecutiveSummary(labor, crewPlan, passThroughs, materials, settings, markups);
    expect(result.operationalLaborCost).toBeCloseTo(85000 * 1.05, 6);
  });

  it('sums operational + admin + travel into total project labor, then applies labor markup', () => {
    const result = calculateExecutiveSummary(labor, crewPlan, passThroughs, materials, settings, markups);
    const expectedBase = 85000 * 1.05 + crewPlan.opsAdminLaborTotal.cost + passThroughs.travelTotal;
    expect(result.totalProjectLaborCost).toBeCloseTo(expectedBase, 6);
    expect(result.totalProjectLaborBilled).toBeCloseTo(expectedBase * 1.25, 6);
  });

  it('excludes travel from total pass-through cost (travel is counted under labor)', () => {
    const result = calculateExecutiveSummary(labor, crewPlan, passThroughs, materials, settings, markups);
    const expected = passThroughs.perDiemTotal + passThroughs.lodgingTotal + passThroughs.airfareTotal +
      passThroughs.rentalsTotal + passThroughs.softCostsTotal;
    expect(result.totalPassThroughCost).toBeCloseTo(expected, 6);
  });

  it('computes total material cost as the materials hardware total', () => {
    const result = calculateExecutiveSummary(labor, crewPlan, passThroughs, materials, settings, markups);
    expect(result.totalMaterialCost).toBe(materials.hardwareTotal);
    expect(result.totalMaterialBilled).toBeCloseTo(materials.hardwareTotal * 1.25, 6);
  });

  it('applies the margin tweak and corporate markup to reach Grand Total to Bid, tax exempt', () => {
    const result = calculateExecutiveSummary(labor, crewPlan, passThroughs, materials, settings, markups);
    const expectedTotalDirect = result.totalProjectLaborBilled + result.totalPassThroughBilled + result.totalMaterialBilled;
    expect(result.totalDirectCost).toBeCloseTo(expectedTotalDirect, 6);
    expect(result.projectedGrossMarginTotal).toBeCloseTo(expectedTotalDirect + markups.marginTweak, 6);
    const expectedCorporate = result.projectedGrossMarginTotal * 0.05;
    expect(result.corporateMarkupCost).toBeCloseTo(expectedCorporate, 6);
    expect(result.projectedNetMarginTotal).toBeCloseTo(result.projectedGrossMarginTotal + expectedCorporate, 6);
    // Grand Total to Bid (tax exempt) must equal the PNM Grand Total (verified algebraically from the workbook's apportionment formulas)
    expect(result.grandTotalToBidTaxExempt).toBeCloseTo(result.projectedNetMarginTotal, 6);
  });

  it('applies the margin tweak correctly when non-zero', () => {
    const tweakedMarkups = { ...markups, marginTweak: 5000 };
    const result = calculateExecutiveSummary(labor, crewPlan, passThroughs, materials, settings, tweakedMarkups);
    const baseResult = calculateExecutiveSummary(labor, crewPlan, passThroughs, materials, settings, markups);
    expect(result.projectedGrossMarginTotal).toBeCloseTo(baseResult.totalDirectCost + 5000, 6);
  });

  it('computes tax amount and tax-included total from the tax rate', () => {
    const result = calculateExecutiveSummary(labor, crewPlan, passThroughs, materials, settings, markups);
    expect(result.taxAmount).toBeCloseTo(result.grandTotalToBidTaxExempt * 0.0825, 6);
    expect(result.grandTotalToBidTaxIncluded).toBeCloseTo(result.grandTotalToBidTaxExempt + result.taxAmount, 6);
  });

  it('computes net profit as revenue-after-all-markups minus true cost (documented simplification)', () => {
    const result = calculateExecutiveSummary(labor, crewPlan, passThroughs, materials, settings, markups);
    expect(result.netProfit).toBeCloseTo(result.projectedNetMarginTotal - result.totalDirectCostBreakEven, 6);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/calc/executiveSummary.test.ts`
Expected: FAIL — `Cannot find module './executiveSummary'`

- [ ] **Step 3: Implement `calculateExecutiveSummary`**

```ts
// src/lib/calc/executiveSummary.ts
import type {
  CrewPlanResult, ExecutiveSummaryResult, LaborProjectionSettings, LaborResult,
  MarkupInputs, MaterialResult, PassThroughResult,
} from './types';

export function calculateExecutiveSummary(
  labor: LaborResult,
  crewPlan: CrewPlanResult,
  passThroughs: PassThroughResult,
  materials: MaterialResult,
  settings: LaborProjectionSettings,
  markups: MarkupInputs,
): ExecutiveSummaryResult {
  const operationalLaborCost = labor.grandCost * (1 + settings.stagingMaterialMultiplier);
  const opsAdminLaborCost = crewPlan.opsAdminLaborTotal.cost;
  const travelCost = passThroughs.travelTotal;
  const totalProjectLaborCost = operationalLaborCost + opsAdminLaborCost + travelCost;
  const totalProjectLaborBilled = totalProjectLaborCost * (1 + markups.laborMarkupPct);

  const perDiemCost = passThroughs.perDiemTotal;
  const lodgingCost = passThroughs.lodgingTotal;
  const airfareCost = passThroughs.airfareTotal;
  const rentalsCost = passThroughs.rentalsTotal;
  const softCostsCost = passThroughs.softCostsTotal;
  const totalPassThroughCost = perDiemCost + lodgingCost + airfareCost + rentalsCost + softCostsCost;
  const totalPassThroughBilled = totalPassThroughCost * (1 + markups.passThroughMarkupPct);

  const consumableCost = materials.categoryTotals.find((c) => c.category === 'Consumable')?.total ?? 0;
  const dasMaterialsCost = materials.categoryTotals.find((c) => c.category === 'DAS Materials')?.total ?? 0;
  const batMaterialsCost = materials.categoryTotals.find((c) => c.category === 'BAT Materials')?.total ?? 0;
  const materialContingencyAndSH = materials.contingency + materials.shippingHandling;
  const totalMaterialCost = materials.hardwareTotal;
  const totalMaterialBilled = totalMaterialCost * (1 + markups.materialMarkupPct);

  const totalDirectCost = totalProjectLaborBilled + totalPassThroughBilled + totalMaterialBilled;
  const totalDirectCostBreakEven = totalProjectLaborCost + totalPassThroughCost + totalMaterialCost;

  const grossProfit = totalDirectCost - totalDirectCostBreakEven;
  const markupPercent = totalDirectCostBreakEven ? totalDirectCost / totalDirectCostBreakEven - 1 : 0;
  const grossMarginPercent = totalDirectCost ? 1 - totalDirectCostBreakEven / totalDirectCost : 0;

  const projectedGrossMarginTotal = totalDirectCost + markups.marginTweak;
  const corporateMarkupCost = projectedGrossMarginTotal * markups.corporateMarkupPct;
  const projectedNetMarginTotal = projectedGrossMarginTotal + corporateMarkupCost;

  const netProfit = projectedNetMarginTotal - totalDirectCostBreakEven;
  const netMarkupPercent = totalDirectCostBreakEven ? projectedNetMarginTotal / totalDirectCostBreakEven - 1 : 0;
  const netMarginPercent = projectedNetMarginTotal ? 1 - totalDirectCostBreakEven / projectedNetMarginTotal : 0;

  const laborExpenseApportionment = totalDirectCost
    ? (totalProjectLaborBilled + totalPassThroughBilled) / totalDirectCost
    : 0;
  const materialApportionment = totalDirectCost ? totalMaterialBilled / totalDirectCost : 0;

  const totalLaborToBid =
    totalProjectLaborBilled +
    totalPassThroughBilled +
    corporateMarkupCost * laborExpenseApportionment +
    markups.marginTweak * laborExpenseApportionment;

  const totalMaterialToBid =
    totalMaterialBilled +
    corporateMarkupCost * materialApportionment +
    markups.marginTweak * materialApportionment;

  const grandTotalToBidTaxExempt = totalLaborToBid + totalMaterialToBid;
  const taxAmount = grandTotalToBidTaxExempt * markups.taxRate;
  const grandTotalToBidTaxIncluded = grandTotalToBidTaxExempt + taxAmount;

  return {
    operationalLaborCost, opsAdminLaborCost, travelCost,
    totalProjectLaborCost, totalProjectLaborBilled,
    perDiemCost, lodgingCost, airfareCost, rentalsCost, softCostsCost,
    totalPassThroughCost, totalPassThroughBilled,
    consumableCost, dasMaterialsCost, batMaterialsCost, materialContingencyAndSH,
    totalMaterialCost, totalMaterialBilled,
    totalDirectCost, totalDirectCostBreakEven, grossProfit, markupPercent, grossMarginPercent,
    projectedGrossMarginTotal, corporateMarkupCost, projectedNetMarginTotal,
    netProfit, netMarkupPercent, netMarginPercent,
    totalLaborToBid, totalMaterialToBid,
    grandTotalToBidTaxExempt, taxAmount, grandTotalToBidTaxIncluded,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/calc/executiveSummary.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/calc/executiveSummary.ts src/lib/calc/executiveSummary.test.ts
git commit -m "Add Executive Summary rollup calculation module"
```

---

### Task 11: Calculation engine — orchestrator

**Files:**
- Create: `src/lib/calc/index.ts`
- Test: `src/lib/calc/index.test.ts`

**Interfaces:**
- Consumes: `calculateMaterials` (Task 6), `calculateLabor` (Task 7), `calculateCrewPlan` (Task 8), `calculatePassThroughs` (Task 9), `calculateExecutiveSummary` (Task 10), `ReferenceData`, `EstimateInput`, `EstimateResult` (Task 5).
- Produces: `buildEstimateResult(input: EstimateInput, referenceData: ReferenceData): EstimateResult` — this is the single entry point Plan 2's UI and PDF export will call.

- [ ] **Step 1: Write the failing integration test**

```ts
// src/lib/calc/index.test.ts
import { describe, it, expect } from 'vitest';
import { buildEstimateResult } from './index';
import type { EstimateInput, ReferenceData } from './types';

const referenceData: ReferenceData = {
  materialItems: [
    { key: 'bom-3', type: 'DC Power Plant', manufacturer: 'Vertiv', model: '582137200', description: 'NetSure 5100', vendor: 'Anixter', category: 'DAS Materials', unitCost: 4685 },
  ],
  laborTasks: [
    { key: 'loe-21', sheet: 'LOE', category: 'Coax', name: 'Connectorize captive coax up to half inch', minutesPerUnit: 15, unit: 'Each', laborRole: 'Technician', includedInSubtotal: true, derivedFrom: null },
  ],
  laborRates: [
    { role: 'Technician', hourlyRate: 85 },
    { role: 'Construction Manager', hourlyRate: 95 },
    { role: 'RF-Engineer', hourlyRate: 100 },
    { role: 'RF-Technician', hourlyRate: 75 },
    { role: 'Project Coordinator', hourlyRate: 55 },
    { role: 'Project Manager', hourlyRate: 100 },
  ],
  crewSizeTable: [{ technicianCount: 4, cmsNeeded: 2 }],
  laborProjectionSettings: {
    hoursPerManDay: 8, hoursPerManWeek: 40, stagingMaterialMultiplier: 0.05,
    cmPercentOfTechHours: 0.5, pmPercentOfTechHours: 0.25, coordinatorPercentOfTechHours: 0.15,
  },
  passThroughRates: {
    perDiemRateByRole: [{ role: 'Technician', rate: 50 }],
    lodgingRateByRole: [{ role: 'Technician', rate: 120 }],
    airfareCostByRole: [{ role: 'Technician', cost: 500 }],
    rentals: [],
    softCosts: [],
  },
};

const input: EstimateInput = {
  materials: [{ key: 'bom-3', quantity: 2 }],
  contingencyPct: 0.10,
  shippingHandling: 0,
  loeTasks: [{ key: 'loe-21', quantity: 10 }],
  sowTasks: [],
  technicianCount: 4,
  passThroughs: { perDiem: [], lodging: [], travel: [], airfare: [], rentals: [], softCosts: [] },
  markups: {
    laborMarkupPct: 0.25, passThroughMarkupPct: 0.25, materialMarkupPct: 0.25,
    corporateMarkupPct: 0.05, marginTweak: 0, taxRate: 0.0825,
  },
};

describe('buildEstimateResult', () => {
  it('wires materials, labor, crew plan, pass throughs, and executive summary together', () => {
    const result = buildEstimateResult(input, referenceData);

    expect(result.materials.hardwareTotal).toBeGreaterThan(0);
    expect(result.labor.grandHours).toBeCloseTo((10 * 15) / 60, 8);
    expect(result.crewPlan.cmsNeeded).toBe(2);
    expect(result.passThroughs.grandTotal).toBe(0);
    expect(result.executiveSummary.grandTotalToBidTaxIncluded).toBeGreaterThan(
      result.executiveSummary.grandTotalToBidTaxExempt,
    );
  });

  it('produces an all-zero result when given all-zero quantities', () => {
    const zeroInput: EstimateInput = {
      ...input,
      materials: [{ key: 'bom-3', quantity: 0 }],
      loeTasks: [{ key: 'loe-21', quantity: 0 }],
    };
    const result = buildEstimateResult(zeroInput, referenceData);
    expect(result.materials.hardwareTotal).toBe(0);
    expect(result.labor.grandHours).toBe(0);
    expect(result.executiveSummary.grandTotalToBidTaxExempt).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/calc/index.test.ts`
Expected: FAIL — `Cannot find module './index'`

- [ ] **Step 3: Implement `buildEstimateResult`**

```ts
// src/lib/calc/index.ts
import { calculateMaterials } from './materials';
import { calculateLabor } from './labor';
import { calculateCrewPlan } from './crew';
import { calculatePassThroughs } from './passThroughs';
import { calculateExecutiveSummary } from './executiveSummary';
import type { EstimateInput, EstimateResult, ReferenceData } from './types';

export function buildEstimateResult(input: EstimateInput, referenceData: ReferenceData): EstimateResult {
  const materials = calculateMaterials(
    referenceData.materialItems,
    input.materials,
    input.contingencyPct,
    input.shippingHandling,
  );

  const labor = calculateLabor(
    referenceData.laborTasks,
    input.loeTasks,
    input.sowTasks,
    referenceData.laborRates,
  );

  const crewPlan = calculateCrewPlan(
    labor,
    referenceData.laborProjectionSettings,
    referenceData.crewSizeTable,
    referenceData.laborRates,
    input.technicianCount,
  );

  const passThroughs = calculatePassThroughs(
    input.passThroughs,
    referenceData.passThroughRates,
    referenceData.laborRates,
  );

  const executiveSummary = calculateExecutiveSummary(
    labor,
    crewPlan,
    passThroughs,
    materials,
    referenceData.laborProjectionSettings,
    input.markups,
  );

  return { materials, labor, crewPlan, passThroughs, executiveSummary };
}

export * from './types';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/calc/index.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: All test files pass (materials, labor, crew, passThroughs, executiveSummary, index, cn — 28 tests total across all Task 1–11 test files).

- [ ] **Step 6: Commit**

```bash
git add src/lib/calc/index.ts src/lib/calc/index.test.ts
git commit -m "Add calculation engine orchestrator wiring all modules together"
```

---

## What This Plan Does Not Cover (deferred to later plans)

- **Plan 2 — Estimating Workflow UI**: sidebar layout, sticky summary strip, Cover Info / Materials / Labor / Pass Throughs / Executive Summary pages, data-loading from Prisma into `ReferenceData`, PDF export via `@react-pdf/renderer`.
- **Plan 3 — Admin Area**: CRUD screens for material catalog, labor task library, labor rates, crew-size table, pass-through rate defaults, and estimate defaults (markup %/tax rate).

Once this plan is complete, `npm test` passes end-to-end and `buildEstimateResult()` is a proven, correct, importable function — the foundation Plan 2 builds its pages on top of.
