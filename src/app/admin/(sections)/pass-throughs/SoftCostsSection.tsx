'use client';

import type { SoftCostRate } from '@prisma/client';
import { AdminTable, type AdminColumn } from '@/components/admin/AdminTable';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { createSoftCost, updateSoftCost, deleteSoftCost } from './actions';

const columns: AdminColumn<SoftCostRate>[] = [
  { key: 'key', label: 'Key', type: 'text', required: true },
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'fee', label: 'Fee', type: 'number', align: 'right', required: true, format: (row) => formatCurrency(row.fee) },
];

const emptyValues = { key: '', name: '', fee: '0' };

export function SoftCostsSection({ rows }: { rows: SoftCostRate[] }) {
  return (
    <section className="space-y-2">
      <h2 className="font-display text-lg font-semibold text-navy">Soft Costs</h2>
      <AdminTable<SoftCostRate>
        columns={columns}
        rows={rows}
        onCreate={createSoftCost}
        onUpdate={updateSoftCost}
        onDelete={deleteSoftCost}
        emptyValues={emptyValues}
      />
    </section>
  );
}
