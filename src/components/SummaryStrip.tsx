'use client';

import { useEstimate } from '@/lib/estimate/EstimateContext';
import { formatCurrency } from '@/lib/utils/formatCurrency';

export function SummaryStrip() {
  const { result } = useEstimate();
  const es = result.executiveSummary;

  return (
    <div className="flex items-center gap-8 bg-navy-deep text-white px-6 py-3 text-sm font-body sticky top-0 z-10">
      <span>
        Materials: <strong className="font-display">{formatCurrency(es.totalMaterialBilled)}</strong>
      </span>
      <span>
        Labor: <strong className="font-display">{formatCurrency(es.totalProjectLaborBilled)}</strong>
      </span>
      <span>
        Pass Throughs: <strong className="font-display">{formatCurrency(es.totalPassThroughBilled)}</strong>
      </span>
      <span className="ml-auto">
        Grand Total to Bid: <strong className="font-display text-red text-base">{formatCurrency(es.grandTotalToBidTaxIncluded)}</strong>
      </span>
    </div>
  );
}
