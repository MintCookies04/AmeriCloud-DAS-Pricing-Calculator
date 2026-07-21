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
