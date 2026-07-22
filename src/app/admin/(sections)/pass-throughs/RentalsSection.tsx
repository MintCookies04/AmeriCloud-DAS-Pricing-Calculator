'use client';

import type { RentalRate } from '@prisma/client';
import { AdminTable, type AdminColumn } from '@/components/admin/AdminTable';
import { createRental, updateRental, deleteRental } from './actions';

const columns: AdminColumn<RentalRate>[] = [
  { key: 'key', label: 'Key', type: 'text', required: true },
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'rate', label: 'Rate', type: 'number', align: 'right', required: true },
  { key: 'unit', label: 'Billing Unit', type: 'text', required: true },
];

const emptyValues = { key: '', name: '', rate: '0', unit: '' };

export function RentalsSection({ rows }: { rows: RentalRate[] }) {
  return (
    <section className="space-y-2">
      <h2 className="font-display text-lg text-navy">Rentals</h2>
      <AdminTable<RentalRate>
        columns={columns}
        rows={rows}
        onCreate={createRental}
        onUpdate={updateRental}
        onDelete={deleteRental}
        emptyValues={emptyValues}
      />
    </section>
  );
}
