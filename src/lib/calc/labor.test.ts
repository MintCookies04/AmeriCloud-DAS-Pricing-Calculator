// src/lib/calc/labor.test.ts
import { describe, it, expect } from 'vitest';
import { calculateLabor } from './labor';
import type { LaborTask } from './types';

const rates = [
  { role: 'Technician' as const, hourlyRate: 85, rawWageRate: 85 },
  { role: 'Construction Manager' as const, hourlyRate: 95, rawWageRate: 95 },
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
    // loe-25 ("Labeling Coax") is derived from loe-21 + loe-22 + loe-31. Only
    // loe-21 has a quantity in this test (loe-22/loe-31 default to 0 since they
    // have no input line), so loe-25 still resolves to a quantity of 4 and
    // contributes its own hours to the grand total.
    const derivedHours = (4 * 2) / 60;
    expect(result.grandHours).toBeCloseTo(sowHours + loeHours + derivedHours, 8);
  });
});
