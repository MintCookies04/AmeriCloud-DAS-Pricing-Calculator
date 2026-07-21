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
  { role: 'Construction Manager' as const, hourlyRate: 95, rawWageRate: 95 },
  { role: 'Project Manager' as const, hourlyRate: 100, rawWageRate: 100 },
  { role: 'Project Coordinator' as const, hourlyRate: 55, rawWageRate: 55 },
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
