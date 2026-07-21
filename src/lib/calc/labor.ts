import type { LaborRole, LaborTask, LaborTaskLineInput, LaborResult, LaborTaskResult } from './types';

const ALL_ROLES: LaborRole[] = [
  'Technician', 'Construction Manager', 'RF-Engineer',
  'RF-Technician', 'Project Coordinator', 'Project Manager',
];

function resolveQuantities(
  tasks: LaborTask[],
  inputs: LaborTaskLineInput[],
): Map<string, number> {
  const inputMap = new Map(inputs.map((i) => [i.key, i.quantity]));
  const taskMap = new Map(tasks.map((t) => [t.key, t]));
  const resolved = new Map<string, number>();
  const resolving = new Set<string>();

  function resolve(key: string): number {
    if (resolved.has(key)) return resolved.get(key)!;
    const task = taskMap.get(key);
    if (!task) return 0;
    if (!task.derivedFrom) {
      const qty = inputMap.get(key) ?? 0;
      resolved.set(key, qty);
      return qty;
    }
    if (resolving.has(key)) {
      throw new Error(`Circular derived-quantity reference detected at task "${key}"`);
    }
    resolving.add(key);
    const sum = task.derivedFrom.terms.reduce((s, term) => s + term.coeff * resolve(term.key), 0);
    const qty = sum / task.derivedFrom.divisor;
    resolving.delete(key);
    resolved.set(key, qty);
    return qty;
  }

  for (const task of tasks) resolve(task.key);
  return resolved;
}

export function calculateLabor(
  tasks: LaborTask[],
  loeInputs: LaborTaskLineInput[],
  sowInputs: LaborTaskLineInput[],
  rates: { role: LaborRole; hourlyRate: number; rawWageRate: number }[],
): LaborResult {
  const rateByRole = new Map(rates.map((r) => [r.role, r.hourlyRate]));
  const quantities = resolveQuantities(tasks, [...loeInputs, ...sowInputs]);

  const taskResults: LaborTaskResult[] = tasks.map((task) => {
    const quantity = quantities.get(task.key) ?? 0;
    const hours = (quantity * task.minutesPerUnit) / 60;
    const rate = rateByRole.get(task.laborRole) ?? 0;
    return { key: task.key, quantity, hours, cost: hours * rate };
  });

  const resultByKey = new Map(taskResults.map((r) => [r.key, r]));

  const categoryKeys = Array.from(new Set(tasks.map((t) => `${t.sheet}::${t.category}`)));
  const categorySubtotals = categoryKeys.map((ck) => {
    const [sheet, category] = ck.split('::') as ['LOE' | 'SOW', string];
    const inCategory = tasks.filter((t) => t.sheet === sheet && t.category === category && t.includedInSubtotal);
    const hours = inCategory.reduce((s, t) => s + (resultByKey.get(t.key)?.hours ?? 0), 0);
    const cost = inCategory.reduce((s, t) => s + (resultByKey.get(t.key)?.cost ?? 0), 0);
    return { sheet, category, hours, cost };
  });

  const roleTotals = ALL_ROLES.map((role) => {
    const inRole = tasks.filter((t) => t.laborRole === role);
    const hours = inRole.reduce((s, t) => s + (resultByKey.get(t.key)?.hours ?? 0), 0);
    const cost = inRole.reduce((s, t) => s + (resultByKey.get(t.key)?.cost ?? 0), 0);
    return { role, hours, cost };
  });

  const grandHours = roleTotals.reduce((s, r) => s + r.hours, 0);
  const grandCost = roleTotals.reduce((s, r) => s + r.cost, 0);

  return { taskResults, categorySubtotals, roleTotals, grandHours, grandCost };
}
