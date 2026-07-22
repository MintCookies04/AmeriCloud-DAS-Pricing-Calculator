'use client';

import type { LaborTask, LaborRoleName } from '@prisma/client';
import { AdminTable, type AdminColumn } from '@/components/admin/AdminTable';
import { parseDerivedFrom } from '@/lib/data/loadReferenceData';
import { createLaborTask, updateLaborTask, deleteLaborTask } from './actions';

const SHEET_OPTIONS = [
  { value: 'LOE', label: 'LOE' },
  { value: 'SOW', label: 'SOW' },
];

const ROLE_OPTIONS: { value: LaborRoleName; label: string }[] = [
  { value: 'Technician', label: 'Technician' },
  { value: 'Construction_Manager', label: 'Construction Manager' },
  { value: 'RF_Engineer', label: 'RF-Engineer' },
  { value: 'RF_Technician', label: 'RF-Technician' },
  { value: 'Project_Coordinator', label: 'Project Coordinator' },
  { value: 'Project_Manager', label: 'Project Manager' },
];

function formatDerivation(row: LaborTask): string {
  try {
    const derived = parseDerivedFrom(row.derivedFromJson, row.key);
    if (!derived) return '—';
    const termsText = derived.terms.map((t) => (t.coeff === 1 ? t.key : `${t.coeff}×${t.key}`)).join(' + ');
    return derived.divisor === 1 ? `= ${termsText}` : `= (${termsText}) ÷ ${derived.divisor}`;
  } catch {
    return '⚠ malformed';
  }
}

const columns: AdminColumn<LaborTask>[] = [
  { key: 'key', label: 'Key', type: 'text', required: true },
  { key: 'sheet', label: 'Sheet', type: 'select', options: SHEET_OPTIONS, required: true },
  { key: 'category', label: 'Category', type: 'text', required: true },
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'minutesPerUnit', label: 'Minutes/Unit', type: 'number', align: 'right', required: true },
  { key: 'unit', label: 'Unit', type: 'text', required: true },
  { key: 'laborRole', label: 'Labor Role', type: 'select', options: ROLE_OPTIONS, required: true },
  { key: 'includedInSubtotal', label: 'In Subtotal', type: 'checkbox' },
  { key: 'derivedFromJson', label: 'Derived Quantity', type: 'readonly', format: formatDerivation },
];

const emptyValues = {
  key: '', sheet: 'LOE', category: '', name: '', minutesPerUnit: '0', unit: '',
  laborRole: 'Technician', includedInSubtotal: 'false',
};

export function LaborTasksAdminClient({ rows }: { rows: LaborTask[] }) {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl text-navy">Labor Task Library</h1>
      <AdminTable<LaborTask>
        columns={columns}
        rows={rows}
        onCreate={createLaborTask}
        onUpdate={updateLaborTask}
        onDelete={deleteLaborTask}
        emptyValues={emptyValues}
      />
    </div>
  );
}
