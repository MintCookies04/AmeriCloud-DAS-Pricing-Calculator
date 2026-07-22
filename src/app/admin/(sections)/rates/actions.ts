'use server';

import { prisma } from '@/lib/db';

interface ActionResult {
  error?: string;
}

function parseNonNegative(raw: string | undefined): number | null {
  if (raw === undefined || raw === '') return null;
  const value = Number(raw);
  if (Number.isNaN(value) || value < 0) return null;
  return value;
}

function parsePercent(raw: string | undefined): number | null {
  if (raw === undefined || raw === '') return null;
  const value = Number(raw);
  if (Number.isNaN(value) || value < 0 || value > 100) return null;
  return value / 100;
}

export async function updateLaborRate(id: string, values: Record<string, string>): Promise<ActionResult> {
  const hourlyRate = parseNonNegative(values.hourlyRate);
  if (hourlyRate === null) return { error: 'Hourly rate must be a non-negative number.' };
  const rawWageRate = parseNonNegative(values.rawWageRate);
  if (rawWageRate === null) return { error: 'Raw wage rate must be a non-negative number.' };

  await prisma.laborRate.update({ where: { id }, data: { hourlyRate, rawWageRate } });
  return {};
}

export async function updateCrewSizeRow(id: string, values: Record<string, string>): Promise<ActionResult> {
  const cmsNeeded = parseNonNegative(values.cmsNeeded);
  if (cmsNeeded === null) return { error: 'CMs needed must be a non-negative number.' };

  await prisma.crewSizeRow.update({ where: { id }, data: { cmsNeeded } });
  return {};
}

interface SettingsOk {
  ok: true;
  hoursPerManDay: number;
  hoursPerManWeek: number;
  stagingMaterialMultiplier: number;
  cmPercentOfTechHours: number;
  pmPercentOfTechHours: number;
  coordinatorPercentOfTechHours: number;
}
interface ValidationErr {
  ok: false;
  error: string;
}

function validateSettingsValues(values: Record<string, string>): SettingsOk | ValidationErr {
  const hoursPerManDay = parseNonNegative(values.hoursPerManDay);
  if (hoursPerManDay === null) return { ok: false, error: 'Hours per man-day must be a non-negative number.' };
  const hoursPerManWeek = parseNonNegative(values.hoursPerManWeek);
  if (hoursPerManWeek === null) return { ok: false, error: 'Hours per man-week must be a non-negative number.' };
  const stagingMaterialMultiplier = parsePercent(values.stagingMaterialMultiplier);
  if (stagingMaterialMultiplier === null) return { ok: false, error: 'Staging/material multiplier must be 0-100%.' };
  const cmPercentOfTechHours = parsePercent(values.cmPercentOfTechHours);
  if (cmPercentOfTechHours === null) return { ok: false, error: 'Construction Manager % must be 0-100%.' };
  const pmPercentOfTechHours = parsePercent(values.pmPercentOfTechHours);
  if (pmPercentOfTechHours === null) return { ok: false, error: 'Project Manager % must be 0-100%.' };
  const coordinatorPercentOfTechHours = parsePercent(values.coordinatorPercentOfTechHours);
  if (coordinatorPercentOfTechHours === null) return { ok: false, error: 'Project Coordinator % must be 0-100%.' };
  return {
    ok: true,
    hoursPerManDay,
    hoursPerManWeek,
    stagingMaterialMultiplier,
    cmPercentOfTechHours,
    pmPercentOfTechHours,
    coordinatorPercentOfTechHours,
  };
}

export async function updateLaborProjectionSettings(values: Record<string, string>): Promise<ActionResult> {
  const parsed = validateSettingsValues(values);
  if (!parsed.ok) return { error: parsed.error };

  await prisma.laborProjectionSettings.update({
    where: { id: 'singleton' },
    data: {
      hoursPerManDay: parsed.hoursPerManDay,
      hoursPerManWeek: parsed.hoursPerManWeek,
      stagingMaterialMultiplier: parsed.stagingMaterialMultiplier,
      cmPercentOfTechHours: parsed.cmPercentOfTechHours,
      pmPercentOfTechHours: parsed.pmPercentOfTechHours,
      coordinatorPercentOfTechHours: parsed.coordinatorPercentOfTechHours,
    },
  });
  return {};
}
