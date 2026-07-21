// src/lib/calc/types.ts

export type MaterialCategory = 'Consumable' | 'DAS Materials' | 'BAT Materials';

export interface MaterialItem {
  key: string;
  type: string;
  manufacturer: string | null;
  model: string | null;
  description: string;
  vendor: string | null;
  category: MaterialCategory;
  unitCost: number;
}

export interface MaterialLineInput {
  key: string;
  quantity: number;
}

export interface MaterialCategoryTotal {
  category: MaterialCategory;
  total: number;
}

export interface MaterialLineResult {
  key: string;
  extCost: number;
  percentOfTotal: number;
}

export interface MaterialResult {
  lines: MaterialLineResult[];
  categoryTotals: MaterialCategoryTotal[];
  contingency: number;
  shippingHandling: number;
  hardwareTotal: number;
}

export type LaborRole =
  | 'Technician'
  | 'Construction Manager'
  | 'RF-Engineer'
  | 'RF-Technician'
  | 'Project Coordinator'
  | 'Project Manager';

export interface LaborTaskDerivation {
  terms: { key: string; coeff: number }[];
  divisor: number;
}

export interface LaborTask {
  key: string;
  sheet: 'LOE' | 'SOW';
  category: string;
  name: string;
  minutesPerUnit: number;
  unit: string;
  laborRole: LaborRole;
  includedInSubtotal: boolean;
  derivedFrom: LaborTaskDerivation | null;
}

export interface LaborTaskLineInput {
  key: string;
  quantity: number;
}

export interface LaborTaskResult {
  key: string;
  quantity: number;
  hours: number;
  cost: number;
}

export interface LaborCategorySubtotal {
  sheet: 'LOE' | 'SOW';
  category: string;
  hours: number;
  cost: number;
}

export interface LaborRoleTotal {
  role: LaborRole;
  hours: number;
  cost: number;
}

export interface LaborResult {
  taskResults: LaborTaskResult[];
  categorySubtotals: LaborCategorySubtotal[];
  roleTotals: LaborRoleTotal[];
  grandHours: number;
  grandCost: number;
}

export interface CrewSizeRow {
  technicianCount: number;
  cmsNeeded: number;
}

export interface LaborProjectionSettings {
  hoursPerManDay: number;
  hoursPerManWeek: number;
  stagingMaterialMultiplier: number;
  cmPercentOfTechHours: number;
  pmPercentOfTechHours: number;
  coordinatorPercentOfTechHours: number;
}

export interface CrewPlanRoleAdmin {
  role: LaborRole;
  hours: number;
  cost: number;
}

export interface CrewPlanResult {
  totalHoursInProject: number;
  stagingHours: number;
  totalProjectTime: number;
  manDays: number;
  manWeeks: number;
  calendarDays: number;
  calendarWeeks: number;
  cmsNeeded: number;
  totalCmHours: number;
  averageOpsLaborRate: number;
  opsAdminLaborByRole: CrewPlanRoleAdmin[];
  opsAdminLaborTotal: { hours: number; cost: number };
}

export interface RoleHeadcountDays {
  role: LaborRole;
  employeeCount: number;
  days: number;
}

export interface RoleHeadcountHours {
  role: LaborRole;
  employeeCount: number;
  hours: number;
}

export interface RoleTicketQty {
  role: LaborRole;
  qty: number;
}

export interface RentalLineInput {
  key: string;
  qty: number;
}

export interface SoftCostLineInput {
  key: string;
  qty: number;
}

export interface PassThroughInput {
  perDiem: RoleHeadcountDays[];
  lodging: RoleHeadcountDays[];
  travel: RoleHeadcountHours[];
  airfare: RoleTicketQty[];
  rentals: RentalLineInput[];
  softCosts: SoftCostLineInput[];
}

export interface PassThroughResult {
  perDiemTotal: number;
  lodgingTotal: number;
  travelTotal: number;
  travelHours: number;
  airfareTotal: number;
  rentalsTotal: number;
  softCostsTotal: number;
  grandTotal: number;
}

export interface MarkupInputs {
  laborMarkupPct: number;
  passThroughMarkupPct: number;
  materialMarkupPct: number;
  corporateMarkupPct: number;
  marginTweak: number;
  taxRate: number;
}

export interface ExecutiveSummaryResult {
  operationalLaborCost: number;
  opsAdminLaborCost: number;
  travelCost: number;
  totalProjectLaborCost: number;
  totalProjectLaborBilled: number;
  perDiemCost: number;
  lodgingCost: number;
  airfareCost: number;
  rentalsCost: number;
  softCostsCost: number;
  totalPassThroughCost: number;
  totalPassThroughBilled: number;
  consumableCost: number;
  dasMaterialsCost: number;
  batMaterialsCost: number;
  materialContingencyAndSH: number;
  totalMaterialCost: number;
  totalMaterialBilled: number;
  totalDirectCost: number;
  totalDirectCostBreakEven: number;
  grossProfit: number;
  markupPercent: number;
  grossMarginPercent: number;
  projectedGrossMarginTotal: number;
  corporateMarkupCost: number;
  projectedNetMarginTotal: number;
  netProfit: number;
  netMarkupPercent: number;
  netMarginPercent: number;
  totalLaborToBid: number;
  totalMaterialToBid: number;
  grandTotalToBidTaxExempt: number;
  taxAmount: number;
  grandTotalToBidTaxIncluded: number;
}

export interface ReferenceData {
  materialItems: MaterialItem[];
  laborTasks: LaborTask[];
  laborRates: { role: LaborRole; hourlyRate: number; rawWageRate: number }[];
  crewSizeTable: CrewSizeRow[];
  laborProjectionSettings: LaborProjectionSettings;
  passThroughRates: {
    perDiemRateByRole: { role: LaborRole; rate: number }[];
    lodgingRateByRole: { role: LaborRole; rate: number }[];
    airfareCostByRole: { role: LaborRole; cost: number }[];
    rentals: { key: string; name: string; rate: number; unit: string }[];
    softCosts: { key: string; name: string; fee: number }[];
  };
}

export interface EstimateInput {
  materials: MaterialLineInput[];
  contingencyPct: number;
  shippingHandling: number;
  loeTasks: LaborTaskLineInput[];
  sowTasks: LaborTaskLineInput[];
  technicianCount: number;
  passThroughs: PassThroughInput;
  markups: MarkupInputs;
}

export interface EstimateResult {
  materials: MaterialResult;
  labor: LaborResult;
  crewPlan: CrewPlanResult;
  passThroughs: PassThroughResult;
  executiveSummary: ExecutiveSummaryResult;
}
