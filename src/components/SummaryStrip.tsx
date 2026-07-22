'use client';

import { useEstimate } from '@/lib/estimate/EstimateContext';
import { formatCurrency } from '@/lib/utils/formatCurrency';

export function SummaryStrip() {
  const { result } = useEstimate();
  const es = result.executiveSummary;

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 bg-navy-deep text-white px-6 py-3 text-sm font-body sticky top-0 z-10">
      <span className="whitespace-nowrap">
        Materials: <strong className="font-display">{formatCurrency(es.totalMaterialBilled)}</strong>
      </span>
      <span className="whitespace-nowrap">
        Labor: <strong className="font-display">{formatCurrency(es.totalProjectLaborBilled)}</strong>
      </span>
      <span className="whitespace-nowrap">
        Pass Throughs: <strong className="font-display">{formatCurrency(es.totalPassThroughBilled)}</strong>
      </span>
      <span className="ml-auto whitespace-nowrap">
        Grand Total to Bid:{' '}
        <strong className="font-display text-white text-lg font-semibold border-b-2 border-red pb-0.5">
          {formatCurrency(es.grandTotalToBidTaxIncluded)}
        </strong>
      </span>
    </div>
  );
}
