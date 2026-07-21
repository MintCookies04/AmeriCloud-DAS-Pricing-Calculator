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
