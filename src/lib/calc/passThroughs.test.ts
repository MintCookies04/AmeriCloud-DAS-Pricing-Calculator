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

const laborRates = [
  { role: 'Technician' as const, hourlyRate: 85, rawWageRate: 85 },
  // RF-Engineer's billing rate (100) deliberately differs from its raw wage
  // (75) in the source workbook — travel must use the raw wage, not billing.
  { role: 'RF-Engineer' as const, hourlyRate: 100, rawWageRate: 75 },
];

describe('calculatePassThroughs', () => {
  it('computes per diem as rate * employeeCount * days', () => {
    const result = calculatePassThroughs({
      perDiem: [{ role: 'Technician', employeeCount: 4, days: 10 }],
      lodging: [], travel: [], airfare: [], rentals: [], softCosts: [],
    }, rates, laborRates);
    expect(result.perDiemTotal).toBe(50 * 4 * 10);
  });

  it('computes travel using the labor raw wage rate, not the billing rate', () => {
    const result = calculatePassThroughs({
      perDiem: [], lodging: [],
      travel: [{ role: 'RF-Engineer', employeeCount: 3, hours: 8 }],
      airfare: [], rentals: [], softCosts: [],
    }, rates, laborRates);
    // must use rawWageRate (75), not hourlyRate/billing rate (100)
    expect(result.travelTotal).toBe(75 * 3 * 8);
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
