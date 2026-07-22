'use client';

import type { LaborRate } from '@prisma/client';
import { AdminTable, type AdminColumn } from '@/components/admin/AdminTable';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { updateLaborRate } from './actions';

const ROLE_LABELS: Record<string, string> = {
  Technician: 'Technician',
  Construction_Manager: 'Construction Manager',
  RF_Engineer: 'RF-Engineer',
  RF_Technician: 'RF-Technician',
  Project_Coordinator: 'Project Coordinator',
  Project_Manager: 'Project Manager',
};

function formatHourly(amount: number): string {
  return `${formatCurrency(amount)}/hr`;
}

const columns: AdminColumn<LaborRate>[] = [
  { key: 'role', label: 'Role', type: 'readonly', format: (row) => ROLE_LABELS[row.role] ?? row.role },
  { key: 'hourlyRate', label: 'Hourly (Billing) Rate', type: 'number', align: 'right', required: true, format: (row) => formatHourly(row.hourlyRate) },
  { key: 'rawWageRate', label: 'Raw Wage Rate', type: 'number', align: 'right', required: true, format: (row) => formatHourly(row.rawWageRate) },
];

export function LaborRatesSection({ rows }: { rows: LaborRate[] }) {
  return (
    <section className="space-y-2">
      <h2 className="font-display text-lg font-semibold text-navy">Labor Rates</h2>
      <AdminTable<LaborRate> columns={columns} rows={rows} onUpdate={updateLaborRate} />
    </section>
  );
}
