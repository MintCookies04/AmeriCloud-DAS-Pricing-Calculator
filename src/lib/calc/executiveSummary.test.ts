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

  it('computes total direct cost break-even from independently-derived labor, pass-through, and material costs', () => {
    const result = calculateExecutiveSummary(labor, crewPlan, passThroughs, materials, settings, markups);
    const expectedLaborCost = labor.grandCost * (1 + settings.stagingMaterialMultiplier) +
      crewPlan.opsAdminLaborTotal.cost + passThroughs.travelTotal;
    const expectedPassThroughCost = passThroughs.perDiemTotal + passThroughs.lodgingTotal +
      passThroughs.airfareTotal + passThroughs.rentalsTotal + passThroughs.softCostsTotal;
    const expectedMaterialCost = materials.hardwareTotal;
    const expectedBreakEven = expectedLaborCost + expectedPassThroughCost + expectedMaterialCost;
    expect(result.totalDirectCostBreakEven).toBeCloseTo(expectedBreakEven, 6);
  });

  it('computes gross profit, markup percent, and gross margin percent from independently-derived totals', () => {
    const result = calculateExecutiveSummary(labor, crewPlan, passThroughs, materials, settings, markups);
    const expectedLaborCost = labor.grandCost * (1 + settings.stagingMaterialMultiplier) +
      crewPlan.opsAdminLaborTotal.cost + passThroughs.travelTotal;
    const expectedLaborBilled = expectedLaborCost * (1 + markups.laborMarkupPct);
    const expectedPassThroughCost = passThroughs.perDiemTotal + passThroughs.lodgingTotal +
      passThroughs.airfareTotal + passThroughs.rentalsTotal + passThroughs.softCostsTotal;
    const expectedPassThroughBilled = expectedPassThroughCost * (1 + markups.passThroughMarkupPct);
    const expectedMaterialCost = materials.hardwareTotal;
    const expectedMaterialBilled = expectedMaterialCost * (1 + markups.materialMarkupPct);
    const expectedTotalDirectCost = expectedLaborBilled + expectedPassThroughBilled + expectedMaterialBilled;
    const expectedBreakEven = expectedLaborCost + expectedPassThroughCost + expectedMaterialCost;

    const expectedGrossProfit = expectedTotalDirectCost - expectedBreakEven;
    const expectedMarkupPercent = expectedTotalDirectCost / expectedBreakEven - 1;
    const expectedGrossMarginPercent = 1 - expectedBreakEven / expectedTotalDirectCost;

    expect(result.grossProfit).toBeCloseTo(expectedGrossProfit, 6);
    expect(result.markupPercent).toBeCloseTo(expectedMarkupPercent, 6);
    expect(result.grossMarginPercent).toBeCloseTo(expectedGrossMarginPercent, 6);
  });

  it('apportions corporate markup and margin tweak between labor and material to bid using independently-derived fractions', () => {
    const result = calculateExecutiveSummary(labor, crewPlan, passThroughs, materials, settings, markups);
    const expectedLaborCost = labor.grandCost * (1 + settings.stagingMaterialMultiplier) +
      crewPlan.opsAdminLaborTotal.cost + passThroughs.travelTotal;
    const expectedLaborBilled = expectedLaborCost * (1 + markups.laborMarkupPct);
    const expectedPassThroughCost = passThroughs.perDiemTotal + passThroughs.lodgingTotal +
      passThroughs.airfareTotal + passThroughs.rentalsTotal + passThroughs.softCostsTotal;
    const expectedPassThroughBilled = expectedPassThroughCost * (1 + markups.passThroughMarkupPct);
    const expectedMaterialCost = materials.hardwareTotal;
    const expectedMaterialBilled = expectedMaterialCost * (1 + markups.materialMarkupPct);
    const expectedTotalDirectCost = expectedLaborBilled + expectedPassThroughBilled + expectedMaterialBilled;

    const expectedProjectedGrossMarginTotal = expectedTotalDirectCost + markups.marginTweak;
    const expectedCorporateMarkupCost = expectedProjectedGrossMarginTotal * markups.corporateMarkupPct;

    const laborExpenseApportionment = (expectedLaborBilled + expectedPassThroughBilled) / expectedTotalDirectCost;
    const materialApportionment = expectedMaterialBilled / expectedTotalDirectCost;

    const expectedTotalLaborToBid = expectedLaborBilled + expectedPassThroughBilled +
      expectedCorporateMarkupCost * laborExpenseApportionment + markups.marginTweak * laborExpenseApportionment;
    const expectedTotalMaterialToBid = expectedMaterialBilled +
      expectedCorporateMarkupCost * materialApportionment + markups.marginTweak * materialApportionment;

    expect(result.totalLaborToBid).toBeCloseTo(expectedTotalLaborToBid, 6);
    expect(result.totalMaterialToBid).toBeCloseTo(expectedTotalMaterialToBid, 6);
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
