'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils/cn';

export type AdminColumnType = 'text' | 'number' | 'select' | 'checkbox' | 'readonly';

export interface AdminColumn<Row> {
  key: Extract<keyof Row, string>;
  label: string;
  type: AdminColumnType;
  required?: boolean;
  options?: { value: string; label: string }[];
  align?: 'left' | 'right';
  format?: (row: Row) => string;
}

export interface AdminTableProps<Row extends { id: string }> {
  columns: AdminColumn<Row>[];
  rows: Row[];
  onCreate?: (values: Record<string, string>) => Promise<{ error?: string }>;
  onUpdate: (id: string, values: Record<string, string>) => Promise<{ error?: string }>;
  onDelete?: (id: string) => Promise<{ error?: string }>;
  emptyValues?: Record<string, string>;
}

function rowToValues<Row>(row: Row, columns: AdminColumn<Row>[]): Record<string, string> {
  const values: Record<string, string> = {};
  for (const col of columns) {
    if (col.type === 'readonly') continue;
    const raw = row[col.key];
    values[col.key] = col.type === 'checkbox' ? String(Boolean(raw)) : String(raw ?? '');
  }
  return values;
}

export function AdminTable<Row extends { id: string }>({
  columns,
  rows,
  onCreate,
  onUpdate,
  onDelete,
  emptyValues = {},
}: AdminTableProps<Row>) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function startEdit(row: Row) {
    setEditingId(row.id);
    setAdding(false);
    setDraft(rowToValues(row, columns));
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setAdding(false);
    setError(null);
  }

  function startAdd() {
    setAdding(true);
    setEditingId(null);
    setDraft({ ...emptyValues });
    setError(null);
  }

  async function saveEdit(id: string) {
    setPending(true);
    setError(null);
    const result = await onUpdate(id, draft);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setEditingId(null);
    router.refresh();
  }

  async function saveNew() {
    if (!onCreate) return;
    setPending(true);
    setError(null);
    const result = await onCreate(draft);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setAdding(false);
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!onDelete) return;
    if (!window.confirm('Delete this row? This cannot be undone.')) return;
    setPending(true);
    setError(null);
    const result = await onDelete(id);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  function renderCell(col: AdminColumn<Row>, row: Row) {
    if (col.type === 'readonly') {
      return <span className="text-slate">{col.format ? col.format(row) : String(row[col.key] ?? '')}</span>;
    }
    if (col.type === 'checkbox') {
      return row[col.key] ? 'Yes' : 'No';
    }
    return String(row[col.key] ?? '');
  }

  function renderInput(col: AdminColumn<Row>, row?: Row) {
    if (col.type === 'readonly') {
      return (
        <span className="text-slate">
          {row ? (col.format ? col.format(row) : String(row[col.key] ?? '')) : '—'}
        </span>
      );
    }
    if (col.type === 'checkbox') {
      return (
        <input
          type="checkbox"
          checked={draft[col.key] === 'true'}
          onChange={(e) => setDraft((d) => ({ ...d, [col.key]: String(e.target.checked) }))}
        />
      );
    }
    if (col.type === 'select') {
      return (
        <select
          className="w-full border border-line rounded px-2 py-1"
          value={draft[col.key] ?? ''}
          onChange={(e) => setDraft((d) => ({ ...d, [col.key]: e.target.value }))}
        >
          {(col.options ?? []).map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      );
    }
    return (
      <input
        type={col.type === 'number' ? 'number' : 'text'}
        required={col.required}
        className={cn('w-full border border-line rounded px-2 py-1', col.align === 'right' && 'text-right')}
        value={draft[col.key] ?? ''}
        onChange={(e) => setDraft((d) => ({ ...d, [col.key]: e.target.value }))}
      />
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {error && <div className="bg-red/10 text-red-700 px-4 py-2 text-sm">{error}</div>}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-slate">
            {columns.map((col) => (
              <th key={col.key} className={cn('px-4 py-2', col.align === 'right' && 'text-right')}>
                {col.label}
              </th>
            ))}
            <th className="px-4 py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const isEditing = editingId === row.id;
            return (
              <tr key={row.id} className={i % 2 === 0 ? 'bg-white' : 'bg-mist'}>
                {columns.map((col) => (
                  <td key={col.key} className={cn('px-4 py-2', col.align === 'right' && 'text-right')}>
                    {isEditing ? renderInput(col, row) : renderCell(col, row)}
                  </td>
                ))}
                <td className="px-4 py-2 text-right space-x-2">
                  {isEditing ? (
                    <>
                      <button disabled={pending} onClick={() => saveEdit(row.id)} className="text-navy hover:text-red">Save</button>
                      <button disabled={pending} onClick={cancelEdit} className="text-slate hover:text-navy">Cancel</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => startEdit(row)} className="text-navy hover:text-red">Edit</button>
                      {onDelete && (
                        <button onClick={() => handleDelete(row.id)} className="text-slate hover:text-red">Delete</button>
                      )}
                    </>
                  )}
                </td>
              </tr>
            );
          })}
          {adding && (
            <tr className="bg-mist-2">
              {columns.map((col) => (
                <td key={col.key} className={cn('px-4 py-2', col.align === 'right' && 'text-right')}>
                  {renderInput(col)}
                </td>
              ))}
              <td className="px-4 py-2 text-right space-x-2">
                <button disabled={pending} onClick={saveNew} className="text-navy hover:text-red">Save</button>
                <button disabled={pending} onClick={cancelEdit} className="text-slate hover:text-navy">Cancel</button>
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {onCreate && !adding && (
        <div className="px-4 py-3 border-t border-line">
          <button onClick={startAdd} className="text-navy font-display font-semibold hover:text-red">+ Add Row</button>
        </div>
      )}
    </div>
  );
}
