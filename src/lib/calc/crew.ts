// src/lib/calc/crew.ts
import type { CrewPlanResult, CrewSizeRow, LaborProjectionSettings, LaborResult, LaborRole } from './types';

export function calculateCrewPlan(
  labor: LaborResult,
  settings: LaborProjectionSettings,
  crewSizeTable: CrewSizeRow[],
  rates: { role: LaborRole; hourlyRate: number; rawWageRate: number }[],
  technicianCount: number,
): CrewPlanResult {
  const rateByRole = new Map(rates.map((r) => [r.role, r.hourlyRate]));

  const totalHoursInProject = labor.grandHours;
  const stagingHours = totalHoursInProject * settings.stagingMaterialMultiplier;
  const totalProjectTime = totalHoursInProject + stagingHours;

  const manDays = totalProjectTime / settings.hoursPerManDay;
  const manWeeks = totalProjectTime / settings.hoursPerManWeek;

  const row = crewSizeTable.find((r) => r.technicianCount === technicianCount);
  const cmsNeeded = row?.cmsNeeded ?? 0;
  const calendarDays = technicianCount ? manDays / technicianCount : 0;
  const calendarWeeks = technicianCount ? manWeeks / technicianCount : 0;
  const totalCmHours = settings.hoursPerManWeek * cmsNeeded * calendarWeeks;

  const averageOpsLaborRate = totalHoursInProject ? labor.grandCost / totalHoursInProject : 0;

  const opsAdminLaborByRole = [
    { role: 'Construction Manager' as const, percent: settings.cmPercentOfTechHours },
    { role: 'Project Manager' as const, percent: settings.pmPercentOfTechHours },
    { role: 'Project Coordinator' as const, percent: settings.coordinatorPercentOfTechHours },
  ].map(({ role, percent }) => {
    const hours = totalCmHours * percent;
    const cost = hours * (rateByRole.get(role) ?? 0);
    return { role, hours, cost };
  });

  const opsAdminLaborTotal = opsAdminLaborByRole.reduce(
    (acc, r) => ({ hours: acc.hours + r.hours, cost: acc.cost + r.cost }),
    { hours: 0, cost: 0 },
  );

  return {
    totalHoursInProject,
    stagingHours,
    totalProjectTime,
    manDays,
    manWeeks,
    calendarDays,
    calendarWeeks,
    cmsNeeded,
    totalCmHours,
    averageOpsLaborRate,
    opsAdminLaborByRole,
    opsAdminLaborTotal,
  };
}
