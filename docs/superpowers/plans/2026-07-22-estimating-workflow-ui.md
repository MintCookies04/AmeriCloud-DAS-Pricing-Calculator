# Estimating Workflow UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full estimating workflow UI on top of the Foundation phase's calculation engine and seeded database: a collapsible sidebar + sticky summary strip shell, and five pages (Cover Info, Materials, Labor, Pass Throughs, Executive Summary) that let an estimator select materials/labor/pass-through options and see a live-updating, PDF-exportable Executive Summary. This also closes the two follow-up items flagged by Plan 1's final review (a real-seed-data integration test, and the `derivedFromJson` ↔ `derivedFrom` mapping contract).

**Architecture:** A server-side data loader (`src/lib/data/loadReferenceData.ts`) maps Prisma rows into the calc engine's `ReferenceData` shape, fetched once in the root layout (a Server Component) and handed to a client-side `EstimateProvider` (React Context) that holds all estimate input state and recomputes `EstimateResult` via `buildEstimateResult()` on every change using `useMemo` — no server round-trips for calculations. Every page is a Client Component reading/writing through `useEstimate()`. PDF export renders a `@react-pdf/renderer` document client-side from the same `EstimateResult` the screen shows.

**Tech Stack:** Next.js 14 (App Router, Client + Server Components), React Context for state, `@react-pdf/renderer` for PDF export, Vitest + `@testing-library/react` + jsdom for component tests (new — Plan 1 only needed the pure-Node calc-engine tests).

## Global Constraints

- No user accounts/auth, no saved-estimate history — estimate state lives only in browser memory for the session (confirmed in the design spec).
- Brand theme (from `tailwind.config.ts`, already in place): navy `navy`/`navy-deep`/`navy-2` for chrome (sidebar/topbar/summary strip), `mist`/`mist-2`/white for content backgrounds, `red`/`red-700` for primary actions and the Grand Total figure, `slate`/`slate-2` for secondary text, `font-display` (Archivo) for headings, `font-body` (Manrope, default) for body/data.
- Every page lives at its own route, reachable any time via the sidebar (no forced linear order). Each page (except Executive Summary) ends with a "Move to →" button advancing to the next stage: Cover Info → Materials → Labor → Pass Throughs → Executive Summary.
- The sticky summary strip (Materials / Labor / Pass Throughs / Grand Total to Bid) is visible on every estimating page.
- Reference data (catalog, tasks, rates) is read-only from these pages — editing it is Plan 3's Admin Area, out of scope here.
- No placeholders, no `TODO`s in committed code. Every function/component must be fully implemented before merging.
- This project uses `noUncheckedIndexedAccess: true` in `tsconfig.json` — run `npx tsc --noEmit` before every commit, not just at the end (a Plan 1 task skipped this once and a real type error went undetected for a full task cycle).
- Per the design spec's testing philosophy: the calculation engine (done in Plan 1) carries the heavy unit-test burden; UI components get targeted component-level tests (rendering + one key interaction per component), not exhaustive coverage — full workflow correctness is confirmed by manually running `npm run dev` and clicking through before considering this plan done.
- Derived-quantity labor tasks (`task.derivedFrom !== null`) must render their quantity as read-only/computed in every page that lists tasks — never as an editable input — since editing them would have no effect (the engine recomputes them from their source tasks).

---

### Task 1: Reference data loader + golden-scenario integration test

**Files:**
- Create: `src/lib/data/loadReferenceData.ts`
- Test: `src/lib/data/loadReferenceData.integration.test.ts`

**Interfaces:**
- Consumes: `ReferenceData`, `MaterialItem`, `LaborTask`, `LaborRole`, `LaborTaskDerivation`, `buildEstimateResult` from `@/lib/calc` (Plan 1); Prisma models from `@/lib/db`.
- Produces: `loadReferenceData(): Promise<ReferenceData>` and `loadEstimateDefaults(): Promise<EstimateDefaultsData>` (a new exported interface: `{ laborMarkupPct, passThroughMarkupPct, materialMarkupPct, corporateMarkupPct, taxRate, contingencyPct }`, all `number`) — both used by Task 2 (server-side fetch in the root layout) and by this task's own integration test.

**Note:** this task's test requires a live, seeded local Postgres (the same one set up in Plan 1 — `docker start das-estimator-postgres` if not running, and a `.env` with `DATABASE_URL="postgresql://das:das@localhost:5433/das_estimator"` at the repo root). If the container or `.env` is missing, set both up first (see `CLAUDE.md`) before running this task's test.

- [ ] **Step 1: Confirm the local Postgres is up and seeded**

Run: `docker ps --filter name=das-estimator-postgres --format "{{.Names}}: {{.Status}}"`
Expected: `das-estimator-postgres: Up ...`. If not running: `docker start das-estimator-postgres` (start Docker Desktop first if needed).

Run: `npx prisma migrate status`
Expected: `Database schema is up to date!`. If `.env` is missing, create it: `printf 'DATABASE_URL="postgresql://das:das@localhost:5433/das_estimator"\n' > .env`.

- [ ] **Step 2: Write the loader**

```ts
// src/lib/data/loadReferenceData.ts
import { prisma } from '@/lib/db';
import type { LaborRoleName, MaterialCategory, PassThroughRateKind } from '@prisma/client';
import type { LaborRole, LaborTaskDerivation, MaterialItem, ReferenceData } from '@/lib/calc';

export interface EstimateDefaultsData {
  laborMarkupPct: number;
  passThroughMarkupPct: number;
  materialMarkupPct: number;
  corporateMarkupPct: number;
  taxRate: number;
  contingencyPct: number;
}

const CATEGORY_FROM_DB: Record<MaterialCategory, MaterialItem['category']> = {
  Consumable: 'Consumable',
  DAS_Materials: 'DAS Materials',
  BAT_Materials: 'BAT Materials',
};

const ROLE_FROM_DB: Record<LaborRoleName, LaborRole> = {
  Technician: 'Technician',
  Construction_Manager: 'Construction Manager',
  RF_Engineer: 'RF-Engineer',
  RF_Technician: 'RF-Technician',
  Project_Coordinator: 'Project Coordinator',
  Project_Manager: 'Project Manager',
};

function mapRole(role: LaborRoleName): LaborRole {
  const mapped = ROLE_FROM_DB[role];
  if (!mapped) throw new Error(`Unknown labor role from DB: ${role}`);
  return mapped;
}

function parseDerivedFrom(json: unknown, taskKey: string): LaborTaskDerivation | null {
  if (json === null || json === undefined) return null;
  if (
    typeof json !== 'object' ||
    !('terms' in json) ||
    !('divisor' in json) ||
    !Array.isArray((json as { terms: unknown }).terms) ||
    typeof (json as { divisor: unknown }).divisor !== 'number'
  ) {
    throw new Error(`Malformed derivedFromJson for labor task "${taskKey}": ${JSON.stringify(json)}`);
  }
  const rawTerms = (json as { terms: unknown[] }).terms;
  const terms = rawTerms.map((term, i) => {
    if (
      typeof term !== 'object' ||
      term === null ||
      typeof (term as { key: unknown }).key !== 'string' ||
      typeof (term as { coeff: unknown }).coeff !== 'number'
    ) {
      throw new Error(`Malformed derivedFromJson term ${i} for labor task "${taskKey}": ${JSON.stringify(term)}`);
    }
    return { key: (term as { key: string }).key, coeff: (term as { coeff: number }).coeff };
  });
  return { terms, divisor: (json as { divisor: number }).divisor };
}

function mapRoleRate(rows: { role: LaborRoleName; amount: number }[]): { role: LaborRole; rate: number }[] {
  return rows.map((r) => ({ role: mapRole(r.role), rate: r.amount }));
}

export async function loadReferenceData(): Promise<ReferenceData> {
  const [
    materialItemsDb, laborTasksDb, laborRatesDb, crewSizeTableDb, settingsDb,
    perDiemDb, lodgingDb, airfareDb, rentalsDb, softCostsDb,
  ] = await Promise.all([
    prisma.materialItem.findMany(),
    prisma.laborTask.findMany(),
    prisma.laborRate.findMany(),
    prisma.crewSizeRow.findMany(),
    prisma.laborProjectionSettings.findUnique({ where: { id: 'singleton' } }),
    prisma.passThroughRoleRate.findMany({ where: { kind: 'PerDiem' as PassThroughRateKind } }),
    prisma.passThroughRoleRate.findMany({ where: { kind: 'Lodging' as PassThroughRateKind } }),
    prisma.passThroughRoleRate.findMany({ where: { kind: 'Airfare' as PassThroughRateKind } }),
    prisma.rentalRate.findMany(),
    prisma.softCostRate.findMany(),
  ]);

  if (!settingsDb) {
    throw new Error('LaborProjectionSettings singleton row not found — run `npm run seed`.');
  }

  const materialItems: MaterialItem[] = materialItemsDb.map((m) => ({
    key: m.key,
    type: m.type,
    manufacturer: m.manufacturer,
    model: m.model,
    description: m.description,
    vendor: m.vendor,
    category: CATEGORY_FROM_DB[m.category],
    unitCost: m.unitCost,
  }));

  const laborTasks = laborTasksDb.map((t) => ({
    key: t.key,
    sheet: t.sheet,
    category: t.category,
    name: t.name,
    minutesPerUnit: t.minutesPerUnit,
    unit: t.unit,
    laborRole: mapRole(t.laborRole),
    includedInSubtotal: t.includedInSubtotal,
    derivedFrom: parseDerivedFrom(t.derivedFromJson, t.key),
  }));

  const laborRates = laborRatesDb.map((r) => ({
    role: mapRole(r.role),
    hourlyRate: r.hourlyRate,
    rawWageRate: r.rawWageRate,
  }));

  const crewSizeTable = crewSizeTableDb.map((r) => ({
    technicianCount: r.technicianCount,
    cmsNeeded: r.cmsNeeded,
  }));

  return {
    materialItems,
    laborTasks,
    laborRates,
    crewSizeTable,
    laborProjectionSettings: {
      hoursPerManDay: settingsDb.hoursPerManDay,
      hoursPerManWeek: settingsDb.hoursPerManWeek,
      stagingMaterialMultiplier: settingsDb.stagingMaterialMultiplier,
      cmPercentOfTechHours: settingsDb.cmPercentOfTechHours,
      pmPercentOfTechHours: settingsDb.pmPercentOfTechHours,
      coordinatorPercentOfTechHours: settingsDb.coordinatorPercentOfTechHours,
    },
    passThroughRates: {
      perDiemRateByRole: mapRoleRate(perDiemDb),
      lodgingRateByRole: mapRoleRate(lodgingDb),
      airfareCostByRole: airfareDb.map((r) => ({ role: mapRole(r.role), cost: r.amount })),
      rentals: rentalsDb.map((r) => ({ key: r.key, name: r.name, rate: r.rate, unit: r.unit })),
      softCosts: softCostsDb.map((r) => ({ key: r.key, name: r.name, fee: r.fee })),
    },
  };
}

export async function loadEstimateDefaults(): Promise<EstimateDefaultsData> {
  const row = await prisma.estimateDefaults.findUnique({ where: { id: 'singleton' } });
  if (!row) throw new Error('EstimateDefaults singleton row not found — run `npm run seed`.');
  return {
    laborMarkupPct: row.laborMarkupPct,
    passThroughMarkupPct: row.passThroughMarkupPct,
    materialMarkupPct: row.materialMarkupPct,
    corporateMarkupPct: row.corporateMarkupPct,
    taxRate: row.taxRate,
    contingencyPct: row.contingencyPct,
  };
}
```

