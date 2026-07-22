'use client';

import type { PassThroughRoleRate } from '@prisma/client';
import { AdminTable, type AdminColumn } from '@/components/admin/AdminTable';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { updatePassThroughRoleRate } from './actions';

const ROLE_LABELS: Record<string, string> = {
  Technician: 'Technician',
  Construction_Manager: 'Construction Manager',
  RF_Engineer: 'RF-Engineer',
  RF_Technician: 'RF-Technician',
  Project_Coordinator: 'Project Coordinator',
  Project_Manager: 'Project Manager',
};

const columns: AdminColumn<PassThroughRoleRate>[] = [
  { key: 'kind', label: 'Kind', type: 'readonly' },
  { key: 'role', label: 'Role', type: 'readonly', format: (row) => ROLE_LABELS[row.role] ?? row.role },
  { key: 'amount', label: 'Amount', type: 'number', align: 'right', required: true, format: (row) => formatCurrency(row.amount) },
];

export function PassThroughRatesSection({ rows }: { rows: PassThroughRoleRate[] }) {
  return (
    <section className="space-y-2">
      <h2 className="font-display text-lg font-semibold text-navy">Per Diem / Lodging / Airfare Rates</h2>
      <AdminTable<PassThroughRoleRate> columns={columns} rows={rows} onUpdate={updatePassThroughRoleRate} />
    </section>
  );
}
