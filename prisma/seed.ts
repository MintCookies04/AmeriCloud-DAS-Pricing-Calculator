// prisma/seed.ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient, MaterialCategory, LaborRoleName, LaborSheet, PassThroughRateKind } from '@prisma/client';

const prisma = new PrismaClient();
const DATA_DIR = join(__dirname, 'seed-data');

function readJson<T>(filename: string): T {
  return JSON.parse(readFileSync(join(DATA_DIR, filename), 'utf-8')) as T;
}

const CATEGORY_MAP: Record<string, MaterialCategory> = {
  Consumable: 'Consumable',
  'DAS Materials': 'DAS_Materials',
  'BAT Materials': 'BAT_Materials',
};

const ROLE_MAP: Record<string, LaborRoleName> = {
  Technician: 'Technician',
  'Construction Manager': 'Construction_Manager',
  'RF-Engineer': 'RF_Engineer',
  'RF-Technician': 'RF_Technician',
  'Project Coordinator': 'Project_Coordinator',
  'Project Manager': 'Project_Manager',
};

interface SeedMaterialItem {
  key: string; type: string; manufacturer: string | null; model: string | null;
  description: string; vendor: string | null; category: string; unitCost: number;
}

interface SeedLaborTask {
  key: string; sheet: 'LOE' | 'SOW'; category: string; name: string;
  minutesPerUnit: number; unit: string; laborRole: string;
  includedInSubtotal: boolean;
  derivedFrom: { terms: { key: string; coeff: number }[]; divisor: number } | null;
}

interface SeedLaborRate { role: string; hourlyRate: number; rawWageRate: number }
interface SeedCrewSizeRow { technicianCount: number; cmsNeeded: number }
interface SeedLaborProjectionSettings {
  hoursPerManDay: number; hoursPerManWeek: number; stagingMaterialMultiplier: number;
  cmPercentOfTechHours: number; pmPercentOfTechHours: number; coordinatorPercentOfTechHours: number;
}
interface SeedPassThroughRates {
  perDiemRateByRole: { role: string; rate: number }[];
  lodgingRateByRole: { role: string; rate: number }[];
  airfareCostByRole: { role: string; cost: number }[];
  rentals: { key: string; name: string; rate: number; unit: string }[];
  softCosts: { key: string; name: string; fee: number }[];
}

async function main() {
  const materialItems = readJson<SeedMaterialItem[]>('material-items.json');
  for (const item of materialItems) {
    const category = CATEGORY_MAP[item.category];
    if (!category) throw new Error(`Unknown material category: ${item.category}`);
    await prisma.materialItem.upsert({
      where: { key: item.key },
      create: { ...item, category },
      update: { ...item, category },
    });
  }

  const laborTasks = readJson<SeedLaborTask[]>('labor-tasks.json');
  for (const task of laborTasks) {
    const laborRole = ROLE_MAP[task.laborRole];
    if (!laborRole) throw new Error(`Unknown labor role: ${task.laborRole}`);
    await prisma.laborTask.upsert({
      where: { key: task.key },
      create: {
        key: task.key,
        sheet: task.sheet as LaborSheet,
        category: task.category,
        name: task.name,
        minutesPerUnit: task.minutesPerUnit,
        unit: task.unit,
        laborRole,
        includedInSubtotal: task.includedInSubtotal,
        derivedFromJson: task.derivedFrom ?? undefined,
      },
      update: {
        sheet: task.sheet as LaborSheet,
        category: task.category,
        name: task.name,
        minutesPerUnit: task.minutesPerUnit,
        unit: task.unit,
        laborRole,
        includedInSubtotal: task.includedInSubtotal,
        derivedFromJson: task.derivedFrom ?? undefined,
      },
    });
  }

  const laborRates = readJson<SeedLaborRate[]>('labor-rates.json');
  for (const rate of laborRates) {
    const role = ROLE_MAP[rate.role];
    if (!role) throw new Error(`Unknown labor role: ${rate.role}`);
    await prisma.laborRate.upsert({
      where: { role },
      create: { role, hourlyRate: rate.hourlyRate, rawWageRate: rate.rawWageRate },
      update: { hourlyRate: rate.hourlyRate, rawWageRate: rate.rawWageRate },
    });
  }

  const crewSizeTable = readJson<SeedCrewSizeRow[]>('crew-size-table.json');
  for (const row of crewSizeTable) {
    await prisma.crewSizeRow.upsert({
      where: { technicianCount: row.technicianCount },
      create: row,
      update: row,
    });
  }

  const settings = readJson<SeedLaborProjectionSettings>('labor-projection-settings.json');
  await prisma.laborProjectionSettings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', ...settings },
    update: settings,
  });

  const passThroughRates = readJson<SeedPassThroughRates>('pass-through-rates.json');
  for (const r of passThroughRates.perDiemRateByRole) {
    const role = ROLE_MAP[r.role];
    if (!role) throw new Error(`Unknown labor role: ${r.role}`);
    await prisma.passThroughRoleRate.upsert({
      where: { kind_role: { kind: PassThroughRateKind.PerDiem, role } },
      create: { kind: PassThroughRateKind.PerDiem, role, amount: r.rate },
      update: { amount: r.rate },
    });
  }
  for (const r of passThroughRates.lodgingRateByRole) {
    const role = ROLE_MAP[r.role];
    if (!role) throw new Error(`Unknown labor role: ${r.role}`);
    await prisma.passThroughRoleRate.upsert({
      where: { kind_role: { kind: PassThroughRateKind.Lodging, role } },
      create: { kind: PassThroughRateKind.Lodging, role, amount: r.rate },
      update: { amount: r.rate },
    });
  }
  for (const r of passThroughRates.airfareCostByRole) {
    const role = ROLE_MAP[r.role];
    if (!role) throw new Error(`Unknown labor role: ${r.role}`);
    await prisma.passThroughRoleRate.upsert({
      where: { kind_role: { kind: PassThroughRateKind.Airfare, role } },
      create: { kind: PassThroughRateKind.Airfare, role, amount: r.cost },
      update: { amount: r.cost },
    });
  }
  for (const r of passThroughRates.rentals) {
    await prisma.rentalRate.upsert({ where: { key: r.key }, create: r, update: r });
  }
  for (const r of passThroughRates.softCosts) {
    await prisma.softCostRate.upsert({ where: { key: r.key }, create: r, update: r });
  }

  const defaults = {
    laborMarkupPct: 0.25,
    passThroughMarkupPct: 0.25,
    materialMarkupPct: 0.25,
    corporateMarkupPct: 0.05,
    taxRate: 0.0825,
    contingencyPct: 0.10,
  };
  await prisma.estimateDefaults.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', ...defaults },
    update: defaults,
  });

  console.log(
    `Seeded ${materialItems.length} material items, ${laborTasks.length} labor tasks, ` +
    `${laborRates.length} labor rates, ${crewSizeTable.length} crew-size rows, ` +
    `${passThroughRates.rentals.length} rentals, ${passThroughRates.softCosts.length} soft costs.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