- [ ] **Step 3: Write the integration test**

```ts
// src/lib/data/loadReferenceData.integration.test.ts
import { describe, it, expect } from 'vitest';
import { loadReferenceData, loadEstimateDefaults } from './loadReferenceData';
import { buildEstimateResult } from '@/lib/calc';

describe('loadReferenceData (integration — requires a live, seeded local Postgres)', () => {
  it('loads real seed data with correct shapes and values', async () => {
    const referenceData = await loadReferenceData();
    expect(referenceData.materialItems.length).toBeGreaterThanOrEqual(80);
    expect(referenceData.laborTasks.length).toBeGreaterThanOrEqual(100);
    expect(referenceData.laborRates).toHaveLength(6);
    expect(referenceData.crewSizeTable).toHaveLength(20);

    const bom3 = referenceData.materialItems.find((m) => m.key === 'bom-3');
    expect(bom3).toMatchObject({ unitCost: 4685, category: 'DAS Materials', manufacturer: 'Vertiv' });

    const rfEngineer = referenceData.laborRates.find((r) => r.role === 'RF-Engineer');
    expect(rfEngineer).toMatchObject({ hourlyRate: 100, rawWageRate: 75 });

    // Proves the derivedFromJson (DB, untyped Json) -> derivedFrom (engine, typed) mapping round-trips correctly.
    const loe25 = referenceData.laborTasks.find((t) => t.key === 'loe-25');
    expect(loe25?.derivedFrom).toEqual({
      terms: [
        { key: 'loe-21', coeff: 1 },
        { key: 'loe-22', coeff: 1 },
        { key: 'loe-23', coeff: 1 },
        { key: 'loe-24', coeff: 1 },
        { key: 'loe-31', coeff: 1 },
      ],
      divisor: 1,
    });

    const loe21 = referenceData.laborTasks.find((t) => t.key === 'loe-21');
    expect(loe21?.derivedFrom).toBeNull();

    const crew4 = referenceData.crewSizeTable.find((c) => c.technicianCount === 4);
    expect(crew4?.cmsNeeded).toBe(1);
  });

  it('loads estimate defaults', async () => {
    const defaults = await loadEstimateDefaults();
    expect(defaults).toEqual({
      laborMarkupPct: 0.25,
      passThroughMarkupPct: 0.25,
      materialMarkupPct: 0.25,
      corporateMarkupPct: 0.05,
      taxRate: 0.0825,
      contingencyPct: 0.10,
    });
  });

  it('runs buildEstimateResult against real seed data end to end (golden scenario)', async () => {
    const referenceData = await loadReferenceData();
    const defaults = await loadEstimateDefaults();

    const result = buildEstimateResult(
      {
        materials: [
          { key: 'bom-3', quantity: 2 }, // Vertiv DC Power Plant, $4685, DAS Materials
          { key: 'bom-65', quantity: 100 }, // 3/8 x 1 bolts, $1, Consumable
        ],
        contingencyPct: defaults.contingencyPct,
        shippingHandling: 200,
        loeTasks: [
          { key: 'loe-21', quantity: 4 },
          { key: 'loe-22', quantity: 2 },
          { key: 'loe-31', quantity: 10 },
        ],
        sowTasks: [],
        technicianCount: 4,
        passThroughs: {
          perDiem: [{ role: 'Technician', employeeCount: 2, days: 3 }],
          lodging: [],
          travel: [],
          airfare: [],
          rentals: [],
          softCosts: [],
        },
        markups: {
          laborMarkupPct: defaults.laborMarkupPct,
          passThroughMarkupPct: defaults.passThroughMarkupPct,
          materialMarkupPct: defaults.materialMarkupPct,
          corporateMarkupPct: defaults.corporateMarkupPct,
          marginTweak: 0,
          taxRate: defaults.taxRate,
        },
      },
      referenceData,
    );

    // Hand-computed: (4685*2=9370 DAS Materials) + (1*100=100 Consumable) = 9470 category sum;
    // + 10% contingency (947) + 200 S&H = 10617. This is independently verifiable by hand and
    // catches any material-item mapping bug in the loader.
    expect(result.materials.hardwareTotal).toBeCloseTo(10617, 6);
    expect(result.executiveSummary.totalMaterialCost).toBeCloseTo(10617, 6);

    // The full labor/crew/pass-through/executive-summary formula chain is already exhaustively
    // unit-tested in Plan 1 against hand-built fixtures — these structural checks confirm the
    // *real, seeded* data flows through that already-correct chain without a plumbing regression,
    // not re-derive the formulas a third time.
    expect(result.crewPlan.cmsNeeded).toBe(1);
    expect(result.labor.grandHours).toBeGreaterThan(0);
    expect(result.executiveSummary.grandTotalToBidTaxExempt).toBeCloseTo(
      result.executiveSummary.projectedNetMarginTotal, 6,
    );
    expect(result.executiveSummary.grandTotalToBidTaxIncluded).toBeGreaterThan(
      result.executiveSummary.grandTotalToBidTaxExempt,
    );
  });
});
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/lib/data/loadReferenceData.integration.test.ts`
Expected: PASS (3 tests). If it fails with a connection error, re-check Step 1.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/data/
git commit -m "Add reference-data loader with derivedFromJson mapping and real-seed-data integration test"
```

---

### Task 2: Estimate state management (EstimateContext)

**Files:**
- Create: `src/lib/estimate/upsertLine.ts`
- Test: `src/lib/estimate/upsertLine.test.ts`
- Create: `src/lib/estimate/EstimateContext.tsx`
- Test: `src/lib/estimate/EstimateContext.test.tsx`
- Modify: `package.json` (add `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`)
- Modify: `vitest.config.ts` (add `setupFiles`)
- Create: `vitest.setup.ts`

**Interfaces:**
- Consumes: `EstimateInput`, `EstimateResult`, `ReferenceData`, `MaterialLineInput`, `LaborTaskLineInput`, `PassThroughInput`, `MarkupInputs`, `buildEstimateResult` from `@/lib/calc` (Plan 1); `EstimateDefaultsData` from Task 1.
- Produces: `CoverInfo` interface, `EstimateProvider` component, `useEstimate()` hook returning `{ referenceData, coverInfo, setCoverInfo, input, result, setMaterialQuantity, setContingencyPct, setShippingHandling, setLoeTaskQuantity, setSowTaskQuantity, setTechnicianCount, setPassThroughs, setMarkups }` — used by every page task (3–8).

- [ ] **Step 1: Add component-testing dependencies**

Add to `package.json`'s `devDependencies`:
```json
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.4.8",
    "jsdom": "^24.1.1"
```

Run: `npm install`
Expected: installs without error.

- [ ] **Step 2: Add the Vitest setup file**

```ts
// vitest.setup.ts
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
```

*Note: the `afterEach(cleanup)` is required because this project doesn't enable Vitest's `globals` option — without it, Testing Library doesn't auto-unmount between tests and component tests collide (duplicate rendered elements).*

- [ ] **Step 3: Wire the setup file into Vitest config**

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  esbuild: {
    jsx: 'automatic',
  },
});
```

*Note: `esbuild.jsx: 'automatic'` is required for `.tsx` test files — Vitest's esbuild pipeline doesn't read `tsconfig.json`'s `jsx: "preserve"`, so without this JSX in tests fails with `React is not defined`.*

- [ ] **Step 4: Write the failing test for `upsertLine`**

