'use client';

import type { CrewSizeRow } from '@prisma/client';
import { AdminTable, type AdminColumn } from '@/components/admin/AdminTable';
import { updateCrewSizeRow } from './actions';

const columns: AdminColumn<CrewSizeRow>[] = [
  { key: 'technicianCount', label: 'Technicians', type: 'readonly' },
  { key: 'cmsNeeded', label: 'CMs Needed', type: 'number', align: 'right', required: true },
];

export function CrewSizeSection({ rows }: { rows: CrewSizeRow[] }) {
  return (
    <section className="space-y-2">
      <h2 className="font-display text-lg text-navy">Crew-Size Table</h2>
      <AdminTable<CrewSizeRow> columns={columns} rows={rows} onUpdate={updateCrewSizeRow} />
    </section>
  );
}
