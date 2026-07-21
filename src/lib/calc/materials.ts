import type { MaterialCategory, MaterialItem, MaterialLineInput, MaterialResult } from './types';

const CATEGORIES: MaterialCategory[] = ['Consumable', 'DAS Materials', 'BAT Materials'];

export function calculateMaterials(
  items: MaterialItem[],
  lines: MaterialLineInput[],
  contingencyPct: number,
  shippingHandling: number,
): MaterialResult {
  const qtyByKey = new Map(lines.map((l) => [l.key, l.quantity]));

  const extCostByKey = new Map(
    items.map((item) => [item.key, item.unitCost * (qtyByKey.get(item.key) ?? 0)]),
  );

  const categoryTotals = CATEGORIES.map((category) => ({
    category,
    total: items
      .filter((i) => i.category === category)
      .reduce((sum, i) => sum + (extCostByKey.get(i.key) ?? 0), 0),
  }));

  const categorySum = categoryTotals.reduce((sum, c) => sum + c.total, 0);
  const contingency = categorySum * contingencyPct;
  const hardwareTotal = categorySum + contingency + shippingHandling;

  const lineResults = items.map((item) => {
    const extCost = extCostByKey.get(item.key) ?? 0;
    return {
      key: item.key,
      extCost,
      percentOfTotal: hardwareTotal === 0 ? 0 : extCost / hardwareTotal,
    };
  });

  return { lines: lineResults, categoryTotals, contingency, shippingHandling, hardwareTotal };
}
