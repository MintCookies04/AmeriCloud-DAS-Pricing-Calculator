// src/app/summary/page.tsx
'use client';

import { useState } from 'react';
import { useEstimate } from '@/lib/estimate/EstimateContext';
import { formatCurrency } from '@/lib/utils/formatCurrency';

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between py-1 ${strong ? 'font-display text-navy' : 'text-sm'}`}>
      <span className={strong ? '' : 'text-slate'}>{label}</span>
      <span className={strong ? 'font-semibold' : ''}>{value}</span>
    </div>
  );
}

export default function SummaryPage() {
  const { result, input, setMarkups } = useEstimate();
  const es = result.executiveSummary;
  const [venueVisible, setVenueVisible] = useState(false);
  const [venueSqft, setVenueSqft] = useState(0);

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="font-display text-2xl text-navy">Executive Summary</h1>

      <section className="bg-white rounded-lg shadow p-4">
        <h2 className="font-display text-lg text-navy mb-2">Labor</h2>
        <Row label="Operational Labor" value={formatCurrency(es.operationalLaborCost)} />
        <Row label="Admin Labor" value={formatCurrency(es.opsAdminLaborCost)} />
        <Row label="Travel" value={formatCurrency(es.travelCost)} />
        <Row label="Total Project Labor" value={formatCurrency(es.totalProjectLaborBilled)} strong />
      </section>

      <section className="bg-white rounded-lg shadow p-4">
        <h2 className="font-display text-lg text-navy mb-2">Pass Through</h2>
        <Row label="Per Diem" value={formatCurrency(es.perDiemCost)} />
        <Row label="Lodging" value={formatCurrency(es.lodgingCost)} />
        <Row label="Airfare" value={formatCurrency(es.airfareCost)} />
        <Row label="Rentals" value={formatCurrency(es.rentalsCost)} />
        <Row label="Soft Costs" value={formatCurrency(es.softCostsCost)} />
        <Row label="Total Pass Through Expense" value={formatCurrency(es.totalPassThroughBilled)} strong />
      </section>

      <section className="bg-white rounded-lg shadow p-4">
        <h2 className="font-display text-lg text-navy mb-2">Material</h2>
        <Row label="Consumable" value={formatCurrency(es.consumableCost)} />
        <Row label="DAS Materials" value={formatCurrency(es.dasMaterialsCost)} />
        <Row label="BAT Materials" value={formatCurrency(es.batMaterialsCost)} />
        <Row label="S&H / Material Contingency" value={formatCurrency(es.materialContingencyAndSH)} />
        <Row label="Total Materials" value={formatCurrency(es.totalMaterialBilled)} strong />
      </section>

      <section className="bg-white rounded-lg shadow p-4">
        <h2 className="font-display text-lg text-navy mb-2">Projected Gross Margins</h2>
        <Row label="Total Direct Cost" value={formatCurrency(es.totalDirectCost)} strong />
        <Row label="Projected Gross Profit $$" value={formatCurrency(es.grossProfit)} />
        <Row label="Mark-Up %" value={`${(es.markupPercent * 100).toFixed(1)}%`} />
        <Row label="Gross Margin %" value={`${(es.grossMarginPercent * 100).toFixed(1)}%`} />
        <label className="flex justify-between items-center py-2">
          <span className="text-slate text-sm">Tweak for Margin Target ($)</span>
          <input
            type="number"
            className="w-32 border border-line rounded px-2 py-1 text-right"
            value={input.markups.marginTweak}
            onChange={(e) => setMarkups({ marginTweak: Number(e.target.value) })}
          />
        </label>
      </section>

      <section className="bg-white rounded-lg shadow p-4">
        <h2 className="font-display text-lg text-navy mb-2">Projected Net Margins</h2>
        <Row label="Mark-Up for Corporate" value={formatCurrency(es.corporateMarkupCost)} />
        <Row label="PNM Grand Total" value={formatCurrency(es.projectedNetMarginTotal)} strong />
        <Row label="Projected Net Profit $$" value={formatCurrency(es.netProfit)} />
        <Row label="Net Margin %" value={`${(es.netMarginPercent * 100).toFixed(1)}%`} />
      </section>

      <section className="bg-white rounded-lg shadow p-4">
        <button
          className="text-navy underline text-sm mb-2"
          onClick={() => setVenueVisible((v) => !v)}
        >
          {venueVisible ? 'Hide' : 'Show'} venue $/sqft metrics
        </button>
        {venueVisible && (
          <div>
            <label className="flex justify-between items-center py-1">
              <span className="text-slate text-sm">Venue Covered Sqft</span>
              <input
                type="number"
                className="w-32 border border-line rounded px-2 py-1 text-right"
                value={venueSqft}
                onChange={(e) => setVenueSqft(Number(e.target.value))}
              />
            </label>
            <Row
              label="ACT Quote / sqft"
              value={venueSqft ? formatCurrency(es.grandTotalToBidTaxIncluded / venueSqft) : '—'}
            />
          </div>
        )}
      </section>

      <section className="bg-navy rounded-lg shadow p-6 text-white">
        <Row label="Total Labor to Bid" value={formatCurrency(es.totalLaborToBid)} />
        <Row label="Total Material to Bid" value={formatCurrency(es.totalMaterialToBid)} />
        <div className="flex justify-between items-center pt-3 mt-3 border-t border-white/20">
          <span className="font-display text-lg">Grand Total to Bid (Tax Exempt)</span>
          <span className="font-display text-xl">{formatCurrency(es.grandTotalToBidTaxExempt)}</span>
        </div>
        <Row label={`Tax (${(input.markups.taxRate * 100).toFixed(2)}%)`} value={formatCurrency(es.taxAmount)} />
        <div className="flex justify-between items-center pt-3 mt-3 border-t border-white/20">
          <span className="font-display text-lg">Grand Total to Bid (Tax Included)</span>
          <span className="font-display text-2xl text-red">{formatCurrency(es.grandTotalToBidTaxIncluded)}</span>
        </div>
      </section>
    </div>
  );
}