```ts
// src/lib/estimate/upsertLine.test.ts
import { describe, it, expect } from 'vitest';
import { upsertLine } from './upsertLine';

describe('upsertLine', () => {
  it('adds a new line when the key is not present', () => {
    const result = upsertLine([{ key: 'a', quantity: 1 }], 'b', 5);
    expect(result).toEqual([{ key: 'a', quantity: 1 }, { key: 'b', quantity: 5 }]);
  });

  it('updates the quantity of an existing line without duplicating it', () => {
    const result = upsertLine([{ key: 'a', quantity: 1 }, { key: 'b', quantity: 2 }], 'a', 9);
    expect(result).toEqual([{ key: 'a', quantity: 9 }, { key: 'b', quantity: 2 }]);
  });

  it('does not mutate the input array', () => {
    const input = [{ key: 'a', quantity: 1 }];
    upsertLine(input, 'a', 9);
    expect(input).toEqual([{ key: 'a', quantity: 1 }]);
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `npx vitest run src/lib/estimate/upsertLine.test.ts`
Expected: FAIL — `Cannot find module './upsertLine'`

- [ ] **Step 6: Implement `upsertLine`**

```ts
// src/lib/estimate/upsertLine.ts
export function upsertLine<T extends { key: string; quantity: number }>(
  lines: T[],
  key: string,
  quantity: number,
): T[] {
  const existing = lines.find((l) => l.key === key);
  if (!existing) return [...lines, { key, quantity } as T];
  return lines.map((l) => (l.key === key ? { ...l, quantity } : l));
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npx vitest run src/lib/estimate/upsertLine.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 8: Write the EstimateContext**

```tsx
// src/lib/estimate/EstimateContext.tsx
'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { buildEstimateResult } from '@/lib/calc';
import type {
  EstimateInput, EstimateResult, LaborTaskLineInput, MarkupInputs,
  MaterialLineInput, PassThroughInput, ReferenceData,
} from '@/lib/calc';
import type { EstimateDefaultsData } from '@/lib/data/loadReferenceData';
import { upsertLine } from './upsertLine';

export interface CoverInfo {
  client: string;
  project: string;
  rfpDate: string;
  bidDueDate: string;
  estimator: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  customerType: string;
  jobSiteAddress: string;
  projectOverview: string;
}

const EMPTY_COVER_INFO: CoverInfo = {
  client: '', project: '', rfpDate: '', bidDueDate: '', estimator: '',
  contactName: '', contactPhone: '', contactEmail: '', customerType: '',
  jobSiteAddress: '', projectOverview: '',
};

interface EstimateContextValue {
  referenceData: ReferenceData;
  coverInfo: CoverInfo;
  setCoverInfo: (patch: Partial<CoverInfo>) => void;
  input: EstimateInput;
  result: EstimateResult;
  setMaterialQuantity: (key: string, quantity: number) => void;
  setContingencyPct: (pct: number) => void;
  setShippingHandling: (amount: number) => void;
  setLoeTaskQuantity: (key: string, quantity: number) => void;
  setSowTaskQuantity: (key: string, quantity: number) => void;
  setTechnicianCount: (count: number) => void;
  setPassThroughs: (patch: Partial<PassThroughInput>) => void;
  setMarkups: (patch: Partial<MarkupInputs>) => void;
}

const EstimateContext = createContext<EstimateContextValue | null>(null);

export function EstimateProvider({
  referenceData,
  estimateDefaults,
  children,
}: {
  referenceData: ReferenceData;
  estimateDefaults: EstimateDefaultsData;
  children: ReactNode;
}) {
  const [coverInfo, setCoverInfoState] = useState<CoverInfo>(EMPTY_COVER_INFO);
  const [materials, setMaterials] = useState<MaterialLineInput[]>([]);
  const [contingencyPct, setContingencyPct] = useState(estimateDefaults.contingencyPct);
  const [shippingHandling, setShippingHandling] = useState(0);
  const [loeTasks, setLoeTasks] = useState<LaborTaskLineInput[]>([]);
  const [sowTasks, setSowTasks] = useState<LaborTaskLineInput[]>([]);
  const [technicianCount, setTechnicianCount] = useState(4);
  const [passThroughs, setPassThroughsState] = useState<PassThroughInput>({
    perDiem: [], lodging: [], travel: [], airfare: [], rentals: [], softCosts: [],
  });
  const [markups, setMarkupsState] = useState<MarkupInputs>({
    laborMarkupPct: estimateDefaults.laborMarkupPct,
    passThroughMarkupPct: estimateDefaults.passThroughMarkupPct,
    materialMarkupPct: estimateDefaults.materialMarkupPct,
    corporateMarkupPct: estimateDefaults.corporateMarkupPct,
    marginTweak: 0,
    taxRate: estimateDefaults.taxRate,
  });

  const input: EstimateInput = useMemo(
    () => ({ materials, contingencyPct, shippingHandling, loeTasks, sowTasks, technicianCount, passThroughs, markups }),
    [materials, contingencyPct, shippingHandling, loeTasks, sowTasks, technicianCount, passThroughs, markups],
  );

  const result = useMemo(() => buildEstimateResult(input, referenceData), [input, referenceData]);

  const value: EstimateContextValue = {
    referenceData,
    coverInfo,
    setCoverInfo: (patch) => setCoverInfoState((prev) => ({ ...prev, ...patch })),
    input,
    result,
    setMaterialQuantity: (key, quantity) => setMaterials((prev) => upsertLine(prev, key, quantity)),
    setContingencyPct,
    setShippingHandling,
    setLoeTaskQuantity: (key, quantity) => setLoeTasks((prev) => upsertLine(prev, key, quantity)),
    setSowTaskQuantity: (key, quantity) => setSowTasks((prev) => upsertLine(prev, key, quantity)),
    setTechnicianCount,
    setPassThroughs: (patch) => setPassThroughsState((prev) => ({ ...prev, ...patch })),
    setMarkups: (patch) => setMarkupsState((prev) => ({ ...prev, ...patch })),
  };

  return <EstimateContext.Provider value={value}>{children}</EstimateContext.Provider>;
}

export function useEstimate(): EstimateContextValue {
  const ctx = useContext(EstimateContext);
  if (!ctx) throw new Error('useEstimate must be used within an EstimateProvider');
  return ctx;
}
```

- [ ] **Step 9: Write a component test for the provider/hook**

```tsx
// src/lib/estimate/EstimateContext.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EstimateProvider, useEstimate } from './EstimateContext';
import type { ReferenceData } from '@/lib/calc';

const referenceData: ReferenceData = {
  materialItems: [
    { key: 'bom-3', type: 'DC Power Plant', manufacturer: 'Vertiv', model: '582137200', description: 'NetSure 5100', vendor: 'Anixter', category: 'DAS Materials', unitCost: 4685 },
  ],
  laborTasks: [],
  laborRates: [
    { role: 'Technician', hourlyRate: 85, rawWageRate: 85 },
    { role: 'Construction Manager', hourlyRate: 95, rawWageRate: 95 },
    { role: 'RF-Engineer', hourlyRate: 100, rawWageRate: 75 },
    { role: 'RF-Technician', hourlyRate: 75, rawWageRate: 75 },
    { role: 'Project Coordinator', hourlyRate: 55, rawWageRate: 55 },
    { role: 'Project Manager', hourlyRate: 100, rawWageRate: 100 },
  ],
  crewSizeTable: [{ technicianCount: 4, cmsNeeded: 1 }],
  laborProjectionSettings: {
    hoursPerManDay: 8, hoursPerManWeek: 40, stagingMaterialMultiplier: 0.05,
    cmPercentOfTechHours: 0.5, pmPercentOfTechHours: 0.25, coordinatorPercentOfTechHours: 0.15,
  },
  passThroughRates: {
    perDiemRateByRole: [], lodgingRateByRole: [], airfareCostByRole: [], rentals: [], softCosts: [],
  },
};

const estimateDefaults = {
  laborMarkupPct: 0.25, passThroughMarkupPct: 0.25, materialMarkupPct: 0.25,
  corporateMarkupPct: 0.05, taxRate: 0.0825, contingencyPct: 0.10,
};

function TestConsumer() {
  const { result, setMaterialQuantity, coverInfo, setCoverInfo } = useEstimate();
  return (
    <div>
      <div data-testid="hardware-total">{result.materials.hardwareTotal}</div>
      <div data-testid="client-name">{coverInfo.client}</div>
      <button onClick={() => setMaterialQuantity('bom-3', 2)}>Set Qty</button>
      <button onClick={() => setCoverInfo({ client: 'Acme Corp' })}>Set Client</button>
    </div>
  );
}

describe('EstimateProvider / useEstimate', () => {
  it('recomputes the result when a material quantity is set', () => {
    render(
      <EstimateProvider referenceData={referenceData} estimateDefaults={estimateDefaults}>
        <TestConsumer />
      </EstimateProvider>,
    );

    expect(screen.getByTestId('hardware-total').textContent).toBe('0');
    fireEvent.click(screen.getByText('Set Qty'));
    // 4685 * 2 = 9370, +10% contingency (937) = 10307
    expect(screen.getByTestId('hardware-total').textContent).toBe('10307');
  });

  it('updates cover info independently of the estimate calculation', () => {
    render(
      <EstimateProvider referenceData={referenceData} estimateDefaults={estimateDefaults}>
        <TestConsumer />
      </EstimateProvider>,
    );

    fireEvent.click(screen.getByText('Set Client'));
    expect(screen.getByTestId('client-name').textContent).toBe('Acme Corp');
  });
});
```

- [ ] **Step 10: Run the tests**

Run: `npx vitest run src/lib/estimate/`
Expected: PASS (5 tests across `upsertLine.test.ts` and `EstimateContext.test.tsx`)

- [ ] **Step 11: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 12: Commit**

```bash
git add package.json package-lock.json vitest.config.ts vitest.setup.ts src/lib/estimate/
git commit -m "Add EstimateContext for estimate state management with component test tooling"
```

---

### Task 3: App shell — sidebar, summary strip, root layout

**Files:**
- Create: `src/lib/utils/formatCurrency.ts`
- Test: `src/lib/utils/formatCurrency.test.ts`
- Create: `src/components/Sidebar.tsx`
- Create: `src/components/SummaryStrip.tsx`
- Test: `src/components/SummaryStrip.test.tsx`
- Create: `src/components/AppShell.tsx`
- Create: `src/components/MoveToButton.tsx`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: `useEstimate` from Task 2; `loadReferenceData`, `loadEstimateDefaults` from Task 1.
- Produces: `formatCurrency(n: number): string`; `<AppShell>` (wraps sidebar + summary strip + page content); `<MoveToButton href label>` — used by every page task (4–8).

- [ ] **Step 1: Write the failing test for `formatCurrency`**

```ts
// src/lib/utils/formatCurrency.test.ts
import { describe, it, expect } from 'vitest';
import { formatCurrency } from './formatCurrency';

describe('formatCurrency', () => {
  it('formats a positive number as USD with no decimals for whole dollars', () => {
    expect(formatCurrency(10617)).toBe('$10,617');
  });

  it('formats a number with cents', () => {
    expect(formatCurrency(255063.05)).toBe('$255,063.05');
  });

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/utils/formatCurrency.test.ts`
Expected: FAIL — `Cannot find module './formatCurrency'`

- [ ] **Step 3: Implement `formatCurrency`**

```ts
// src/lib/utils/formatCurrency.ts
export function formatCurrency(amount: number): string {
  const hasCents = Math.round(amount * 100) % 100 !== 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  }).format(amount);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/utils/formatCurrency.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Write the Sidebar component**

```tsx
// src/components/Sidebar.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';

const NAV_ITEMS = [
  { href: '/', label: 'Cover Info' },
  { href: '/materials', label: 'Materials' },
  { href: '/labor', label: 'Labor' },
  { href: '/pass-throughs', label: 'Pass Throughs' },
  { href: '/summary', label: 'Executive Summary' },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        'flex flex-col bg-navy text-white transition-all duration-200',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center justify-center h-12 border-b border-white/10 hover:bg-navy-2"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? '»' : '« Collapse'}
      </button>
      <ul className="flex-1 py-2">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  'block px-4 py-3 text-sm font-body transition-colors',
                  active ? 'bg-navy-2 border-l-4 border-red text-white' : 'text-white/70 hover:bg-navy-2 hover:text-white',
                )}
                title={collapsed ? item.label : undefined}
              >
                {collapsed ? item.label.charAt(0) : item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
```

- [ ] **Step 6: Write the SummaryStrip component**

```tsx
// src/components/SummaryStrip.tsx
'use client';

import { useEstimate } from '@/lib/estimate/EstimateContext';
import { formatCurrency } from '@/lib/utils/formatCurrency';

export function SummaryStrip() {
  const { result } = useEstimate();
  const es = result.executiveSummary;

  return (
    <div className="flex items-center gap-8 bg-navy-deep text-white px-6 py-3 text-sm font-body sticky top-0 z-10">
      <span>
        Materials: <strong className="font-display">{formatCurrency(es.totalMaterialBilled)}</strong>
      </span>
      <span>
        Labor: <strong className="font-display">{formatCurrency(es.totalProjectLaborBilled)}</strong>
      </span>
      <span>
        Pass Throughs: <strong className="font-display">{formatCurrency(es.totalPassThroughBilled)}</strong>
      </span>
      <span className="ml-auto">
        Grand Total to Bid: <strong className="font-display text-red text-base">{formatCurrency(es.grandTotalToBidTaxIncluded)}</strong>
      </span>
    </div>
  );
}
```

- [ ] **Step 7: Write a component test for SummaryStrip**

```tsx
// src/components/SummaryStrip.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EstimateProvider } from '@/lib/estimate/EstimateContext';
import { SummaryStrip } from './SummaryStrip';
import type { ReferenceData } from '@/lib/calc';

const referenceData: ReferenceData = {
  materialItems: [
    { key: 'bom-3', type: 'DC Power Plant', manufacturer: 'Vertiv', model: '582137200', description: 'NetSure 5100', vendor: 'Anixter', category: 'DAS Materials', unitCost: 4685 },
  ],
  laborTasks: [],
  laborRates: [
    { role: 'Technician', hourlyRate: 85, rawWageRate: 85 },
    { role: 'Construction Manager', hourlyRate: 95, rawWageRate: 95 },
    { role: 'RF-Engineer', hourlyRate: 100, rawWageRate: 75 },
    { role: 'RF-Technician', hourlyRate: 75, rawWageRate: 75 },
    { role: 'Project Coordinator', hourlyRate: 55, rawWageRate: 55 },
    { role: 'Project Manager', hourlyRate: 100, rawWageRate: 100 },
  ],
  crewSizeTable: [{ technicianCount: 4, cmsNeeded: 1 }],
  laborProjectionSettings: {
    hoursPerManDay: 8, hoursPerManWeek: 40, stagingMaterialMultiplier: 0.05,
    cmPercentOfTechHours: 0.5, pmPercentOfTechHours: 0.25, coordinatorPercentOfTechHours: 0.15,
  },
  passThroughRates: {
    perDiemRateByRole: [], lodgingRateByRole: [], airfareCostByRole: [], rentals: [], softCosts: [],
  },
};

const estimateDefaults = {
  laborMarkupPct: 0.25, passThroughMarkupPct: 0.25, materialMarkupPct: 0.25,
  corporateMarkupPct: 0.05, taxRate: 0.0825, contingencyPct: 0.10,
};

describe('SummaryStrip', () => {
  it('renders zeroed totals for an empty estimate', () => {
    render(
      <EstimateProvider referenceData={referenceData} estimateDefaults={estimateDefaults}>
        <SummaryStrip />
      </EstimateProvider>,
    );
    expect(screen.getByText('Materials:').parentElement?.textContent).toContain('$0');
    expect(screen.getByText('Grand Total to Bid:').parentElement?.textContent).toContain('$0');
  });
});
```

- [ ] **Step 8: Write the MoveToButton component**

```tsx
// src/components/MoveToButton.tsx
import Link from 'next/link';

export function MoveToButton({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-block bg-red hover:bg-red-700 text-white font-display font-semibold px-6 py-3 rounded transition-colors"
    >
      {label}
    </Link>
  );
}
```

- [ ] **Step 9: Write the AppShell component**

```tsx
// src/components/AppShell.tsx
import { Sidebar } from './Sidebar';
import { SummaryStrip } from './SummaryStrip';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-mist">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <SummaryStrip />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 10: Wire the shell and provider into the root layout**

```tsx
// src/app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';
import { loadReferenceData, loadEstimateDefaults } from '@/lib/data/loadReferenceData';
import { EstimateProvider } from '@/lib/estimate/EstimateContext';
import { AppShell } from '@/components/AppShell';

export const metadata: Metadata = {
  title: 'DAS Bid Estimator',
  description: 'AmeriCloud DAS construction bid estimator',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [referenceData, estimateDefaults] = await Promise.all([
    loadReferenceData(),
    loadEstimateDefaults(),
  ]);

  return (
    <html lang="en">
      <body>
        <EstimateProvider referenceData={referenceData} estimateDefaults={estimateDefaults}>
          <AppShell>{children}</AppShell>
        </EstimateProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 11: Run tests and build**

Run: `npx vitest run`
Expected: all test files pass, including the new `formatCurrency.test.ts` and `SummaryStrip.test.tsx`.

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds (this exercises the root layout's server-side Prisma fetch — requires the local Postgres from Task 1 to be running and seeded).

- [ ] **Step 12: Commit**

```bash
git add src/lib/utils/formatCurrency.ts src/lib/utils/formatCurrency.test.ts src/components/ src/app/layout.tsx
git commit -m "Add app shell: sidebar, sticky summary strip, and root layout wiring"
```

---

### Task 4: Cover Info page

**Files:**
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `useEstimate` (Task 2), `MoveToButton` (Task 3).

- [ ] **Step 1: Replace the placeholder home page with the Cover Info form**

```tsx
// src/app/page.tsx
'use client';

import { useEstimate } from '@/lib/estimate/EstimateContext';
import { MoveToButton } from '@/components/MoveToButton';

const CUSTOMER_TYPES = ['Direct Customer', 'General Contractor', 'Sub/Tier'];

export default function CoverInfoPage() {
  const { coverInfo, setCoverInfo } = useEstimate();

  return (
    <div className="max-w-3xl mx-auto bg-white rounded-lg shadow p-8">
      <h1 className="font-display text-2xl text-navy mb-6">Cover Info</h1>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-slate">Client</span>
          <input
            className="border border-line rounded px-3 py-2"
            value={coverInfo.client}
            onChange={(e) => setCoverInfo({ client: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-slate">Project</span>
          <input
            className="border border-line rounded px-3 py-2"
            value={coverInfo.project}
            onChange={(e) => setCoverInfo({ project: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-slate">RFP Received Date</span>
          <input
            type="date"
            className="border border-line rounded px-3 py-2"
            value={coverInfo.rfpDate}
            onChange={(e) => setCoverInfo({ rfpDate: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-slate">Bid Due Date</span>
          <input
            type="date"
            className="border border-line rounded px-3 py-2"
            value={coverInfo.bidDueDate}
            onChange={(e) => setCoverInfo({ bidDueDate: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-slate">Estimated By</span>
          <input
            className="border border-line rounded px-3 py-2"
            value={coverInfo.estimator}
            onChange={(e) => setCoverInfo({ estimator: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-slate">Customer Type</span>
          <select
            className="border border-line rounded px-3 py-2"
            value={coverInfo.customerType}
            onChange={(e) => setCoverInfo({ customerType: e.target.value })}
          >
            <option value="">Select…</option>
            {CUSTOMER_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-slate">Customer Contact Name</span>
          <input
            className="border border-line rounded px-3 py-2"
            value={coverInfo.contactName}
            onChange={(e) => setCoverInfo({ contactName: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-slate">Phone</span>
          <input
            className="border border-line rounded px-3 py-2"
            value={coverInfo.contactPhone}
            onChange={(e) => setCoverInfo({ contactPhone: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-slate">Email</span>
          <input
            className="border border-line rounded px-3 py-2"
            value={coverInfo.contactEmail}
            onChange={(e) => setCoverInfo({ contactEmail: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1 col-span-2">
          <span className="text-sm text-slate">Job Site Address</span>
          <input
            className="border border-line rounded px-3 py-2"
            value={coverInfo.jobSiteAddress}
            onChange={(e) => setCoverInfo({ jobSiteAddress: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1 col-span-2">
          <span className="text-sm text-slate">Project Overview</span>
          <textarea
            className="border border-line rounded px-3 py-2"
            rows={4}
            value={coverInfo.projectOverview}
            onChange={(e) => setCoverInfo({ projectOverview: e.target.value })}
          />
        </label>
      </div>

      <div className="mt-8">
        <MoveToButton href="/materials" label="→ Materials" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the app builds and dev server renders the page**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "Add Cover Info page"
```

---

### Task 5: Materials page

**Files:**
- Create: `src/app/materials/page.tsx`

**Interfaces:**
- Consumes: `useEstimate` (Task 2), `MoveToButton`, `formatCurrency` (Task 3).

- [ ] **Step 1: Write the Materials page**

```tsx
// src/app/materials/page.tsx
'use client';

import { useEstimate } from '@/lib/estimate/EstimateContext';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { MoveToButton } from '@/components/MoveToButton';
import type { MaterialCategory } from '@/lib/calc';

const CATEGORIES: MaterialCategory[] = ['Consumable', 'DAS Materials', 'BAT Materials'];

export default function MaterialsPage() {
  const { referenceData, input, result, setMaterialQuantity, setContingencyPct, setShippingHandling } = useEstimate();

  const qtyByKey = new Map(input.materials.map((m) => [m.key, m.quantity]));
  const lineByKey = new Map(result.materials.lines.map((l) => [l.key, l]));

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl text-navy">Materials</h1>

      {CATEGORIES.map((category) => {
        const items = referenceData.materialItems.filter((m) => m.category === category);
        if (items.length === 0) return null;
        const categoryTotal = result.materials.categoryTotals.find((c) => c.category === category)?.total ?? 0;

        return (
          <div key={category} className="bg-white rounded-lg shadow overflow-hidden">
            <div className="bg-navy-2 text-white px-4 py-2 font-display flex justify-between">
              <span>{category}</span>
              <span>{formatCurrency(categoryTotal)}</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-slate">
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2">Manufacturer / Model</th>
                  <th className="px-4 py-2">Description</th>
                  <th className="px-4 py-2 text-right">Unit Cost</th>
                  <th className="px-4 py-2 text-right">Qty</th>
                  <th className="px-4 py-2 text-right">Ext Cost</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={item.key} className={i % 2 === 0 ? 'bg-white' : 'bg-mist'}>
                    <td className="px-4 py-2">{item.type}</td>
                    <td className="px-4 py-2">{[item.manufacturer, item.model].filter(Boolean).join(' / ')}</td>
                    <td className="px-4 py-2">{item.description}</td>
                    <td className="px-4 py-2 text-right">{formatCurrency(item.unitCost)}</td>
                    <td className="px-4 py-2 text-right">
                      <input
                        type="number"
                        min={0}
                        className="w-20 border border-line rounded px-2 py-1 text-right"
                        value={qtyByKey.get(item.key) ?? 0}
                        onChange={(e) => setMaterialQuantity(item.key, Number(e.target.value))}
                      />
                    </td>
                    <td className="px-4 py-2 text-right">{formatCurrency(lineByKey.get(item.key)?.extCost ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}

      <div className="bg-white rounded-lg shadow p-4 space-y-2">
        <div className="flex justify-between items-center">
          <label className="flex items-center gap-2">
            <span className="text-slate">Contingency %</span>
            <input
              type="number"
              min={0}
              max={100}
              step={0.1}
              className="w-20 border border-line rounded px-2 py-1 text-right"
              value={input.contingencyPct * 100}
              onChange={(e) => setContingencyPct(Number(e.target.value) / 100)}
            />
          </label>
          <span>{formatCurrency(result.materials.contingency)}</span>
        </div>
        <div className="flex justify-between items-center">
          <label className="flex items-center gap-2">
            <span className="text-slate">Estimated S&H</span>
            <input
              type="number"
              min={0}
              className="w-28 border border-line rounded px-2 py-1 text-right"
              value={input.shippingHandling}
              onChange={(e) => setShippingHandling(Number(e.target.value))}
            />
          </label>
        </div>
        <div className="flex justify-between items-center font-display text-lg text-navy border-t border-line pt-2">
          <span>Hardware Total</span>
          <span>{formatCurrency(result.materials.hardwareTotal)}</span>
        </div>
      </div>

      <MoveToButton href="/labor" label="→ Labor" />
    </div>
  );
}
```

- [ ] **Step 2: Verify the app builds**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/materials/
git commit -m "Add Materials page"
```

---

### Task 6: Labor page (LOE + Additional SOW's + Crew Planner)

**Files:**
- Create: `src/app/labor/page.tsx`

**Interfaces:**
- Consumes: `useEstimate` (Task 2), `MoveToButton`, `formatCurrency` (Task 3).

- [ ] **Step 1: Write the Labor page**

```tsx
// src/app/labor/page.tsx
'use client';

import { useState } from 'react';
import { useEstimate } from '@/lib/estimate/EstimateContext';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { MoveToButton } from '@/components/MoveToButton';
import type { LaborTask } from '@/lib/calc';

function groupByCategory(tasks: LaborTask[]): Map<string, LaborTask[]> {
  const groups = new Map<string, LaborTask[]>();
  for (const task of tasks) {
    const list = groups.get(task.category) ?? [];
    list.push(task);
    groups.set(task.category, list);
  }
  return groups;
}

export default function LaborPage() {
  const {
    referenceData, input, result, setLoeTaskQuantity, setSowTaskQuantity, setTechnicianCount,
  } = useEstimate();
  const [activeSheet, setActiveSheet] = useState<'LOE' | 'SOW'>('LOE');

  const loeTasks = referenceData.laborTasks.filter((t) => t.sheet === 'LOE');
  const sowTasks = referenceData.laborTasks.filter((t) => t.sheet === 'SOW');
  const tasksForSheet = activeSheet === 'LOE' ? loeTasks : sowTasks;
  const groups = groupByCategory(tasksForSheet);

  const loeQtyByKey = new Map(input.loeTasks.map((t) => [t.key, t.quantity]));
  const sowQtyByKey = new Map(input.sowTasks.map((t) => [t.key, t.quantity]));
  const taskResultByKey = new Map(result.labor.taskResults.map((t) => [t.key, t]));
  const setQuantity = activeSheet === 'LOE' ? setLoeTaskQuantity : setSowTaskQuantity;
  const qtyByKey = activeSheet === 'LOE' ? loeQtyByKey : sowQtyByKey;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl text-navy">Labor</h1>

      <div className="flex gap-2">
        <button
          className={`px-4 py-2 rounded font-display ${activeSheet === 'LOE' ? 'bg-navy text-white' : 'bg-white text-navy border border-line'}`}
          onClick={() => setActiveSheet('LOE')}
        >
          LOE
        </button>
        <button
          className={`px-4 py-2 rounded font-display ${activeSheet === 'SOW' ? 'bg-navy text-white' : 'bg-white text-navy border border-line'}`}
          onClick={() => setActiveSheet('SOW')}
        >
          Additional SOW's
        </button>
      </div>

      {Array.from(groups.entries()).map(([category, tasks]) => {
        const subtotal = result.labor.categorySubtotals.find(
          (c) => c.sheet === activeSheet && c.category === category,
        );
        return (
          <div key={category} className="bg-white rounded-lg shadow overflow-hidden">
            <div className="bg-navy-2 text-white px-4 py-2 font-display flex justify-between">
              <span>{category}</span>
              <span>{formatCurrency(subtotal?.cost ?? 0)}</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-slate">
                  <th className="px-4 py-2">Task</th>
                  <th className="px-4 py-2">Unit</th>
                  <th className="px-4 py-2">Labor Role</th>
                  <th className="px-4 py-2 text-right">Qty</th>
                  <th className="px-4 py-2 text-right">Hours</th>
                  <th className="px-4 py-2 text-right">Cost</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task, i) => {
                  const taskResult = taskResultByKey.get(task.key);
                  const isDerived = task.derivedFrom !== null;
                  return (
                    <tr key={task.key} className={i % 2 === 0 ? 'bg-white' : 'bg-mist'}>
                      <td className="px-4 py-2">{task.name}</td>
                      <td className="px-4 py-2">{task.unit}</td>
                      <td className="px-4 py-2">{task.laborRole}</td>
                      <td className="px-4 py-2 text-right">
                        {isDerived ? (
                          <span
                            className="inline-block w-20 text-slate-2 italic"
                            title="Computed automatically from other task quantities"
                          >
                            {taskResult?.quantity.toFixed(2) ?? 0}
                          </span>
                        ) : (
                          <input
                            type="number"
                            min={0}
                            className="w-20 border border-line rounded px-2 py-1 text-right"
                            value={qtyByKey.get(task.key) ?? 0}
                            onChange={(e) => setQuantity(task.key, Number(e.target.value))}
                          />
                        )}
                      </td>
                      <td className="px-4 py-2 text-right">{(taskResult?.hours ?? 0).toFixed(2)}</td>
                      <td className="px-4 py-2 text-right">{formatCurrency(taskResult?.cost ?? 0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}

      <div className="bg-white rounded-lg shadow p-4 space-y-3">
        <h2 className="font-display text-lg text-navy">Crew Planner</h2>
        <label className="flex items-center gap-3">
          <span className="text-slate">Technicians Needed</span>
          <select
            className="border border-line rounded px-3 py-2"
            value={input.technicianCount}
            onChange={(e) => setTechnicianCount(Number(e.target.value))}
          >
            {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
          <div className="flex justify-between"><span className="text-slate">Calendar Days</span><span>{result.crewPlan.calendarDays.toFixed(1)}</span></div>
          <div className="flex justify-between"><span className="text-slate">Calendar Weeks</span><span>{result.crewPlan.calendarWeeks.toFixed(1)}</span></div>
          <div className="flex justify-between"><span className="text-slate">Construction Managers Needed</span><span>{result.crewPlan.cmsNeeded}</span></div>
          <div className="flex justify-between"><span className="text-slate">Admin Labor Cost</span><span>{formatCurrency(result.crewPlan.opsAdminLaborTotal.cost)}</span></div>
        </div>
      </div>

      <MoveToButton href="/pass-throughs" label="→ Pass Throughs" />
    </div>
  );
}
```

- [ ] **Step 2: Verify the app builds**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/labor/
git commit -m "Add Labor page with LOE/SOW tabs and crew planner"
```

---

### Task 7: Pass Throughs page

**Files:**
- Create: `src/app/pass-throughs/page.tsx`

**Interfaces:**
- Consumes: `useEstimate` (Task 2), `MoveToButton`, `formatCurrency` (Task 3).

- [ ] **Step 1: Write the Pass Throughs page**

```tsx
// src/app/pass-throughs/page.tsx
'use client';

import { useEstimate } from '@/lib/estimate/EstimateContext';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { MoveToButton } from '@/components/MoveToButton';
import type { LaborRole } from '@/lib/calc';

function updateRoleDaysLine(
  lines: { role: LaborRole; employeeCount: number; days: number }[],
  role: LaborRole,
  patch: Partial<{ employeeCount: number; days: number }>,
) {
  const existing = lines.find((l) => l.role === role);
  const base = existing ?? { role, employeeCount: 0, days: 0 };
  const updated = { ...base, ...patch };
  if (!existing) return [...lines, updated];
  return lines.map((l) => (l.role === role ? updated : l));
}

function updateRoleHoursLine(
  lines: { role: LaborRole; employeeCount: number; hours: number }[],
  role: LaborRole,
  patch: Partial<{ employeeCount: number; hours: number }>,
) {
  const existing = lines.find((l) => l.role === role);
  const base = existing ?? { role, employeeCount: 0, hours: 0 };
  const updated = { ...base, ...patch };
  if (!existing) return [...lines, updated];
  return lines.map((l) => (l.role === role ? updated : l));
}

function updateRoleQtyLine(
  lines: { role: LaborRole; qty: number }[],
  role: LaborRole,
  qty: number,
) {
  const existing = lines.find((l) => l.role === role);
  if (!existing) return [...lines, { role, qty }];
  return lines.map((l) => (l.role === role ? { role, qty } : l));
}

function updateKeyQtyLine(lines: { key: string; qty: number }[], key: string, qty: number) {
  const existing = lines.find((l) => l.key === key);
  if (!existing) return [...lines, { key, qty }];
  return lines.map((l) => (l.key === key ? { key, qty } : l));
}

export default function PassThroughsPage() {
  const { referenceData, input, result, setPassThroughs } = useEstimate();
  const pt = input.passThroughs;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl text-navy">Pass Throughs</h1>

      <section className="bg-white rounded-lg shadow p-4">
        <h2 className="font-display text-lg text-navy mb-2 flex justify-between">
          <span>Per Diem</span>
          <span>{formatCurrency(result.passThroughs.perDiemTotal)}</span>
        </h2>
        {referenceData.passThroughRates.perDiemRateByRole.map(({ role, rate }) => {
          const line = pt.perDiem.find((l) => l.role === role);
          return (
            <div key={role} className="flex items-center gap-4 py-1 text-sm">
              <span className="w-40 text-slate">{role}</span>
              <span className="w-20 text-right">{formatCurrency(rate)}/day</span>
              <label className="flex items-center gap-1">
                Employees
                <input
                  type="number" min={0} className="w-16 border border-line rounded px-2 py-1"
                  value={line?.employeeCount ?? 0}
                  onChange={(e) => setPassThroughs({ perDiem: updateRoleDaysLine(pt.perDiem, role, { employeeCount: Number(e.target.value) }) })}
                />
              </label>
              <label className="flex items-center gap-1">
                Days
                <input
                  type="number" min={0} className="w-16 border border-line rounded px-2 py-1"
                  value={line?.days ?? 0}
                  onChange={(e) => setPassThroughs({ perDiem: updateRoleDaysLine(pt.perDiem, role, { days: Number(e.target.value) }) })}
                />
              </label>
            </div>
          );
        })}
      </section>

      <section className="bg-white rounded-lg shadow p-4">
        <h2 className="font-display text-lg text-navy mb-2 flex justify-between">
          <span>Lodging</span>
          <span>{formatCurrency(result.passThroughs.lodgingTotal)}</span>
        </h2>
        {referenceData.passThroughRates.lodgingRateByRole.map(({ role, rate }) => {
          const line = pt.lodging.find((l) => l.role === role);
          return (
            <div key={role} className="flex items-center gap-4 py-1 text-sm">
              <span className="w-40 text-slate">{role}</span>
              <span className="w-20 text-right">{formatCurrency(rate)}/night</span>
              <label className="flex items-center gap-1">
                Employees
                <input
                  type="number" min={0} className="w-16 border border-line rounded px-2 py-1"
                  value={line?.employeeCount ?? 0}
                  onChange={(e) => setPassThroughs({ lodging: updateRoleDaysLine(pt.lodging, role, { employeeCount: Number(e.target.value) }) })}
                />
              </label>
              <label className="flex items-center gap-1">
                Nights
                <input
                  type="number" min={0} className="w-16 border border-line rounded px-2 py-1"
                  value={line?.days ?? 0}
                  onChange={(e) => setPassThroughs({ lodging: updateRoleDaysLine(pt.lodging, role, { days: Number(e.target.value) }) })}
                />
              </label>
            </div>
          );
        })}
      </section>

      <section className="bg-white rounded-lg shadow p-4">
        <h2 className="font-display text-lg text-navy mb-2 flex justify-between">
          <span>Travel</span>
          <span>{formatCurrency(result.passThroughs.travelTotal)}</span>
        </h2>
        {referenceData.laborRates.map(({ role }) => {
          const line = pt.travel.find((l) => l.role === role);
          return (
            <div key={role} className="flex items-center gap-4 py-1 text-sm">
              <span className="w-40 text-slate">{role}</span>
              <label className="flex items-center gap-1">
                Employees
                <input
                  type="number" min={0} className="w-16 border border-line rounded px-2 py-1"
                  value={line?.employeeCount ?? 0}
                  onChange={(e) => setPassThroughs({ travel: updateRoleHoursLine(pt.travel, role, { employeeCount: Number(e.target.value) }) })}
                />
              </label>
              <label className="flex items-center gap-1">
                Hours
                <input
                  type="number" min={0} className="w-16 border border-line rounded px-2 py-1"
                  value={line?.hours ?? 0}
                  onChange={(e) => setPassThroughs({ travel: updateRoleHoursLine(pt.travel, role, { hours: Number(e.target.value) }) })}
                />
              </label>
            </div>
          );
        })}
      </section>

      <section className="bg-white rounded-lg shadow p-4">
        <h2 className="font-display text-lg text-navy mb-2 flex justify-between">
          <span>Airfare</span>
          <span>{formatCurrency(result.passThroughs.airfareTotal)}</span>
        </h2>
        {referenceData.passThroughRates.airfareCostByRole.map(({ role, cost }) => {
          const line = pt.airfare.find((l) => l.role === role);
          return (
            <div key={role} className="flex items-center gap-4 py-1 text-sm">
              <span className="w-40 text-slate">{role}</span>
              <span className="w-20 text-right">{formatCurrency(cost)}/ticket</span>
              <label className="flex items-center gap-1">
                Qty
                <input
                  type="number" min={0} className="w-16 border border-line rounded px-2 py-1"
                  value={line?.qty ?? 0}
                  onChange={(e) => setPassThroughs({ airfare: updateRoleQtyLine(pt.airfare, role, Number(e.target.value)) })}
                />
              </label>
            </div>
          );
        })}
      </section>

      <section className="bg-white rounded-lg shadow p-4">
        <h2 className="font-display text-lg text-navy mb-2 flex justify-between">
          <span>Rentals</span>
          <span>{formatCurrency(result.passThroughs.rentalsTotal)}</span>
        </h2>
        {referenceData.passThroughRates.rentals.map(({ key, name, rate, unit }) => {
          const line = pt.rentals.find((l) => l.key === key);
          return (
            <div key={key} className="flex items-center gap-4 py-1 text-sm">
              <span className="w-56 text-slate">{name}</span>
              <span className="w-28 text-right">{formatCurrency(rate)}/{unit}</span>
              <label className="flex items-center gap-1">
                Qty
                <input
                  type="number" min={0} className="w-16 border border-line rounded px-2 py-1"
                  value={line?.qty ?? 0}
                  onChange={(e) => setPassThroughs({ rentals: updateKeyQtyLine(pt.rentals, key, Number(e.target.value)) })}
                />
              </label>
            </div>
          );
        })}
      </section>

      <section className="bg-white rounded-lg shadow p-4">
        <h2 className="font-display text-lg text-navy mb-2 flex justify-between">
          <span>Soft Costs</span>
          <span>{formatCurrency(result.passThroughs.softCostsTotal)}</span>
        </h2>
        {referenceData.passThroughRates.softCosts.map(({ key, name, fee }) => {
          const line = pt.softCosts.find((l) => l.key === key);
          return (
            <div key={key} className="flex items-center gap-4 py-1 text-sm">
              <span className="w-56 text-slate">{name}</span>
              <span className="w-28 text-right">{formatCurrency(fee)}/each</span>
              <label className="flex items-center gap-1">
                Qty
                <input
                  type="number" min={0} className="w-16 border border-line rounded px-2 py-1"
                  value={line?.qty ?? 0}
                  onChange={(e) => setPassThroughs({ softCosts: updateKeyQtyLine(pt.softCosts, key, Number(e.target.value)) })}
                />
              </label>
            </div>
          );
        })}
      </section>

      <div className="bg-white rounded-lg shadow p-4 flex justify-between font-display text-lg text-navy">
        <span>Pass Through Total</span>
        <span>{formatCurrency(result.passThroughs.grandTotal)}</span>
      </div>

      <MoveToButton href="/summary" label="→ Executive Summary" />
    </div>
  );
}
```

- [ ] **Step 2: Verify the app builds**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/pass-throughs/
git commit -m "Add Pass Throughs page"
```

---

### Task 8: Executive Summary page

**Files:**
- Create: `src/app/summary/page.tsx`

**Interfaces:**
- Consumes: `useEstimate` (Task 2), `formatCurrency` (Task 3).
- Produces: the page's rendered `result.executiveSummary` fields and the `marginTweak` input — Task 9 modifies this same file to add the PDF export button.

- [ ] **Step 1: Write the Executive Summary page**

```tsx
// src/app/summary/page.tsx
'use client';

import { useState } from 'react';
import { useEstimate } from '@/lib/estimate/EstimateContext';
import { formatCurrency } from '@/lib/utils/formatCurrency';

function Row({
  label,
  value,
  strong = false,
  dark = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
  dark?: boolean;
}) {
  return (
    <div className={`flex justify-between py-1 ${strong ? 'font-display text-navy' : 'text-sm'}`}>
      <span className={strong ? '' : dark ? 'text-white/70' : 'text-slate'}>{label}</span>
      <span className={strong ? 'font-semibold' : ''}>{value}</span>
    </div>
  );
}

export default function SummaryPage() {
  const { result, input, setMarkups } = useEstimate();
  const es = result.executiveSummary;
  const [venueVisible, setVenueVisible] = useState(false);
  const [venueSqft, setVenueSqft] = useState(0);

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="font-display text-2xl text-navy">Executive Summary</h1>

      <section className="bg-white rounded-lg shadow p-4">
        <h2 className="font-display text-lg text-navy mb-2">Labor</h2>
        <Row label="Operational Labor" value={formatCurrency(es.operationalLaborCost)} />
        <Row label="Admin Labor" value={formatCurrency(es.opsAdminLaborCost)} />
        <Row label="Travel" value={formatCurrency(es.travelCost)} />
        <Row label="Total Project Labor" value={formatCurrency(es.totalProjectLaborBilled)} strong />
      </section>

      <section className="bg-white rounded-lg shadow p-4">
        <h2 className="font-display text-lg text-navy mb-2">Pass Through</h2>
        <Row label="Per Diem" value={formatCurrency(es.perDiemCost)} />
        <Row label="Lodging" value={formatCurrency(es.lodgingCost)} />
        <Row label="Airfare" value={formatCurrency(es.airfareCost)} />
        <Row label="Rentals" value={formatCurrency(es.rentalsCost)} />
        <Row label="Soft Costs" value={formatCurrency(es.softCostsCost)} />
        <Row label="Total Pass Through Expense" value={formatCurrency(es.totalPassThroughBilled)} strong />
      </section>

      <section className="bg-white rounded-lg shadow p-4">
        <h2 className="font-display text-lg text-navy mb-2">Material</h2>
        <Row label="Consumable" value={formatCurrency(es.consumableCost)} />
        <Row label="DAS Materials" value={formatCurrency(es.dasMaterialsCost)} />
        <Row label="BAT Materials" value={formatCurrency(es.batMaterialsCost)} />
        <Row label="S&H / Material Contingency" value={formatCurrency(es.materialContingencyAndSH)} />
        <Row label="Total Materials" value={formatCurrency(es.totalMaterialBilled)} strong />
      </section>

      <section className="bg-white rounded-lg shadow p-4">
        <h2 className="font-display text-lg text-navy mb-2">Projected Gross Margins</h2>
        <Row label="Total Direct Cost" value={formatCurrency(es.totalDirectCost)} strong />
        <Row label="Projected Gross Profit $$" value={formatCurrency(es.grossProfit)} />
        <Row label="Mark-Up %" value={`${(es.markupPercent * 100).toFixed(1)}%`} />
        <Row label="Gross Margin %" value={`${(es.grossMarginPercent * 100).toFixed(1)}%`} />
        <label className="flex justify-between items-center py-2">
          <span className="text-slate text-sm">Tweak for Margin Target ($)</span>
          <input
            type="number"
            className="w-32 border border-line rounded px-2 py-1 text-right"
            value={input.markups.marginTweak}
            onChange={(e) => setMarkups({ marginTweak: Number(e.target.value) })}
          />
        </label>
        <Row label="PGM Grand Total" value={formatCurrency(es.projectedGrossMarginTotal)} strong />
      </section>

      <section className="bg-white rounded-lg shadow p-4">
        <h2 className="font-display text-lg text-navy mb-2">Projected Net Margins</h2>
        <Row label="Mark-Up for Corporate" value={formatCurrency(es.corporateMarkupCost)} />
        <Row label="PNM Grand Total" value={formatCurrency(es.projectedNetMarginTotal)} strong />
        <Row label="Projected Net Profit $$" value={formatCurrency(es.netProfit)} />
        <Row label="Net Margin %" value={`${(es.netMarginPercent * 100).toFixed(1)}%`} />
      </section>

      <section className="bg-white rounded-lg shadow p-4">
        <button
          className="text-navy underline text-sm mb-2"
          onClick={() => setVenueVisible((v) => !v)}
        >
          {venueVisible ? 'Hide' : 'Show'} venue $/sqft metrics
        </button>
        {venueVisible && (
          <div>
            <label className="flex justify-between items-center py-1">
              <span className="text-slate text-sm">Venue Covered Sqft</span>
              <input
                type="number"
                className="w-32 border border-line rounded px-2 py-1 text-right"
                value={venueSqft}
                onChange={(e) => setVenueSqft(Number(e.target.value))}
              />
            </label>
            <Row
              label="ACT Quote / sqft"
              value={venueSqft ? formatCurrency(es.grandTotalToBidTaxIncluded / venueSqft) : '—'}
            />
          </div>
        )}
      </section>

      <section className="bg-navy rounded-lg shadow p-6 text-white">
        <Row label="Total Labor to Bid" value={formatCurrency(es.totalLaborToBid)} dark />
        <Row label="Total Material to Bid" value={formatCurrency(es.totalMaterialToBid)} dark />
        <div className="flex justify-between items-center pt-3 mt-3 border-t border-white/20">
          <span className="font-display text-lg">Grand Total to Bid (Tax Exempt)</span>
          <span className="font-display text-xl">{formatCurrency(es.grandTotalToBidTaxExempt)}</span>
        </div>
        <Row label={`Tax (${(input.markups.taxRate * 100).toFixed(2)}%)`} value={formatCurrency(es.taxAmount)} dark />
        <div className="flex justify-between items-center pt-3 mt-3 border-t border-white/20">
          <span className="font-display text-lg">Grand Total to Bid (Tax Included)</span>
          <span className="font-display text-2xl text-red">{formatCurrency(es.grandTotalToBidTaxIncluded)}</span>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Verify the app builds**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/summary/
git commit -m "Add Executive Summary page"
```

---

### Task 9: PDF export

**Files:**
- Modify: `package.json` (add `@react-pdf/renderer`)
- Create: `src/lib/utils/pdfFileName.ts`
- Test: `src/lib/utils/pdfFileName.test.ts`
- Create: `src/components/EstimatePdfDocument.tsx`
- Modify: `src/app/summary/page.tsx`

**Interfaces:**
- Consumes: `EstimateResult`, `CoverInfo` (Task 2); `result`/`coverInfo` from `useEstimate()` in the Executive Summary page (Task 8).

- [ ] **Step 1: Add the PDF dependency**

Add to `package.json`'s `dependencies`:
```json
    "@react-pdf/renderer": "^3.4.4"
```

Run: `npm install`
Expected: installs without error.

- [ ] **Step 2: Write the failing test for `pdfFileName`**

```ts
// src/lib/utils/pdfFileName.test.ts
import { describe, it, expect } from 'vitest';
import { pdfFileName } from './pdfFileName';

describe('pdfFileName', () => {
  it('builds a filename from client and project when both are present', () => {
    expect(pdfFileName('Acme Corp', 'Downtown Stadium DAS')).toBe('Acme Corp-Downtown Stadium DAS-Estimate.pdf');
  });

  it('trims whitespace from client and project', () => {
    expect(pdfFileName('  Acme Corp  ', '  Stadium  ')).toBe('Acme Corp-Stadium-Estimate.pdf');
  });

  it('falls back to a date-stamped name when client or project is blank', () => {
    const name = pdfFileName('', '');
    expect(name).toMatch(/^Estimate-\d{4}-\d{2}-\d{2}\.pdf$/);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/utils/pdfFileName.test.ts`
Expected: FAIL — `Cannot find module './pdfFileName'`

- [ ] **Step 4: Implement `pdfFileName`**

```ts
// src/lib/utils/pdfFileName.ts
export function pdfFileName(client: string, project: string): string {
  const trimmedClient = client.trim();
  const trimmedProject = project.trim();
  if (trimmedClient && trimmedProject) {
    return `${trimmedClient}-${trimmedProject}-Estimate.pdf`;
  }
  const date = new Date().toISOString().slice(0, 10);
  return `Estimate-${date}.pdf`;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/utils/pdfFileName.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: Write the PDF document component**

```tsx
// src/components/EstimatePdfDocument.tsx
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { EstimateResult } from '@/lib/calc';
import type { CoverInfo } from '@/lib/estimate/EstimateContext';

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: 'Helvetica' },
  header: { marginBottom: 16, borderBottom: 2, borderBottomColor: '#0f1e42', paddingBottom: 8 },
  title: { fontSize: 18, color: '#0f1e42', marginBottom: 4 },
  subtitle: { fontSize: 10, color: '#48566f' },
  sectionTitle: { fontSize: 12, color: '#0f1e42', marginTop: 16, marginBottom: 6, fontWeight: 'bold' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  label: { color: '#48566f' },
  value: { fontWeight: 'bold' },
  grandTotal: { marginTop: 16, padding: 10, backgroundColor: '#f4f6fa', flexDirection: 'row', justifyContent: 'space-between' },
  grandTotalLabel: { fontSize: 12, color: '#0f1e42' },
  grandTotalValue: { fontSize: 16, color: '#d8202b', fontWeight: 'bold' },
});

function money(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export function EstimatePdfDocument({ coverInfo, result }: { coverInfo: CoverInfo; result: EstimateResult }) {
  const es = result.executiveSummary;
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{coverInfo.project || 'Untitled Project'}</Text>
          <Text style={styles.subtitle}>Client: {coverInfo.client || '—'}</Text>
          <Text style={styles.subtitle}>Estimator: {coverInfo.estimator || '—'}</Text>
          <Text style={styles.subtitle}>Job Site: {coverInfo.jobSiteAddress || '—'}</Text>
        </View>

        <Text style={styles.sectionTitle}>Labor</Text>
        <View style={styles.row}><Text style={styles.label}>Operational Labor</Text><Text style={styles.value}>{money(es.operationalLaborCost)}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Admin Labor</Text><Text style={styles.value}>{money(es.opsAdminLaborCost)}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Travel</Text><Text style={styles.value}>{money(es.travelCost)}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Total Project Labor (billed)</Text><Text style={styles.value}>{money(es.totalProjectLaborBilled)}</Text></View>

        <Text style={styles.sectionTitle}>Pass Throughs</Text>
        <View style={styles.row}><Text style={styles.label}>Per Diem</Text><Text style={styles.value}>{money(es.perDiemCost)}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Lodging</Text><Text style={styles.value}>{money(es.lodgingCost)}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Airfare</Text><Text style={styles.value}>{money(es.airfareCost)}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Rentals</Text><Text style={styles.value}>{money(es.rentalsCost)}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Soft Costs</Text><Text style={styles.value}>{money(es.softCostsCost)}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Total Pass Through (billed)</Text><Text style={styles.value}>{money(es.totalPassThroughBilled)}</Text></View>

        <Text style={styles.sectionTitle}>Materials</Text>
        <View style={styles.row}><Text style={styles.label}>Consumable</Text><Text style={styles.value}>{money(es.consumableCost)}</Text></View>
        <View style={styles.row}><Text style={styles.label}>DAS Materials</Text><Text style={styles.value}>{money(es.dasMaterialsCost)}</Text></View>
        <View style={styles.row}><Text style={styles.label}>BAT Materials</Text><Text style={styles.value}>{money(es.batMaterialsCost)}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Contingency / S&H</Text><Text style={styles.value}>{money(es.materialContingencyAndSH)}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Total Materials (billed)</Text><Text style={styles.value}>{money(es.totalMaterialBilled)}</Text></View>

        <Text style={styles.sectionTitle}>Margins</Text>
        <View style={styles.row}><Text style={styles.label}>Total Direct Cost</Text><Text style={styles.value}>{money(es.totalDirectCost)}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Gross Margin %</Text><Text style={styles.value}>{(es.grossMarginPercent * 100).toFixed(1)}%</Text></View>
        <View style={styles.row}><Text style={styles.label}>Net Margin %</Text><Text style={styles.value}>{(es.netMarginPercent * 100).toFixed(1)}%</Text></View>

        <View style={styles.grandTotal}>
          <Text style={styles.grandTotalLabel}>Grand Total to Bid (tax included)</Text>
          <Text style={styles.grandTotalValue}>{money(es.grandTotalToBidTaxIncluded)}</Text>
        </View>
      </Page>
    </Document>
  );
}
```

- [ ] **Step 7: Add the Export PDF button to the Executive Summary page**

Add this import block to the top of `src/app/summary/page.tsx` (alongside the existing imports):

```tsx
import dynamic from 'next/dynamic';
import { EstimatePdfDocument } from '@/components/EstimatePdfDocument';
import { pdfFileName } from '@/lib/utils/pdfFileName';

// PDFDownloadLink's TypeScript types (as of @react-pdf/renderer 3.4.x) declare
// `children` as `ReactNode | ReactElement<BlobProviderParams>`, which does not
// admit a render-prop function even though the runtime implementation calls
// `children(instance)` when `children` is a function (verified against the
// library's browser build). BlobProvider's `children` is correctly typed as
// `(params: BlobProviderParams) => ReactNode`, so it is used here instead to
// build the same "anchor that downloads the generated blob" behavior without
// fighting an upstream type definition bug.
const BlobProvider = dynamic(
  () => import('@react-pdf/renderer').then((mod) => mod.BlobProvider),
  { ssr: false },
);
```

Add `coverInfo` to the destructured `useEstimate()` call:

```tsx
const { result, input, setMarkups, coverInfo } = useEstimate();
```

Add this button right after the `<h1>` heading:

```tsx
      <BlobProvider document={<EstimatePdfDocument coverInfo={coverInfo} result={result} />}>
        {({ url, loading }) => (
          <a
            href={url ?? undefined}
            download={pdfFileName(coverInfo.client, coverInfo.project)}
            className="inline-block bg-red hover:bg-red-700 text-white font-display font-semibold px-6 py-3 rounded transition-colors"
          >
            {loading ? 'Preparing PDF…' : 'Export PDF'}
          </a>
        )}
      </BlobProvider>
```

- [ ] **Step 8: Run tests, type-check, and build**

Run: `npx vitest run`
Expected: all test files pass.

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 9: Manual verification**

Run: `npm run dev`, open `http://localhost:3000`, click through Cover Info → Materials (enter a quantity) → Labor (enter a quantity, change technician count) → Pass Throughs (enter a per diem line) → Executive Summary. Confirm the summary strip updates live at every step, and clicking "Export PDF" downloads a PDF with the entered data.

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json src/lib/utils/pdfFileName.ts src/lib/utils/pdfFileName.test.ts src/components/EstimatePdfDocument.tsx src/app/summary/page.tsx
git commit -m "Add PDF export for the Executive Summary"
```

---

## What This Plan Does Not Cover (deferred to Plan 3)

- **Admin Area**: CRUD screens for material catalog, labor task library, labor rates, crew-size table, pass-through rate defaults, and estimate defaults (markup %/tax rate) — currently only editable by hand in Postgres or by re-running the seed script.
- The Materials page's `percentOfTotal` display field and the crew-size technician-count input range (1–20) enforcement noted in Plan 1's final review remain open minor items; the Labor page's `<select>` already constrains technician count to 1–20 as part of Task 6 above.

Once this plan is complete, a full estimate can be built end-to-end in the browser and exported as a PDF — the deliverable the original request asked for.
