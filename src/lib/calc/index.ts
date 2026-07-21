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
