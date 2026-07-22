import { describe, it, expect, afterEach } from 'vitest';
import { prisma } from '@/lib/db';
import { updateLaborRate, updateCrewSizeRow, updateLaborProjectionSettings } from './actions';

describe('rates admin actions (integration — requires a live, seeded local Postgres)', () => {
  const restoreLaborRate: { id: string; hourlyRate: number; rawWageRate: number }[] = [];
  const restoreCrewSize: { id: string; cmsNeeded: number }[] = [];
  let restoreSettings: Record<string, number> | null = null;

  afterEach(async () => {
    for (const r of restoreLaborRate.splice(0)) {
      await prisma.laborRate.update({ where: { id: r.id }, data: { hourlyRate: r.hourlyRate, rawWageRate: r.rawWageRate } });
    }
    for (const r of restoreCrewSize.splice(0)) {
      await prisma.crewSizeRow.update({ where: { id: r.id }, data: { cmsNeeded: r.cmsNeeded } });
    }
    if (restoreSettings) {
      await prisma.laborProjectionSettings.update({ where: { id: 'singleton' }, data: restoreSettings });
      restoreSettings = null;
    }
  });

  it('updates a labor rate', async () => {
    const original = await prisma.laborRate.findFirstOrThrow({ where: { role: 'Technician' } });
    restoreLaborRate.push({ id: original.id, hourlyRate: original.hourlyRate, rawWageRate: original.rawWageRate });

    const result = await updateLaborRate(original.id, { hourlyRate: '90', rawWageRate: '80' });
    expect(result.error).toBeUndefined();

    const updated = await prisma.laborRate.findUniqueOrThrow({ where: { id: original.id } });
    expect(updated).toMatchObject({ hourlyRate: 90, rawWageRate: 80 });
  });

  it('rejects a negative labor rate', async () => {
    const original = await prisma.laborRate.findFirstOrThrow({ where: { role: 'Technician' } });
    const result = await updateLaborRate(original.id, { hourlyRate: '-1', rawWageRate: '80' });
    expect(result.error).toMatch(/non-negative/);
  });

  it('updates a crew-size row', async () => {
    const original = await prisma.crewSizeRow.findFirstOrThrow({ where: { technicianCount: 4 } });
    restoreCrewSize.push({ id: original.id, cmsNeeded: original.cmsNeeded });

    const result = await updateCrewSizeRow(original.id, { cmsNeeded: '3' });
    expect(result.error).toBeUndefined();

    const updated = await prisma.crewSizeRow.findUniqueOrThrow({ where: { id: original.id } });
    expect(updated.cmsNeeded).toBe(3);
  });

  it('rejects a non-integer cmsNeeded with a friendly error instead of throwing', async () => {
    const original = await prisma.crewSizeRow.findFirstOrThrow({ where: { technicianCount: 4 } });
    restoreCrewSize.push({ id: original.id, cmsNeeded: original.cmsNeeded });

    const result = await updateCrewSizeRow(original.id, { cmsNeeded: '3.5' });
    expect(result.error).toMatch(/whole number/);

    const unchanged = await prisma.crewSizeRow.findUniqueOrThrow({ where: { id: original.id } });
    expect(unchanged.cmsNeeded).toBe(original.cmsNeeded);
  });

  it('updates labor projection settings, converting percent inputs to fractions', async () => {
    const original = await prisma.laborProjectionSettings.findUniqueOrThrow({ where: { id: 'singleton' } });
    restoreSettings = {
      hoursPerManDay: original.hoursPerManDay,
      hoursPerManWeek: original.hoursPerManWeek,
      stagingMaterialMultiplier: original.stagingMaterialMultiplier,
      cmPercentOfTechHours: original.cmPercentOfTechHours,
      pmPercentOfTechHours: original.pmPercentOfTechHours,
      coordinatorPercentOfTechHours: original.coordinatorPercentOfTechHours,
    };

    const result = await updateLaborProjectionSettings({
      hoursPerManDay: '8', hoursPerManWeek: '40', stagingMaterialMultiplier: '10',
      cmPercentOfTechHours: '50', pmPercentOfTechHours: '25', coordinatorPercentOfTechHours: '15',
    });
    expect(result.error).toBeUndefined();

    const updated = await prisma.laborProjectionSettings.findUniqueOrThrow({ where: { id: 'singleton' } });
    expect(updated.stagingMaterialMultiplier).toBeCloseTo(0.10, 6);
    expect(updated.cmPercentOfTechHours).toBeCloseTo(0.50, 6);
  });

  it('rejects an out-of-range percent', async () => {
    const result = await updateLaborProjectionSettings({
      hoursPerManDay: '8', hoursPerManWeek: '40', stagingMaterialMultiplier: '150',
      cmPercentOfTechHours: '50', pmPercentOfTechHours: '25', coordinatorPercentOfTechHours: '15',
    });
    expect(result.error).toMatch(/0-100/);
  });
});
