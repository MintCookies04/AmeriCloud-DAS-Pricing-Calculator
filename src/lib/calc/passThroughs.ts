// src/lib/calc/passThroughs.ts
import type { LaborRole, PassThroughInput, PassThroughResult, ReferenceData } from './types';

export function calculatePassThroughs(
  input: PassThroughInput,
  rates: ReferenceData['passThroughRates'],
  laborRates: { role: LaborRole; hourlyRate: number; rawWageRate: number }[],
): PassThroughResult {
  const perDiemRateByRole = new Map(rates.perDiemRateByRole.map((r) => [r.role, r.rate]));
  const perDiemTotal = input.perDiem.reduce(
    (s, l) => s + (perDiemRateByRole.get(l.role) ?? 0) * l.employeeCount * l.days, 0,
  );

  const lodgingRateByRole = new Map(rates.lodgingRateByRole.map((r) => [r.role, r.rate]));
  const lodgingTotal = input.lodging.reduce(
    (s, l) => s + (lodgingRateByRole.get(l.role) ?? 0) * l.employeeCount * l.days, 0,
  );

  // Travel uses the raw wage rate, not the billing rate — the workbook's
  // Pass Throughs sheet deliberately looks up column B ("Hourly Cost"), not
  // column D ("Reg Bill with MU"), for travel pay. These differ for
  // RF-Engineer specifically (raw wage $75 vs billing rate $100).
  const rawWageByRole = new Map(laborRates.map((r) => [r.role, r.rawWageRate]));
  const travelTotal = input.travel.reduce(
    (s, l) => s + (rawWageByRole.get(l.role) ?? 0) * l.employeeCount * l.hours, 0,
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
