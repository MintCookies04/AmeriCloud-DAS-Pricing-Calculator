// src/app/materials/page.tsx
'use client';

import { useEstimate } from '@/lib/estimate/EstimateContext';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { MoveToButton } from '@/components/MoveToButton';
import type { MaterialCategory } from '@/lib/calc';

const CATEGORIES: MaterialCategory[] = ['Consumable', 'DAS Materials', 'BAT Materials'];

export default function MaterialsPage() {
  const { referenceData, input, result, setMaterialQuantity, setContingencyPct, setShippingHandling } = useEstimate();

  const qtyByKey = new Map(input.materials.map((m) => [m.key, m.quantity]));
  const lineByKey = new Map(result.materials.lines.map((l) => [l.key, l]));

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl text-navy">Materials</h1>

      {CATEGORIES.map((category) => {
        const items = referenceData.materialItems.filter((m) => m.category === category);
        if (items.length === 0) return null;
        const categoryTotal = result.materials.categoryTotals.find((c) => c.category === category)?.total ?? 0;

        return (
          <div key={category} className="bg-white rounded-lg shadow overflow-hidden">
            <div className="bg-navy-2 text-white px-4 py-2 font-display flex justify-between">
              <span>{category}</span>
              <span>{formatCurrency(categoryTotal)}</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-slate">
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2">Manufacturer / Model</th>
                  <th className="px-4 py-2">Description</th>
                  <th className="px-4 py-2 text-right">Unit Cost</th>
                  <th className="px-4 py-2 text-right">Qty</th>
                  <th className="px-4 py-2 text-right">Ext Cost</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={item.key} className={i % 2 === 0 ? 'bg-white' : 'bg-mist'}>
                    <td className="px-4 py-2">{item.type}</td>
                    <td className="px-4 py-2">{[item.manufacturer, item.model].filter(Boolean).join(' / ')}</td>
                    <td className="px-4 py-2">{item.description}</td>
                    <td className="px-4 py-2 text-right">{formatCurrency(item.unitCost)}</td>
                    <td className="px-4 py-2 text-right">
                      <input
                        type="number"
                        min={0}
                        className="w-20 border border-line rounded px-2 py-1 text-right"
                        value={qtyByKey.get(item.key) ?? 0}
                        onChange={(e) => setMaterialQuantity(item.key, Number(e.target.value))}
                      />
                    </td>
                    <td className="px-4 py-2 text-right">{formatCurrency(lineByKey.get(item.key)?.extCost ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}

      <div className="bg-white rounded-lg shadow p-4 space-y-2">
        <div className="flex justify-between items-center">
          <label className="flex items-center gap-2">
            <span className="text-slate">Contingency %</span>
            <input
              type="number"
              min={0}
              max={100}
              step={0.1}
              className="w-20 border border-line rounded px-2 py-1 text-right"
              value={input.contingencyPct * 100}
              onChange={(e) => setContingencyPct(Number(e.target.value) / 100)}
            />
          </label>
          <span>{formatCurrency(result.materials.contingency)}</span>
        </div>
        <div className="flex justify-between items-center">
          <label className="flex items-center gap-2">
            <span className="text-slate">Estimated S&H</span>
            <input
              type="number"
              min={0}
              className="w-28 border border-line rounded px-2 py-1 text-right"
              value={input.shippingHandling}
              onChange={(e) => setShippingHandling(Number(e.target.value))}
            />
          </label>
        </div>
        <div className="flex justify-between items-center font-display text-lg text-navy border-t border-line pt-2">
          <span>Hardware Total</span>
          <span>{formatCurrency(result.materials.hardwareTotal)}</span>
        </div>
      </div>

      <MoveToButton href="/labor" label="→ Labor" />
    </div>
  );
}
