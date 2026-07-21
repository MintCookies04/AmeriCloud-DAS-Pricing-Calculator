import { describe, it, expect } from 'vitest';
import { calculateMaterials } from './materials';
import type { MaterialItem } from './types';

const items: MaterialItem[] = [
  { key: 'bom-3', type: 'DC Power Plant', manufacturer: 'Vertiv', model: '582137200', description: 'NetSure 5100', vendor: 'Anixter', category: 'DAS Materials', unitCost: 4685 },
  { key: 'bom-65', type: 'Electrical', manufacturer: 'HD', model: null, description: '3/8 x 1 bolts', vendor: 'HD', category: 'Consumable', unitCost: 1 },
];

describe('calculateMaterials', () => {
  it('computes extended cost, category totals, contingency, and hardware total', () => {
    const result = calculateMaterials(items, [
      { key: 'bom-3', quantity: 2 },
      { key: 'bom-65', quantity: 100 },
    ], 0.10, 50);

    expect(result.lines.find((l) => l.key === 'bom-3')?.extCost).toBe(9370);
    expect(result.lines.find((l) => l.key === 'bom-65')?.extCost).toBe(100);

    const dasTotal = result.categoryTotals.find((c) => c.category === 'DAS Materials')?.total;
    const consumableTotal = result.categoryTotals.find((c) => c.category === 'Consumable')?.total;
    expect(dasTotal).toBe(9370);
    expect(consumableTotal).toBe(100);

    // contingency = (9370 + 100 + 0[BAT]) * 0.10
    expect(result.contingency).toBeCloseTo(947, 5);
    // hardwareTotal = 9370 + 100 + 947 + 50 (S&H)
    expect(result.hardwareTotal).toBeCloseTo(10467, 5);
  });

  it('returns zero percentOfTotal when hardwareTotal is zero', () => {
    const result = calculateMaterials(items, [], 0.10, 0);
    expect(result.hardwareTotal).toBe(0);
    expect(result.lines.every((l) => l.percentOfTotal === 0)).toBe(true);
  });

  it('computes percentOfTotal against the hardware total, not the category sum', () => {
    const result = calculateMaterials(items, [
      { key: 'bom-3', quantity: 1 },
    ], 0, 0);
    // extCost 4685, hardwareTotal = 4685 (no contingency, no S&H, no other items)
    expect(result.lines.find((l) => l.key === 'bom-3')?.percentOfTotal).toBeCloseTo(1, 10);
  });
});
