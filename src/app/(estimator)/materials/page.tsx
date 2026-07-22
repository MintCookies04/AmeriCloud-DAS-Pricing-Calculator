// src/app/materials/page.tsx
'use client';

import { useState } from 'react';
import { useEstimate } from '@/lib/estimate/EstimateContext';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { parseNumericInput } from '@/lib/utils/parseNumericInput';
import { MoveToButton } from '@/components/MoveToButton';
import type { MaterialCategory } from '@/lib/calc';

const CATEGORIES: MaterialCategory[] = ['Consumable', 'DAS Materials', 'BAT Materials'];

function scrollToCategory(category: MaterialCategory) {
  document.getElementById(`category-${category}`)?.scrollIntoView({ behavior: 'instant', block: 'start' });
}

export default function MaterialsPage() {
  const { referenceData, input, result, setMaterialQuantity, setContingencyPct, setShippingHandling } = useEstimate();
  const [search, setSearch] = useState('');
  const [onlyWithQty, setOnlyWithQty] = useState(false);

  const qtyByKey = new Map(input.materials.map((m) => [m.key, m.quantity]));
  const lineByKey = new Map(result.materials.lines.map((l) => [l.key, l]));
  const needle = search.trim().toLowerCase();
  const presentCategories = CATEGORIES.filter((category) =>
    referenceData.materialItems.some((m) => m.category === category),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold tracking-tight text-navy">Materials</h1>
        <div className="flex flex-wrap items-center gap-2">
          {presentCategories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => scrollToCategory(category)}
              className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-slate hover:border-navy hover:text-navy transition-colors"
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-slate">
          <input type="checkbox" checked={onlyWithQty} onChange={(e) => setOnlyWithQty(e.target.checked)} />
          Only show items with qty
        </label>
        <input
          type="search"
          placeholder="Search type, manufacturer, model, description…"
          className="w-full sm:w-80 border border-line rounded px-3 py-1.5 text-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {CATEGORIES.map((category) => {
        const allItems = referenceData.materialItems.filter((m) => m.category === category);
        if (allItems.length === 0) return null;
        const items = allItems.filter((item) => {
          if (onlyWithQty && !(qtyByKey.get(item.key) ?? 0)) return false;
          if (!needle) return true;
          const haystack = [item.type, item.manufacturer, item.model, item.description]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          return haystack.includes(needle);
        });
        const categoryTotal = result.materials.categoryTotals.find((c) => c.category === category)?.total ?? 0;

        return (
          <div key={category} id={`category-${category}`} className="bg-white rounded-lg shadow overflow-hidden scroll-mt-4">
            <div className="bg-navy-2 text-white px-4 py-3 font-display flex justify-between">
              <span>{category}</span>
              <span>{formatCurrency(categoryTotal)}</span>
            </div>
            {items.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate text-center">No items match your filter.</p>
            ) : (
              <div className="max-h-[28rem] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-white">
                    <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wide text-slate">
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
                            onChange={(e) => setMaterialQuantity(item.key, parseNumericInput(e.target.value))}
                          />
                        </td>
                        <td className="px-4 py-2 text-right">{formatCurrency(lineByKey.get(item.key)?.extCost ?? 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}

      <div className="sticky bottom-0 z-10 bg-white rounded-lg shadow-lg border border-line p-4 space-y-2">
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
              onChange={(e) => setContingencyPct(parseNumericInput(e.target.value) / 100)}
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
              onChange={(e) => setShippingHandling(parseNumericInput(e.target.value))}
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
