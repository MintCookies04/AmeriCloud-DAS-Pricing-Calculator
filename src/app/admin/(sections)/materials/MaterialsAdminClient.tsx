'use client';

import type { MaterialItem, MaterialCategory } from '@prisma/client';
import { AdminTable, type AdminColumn } from '@/components/admin/AdminTable';
import { createMaterial, updateMaterial, deleteMaterial } from './actions';

const CATEGORY_OPTIONS: { value: MaterialCategory; label: string }[] = [
  { value: 'Consumable', label: 'Consumable' },
  { value: 'DAS_Materials', label: 'DAS Materials' },
  { value: 'BAT_Materials', label: 'BAT Materials' },
];

const columns: AdminColumn<MaterialItem>[] = [
  { key: 'key', label: 'Key', type: 'text', required: true },
  { key: 'type', label: 'Type', type: 'text', required: true },
  { key: 'manufacturer', label: 'Manufacturer', type: 'text' },
  { key: 'model', label: 'Model', type: 'text' },
  { key: 'description', label: 'Description', type: 'text', required: true },
  { key: 'vendor', label: 'Vendor', type: 'text' },
  { key: 'category', label: 'Category', type: 'select', options: CATEGORY_OPTIONS, required: true },
  { key: 'unitCost', label: 'Unit Cost', type: 'number', align: 'right', required: true },
];

const emptyValues = {
  key: '', type: '', manufacturer: '', model: '', description: '', vendor: '',
  category: 'Consumable', unitCost: '0',
};

export function MaterialsAdminClient({ rows }: { rows: MaterialItem[] }) {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl text-navy">Material Catalog</h1>
      <AdminTable<MaterialItem>
        columns={columns}
        rows={rows}
        onCreate={createMaterial}
        onUpdate={updateMaterial}
        onDelete={deleteMaterial}
        emptyValues={emptyValues}
      />
    </div>
  );
}
