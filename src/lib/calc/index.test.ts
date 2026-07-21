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
    { role: 'Technician', hourlyRate: 85, rawWageRate: 85 },
    { role: 'Construction Manager', hourlyRate: 95, rawWageRate: 95 },
    { role: 'RF-Engineer', hourlyRate: 100, rawWageRate: 75 },
    { role: 'RF-Technician', hourlyRate: 75, rawWageRate: 75 },
    { role: 'Project Coordinator', hourlyRate: 55, rawWageRate: 55 },
    { role: 'Project Manager', hourlyRate: 100, rawWageRate: 100 },
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
