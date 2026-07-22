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
  /** Rendered above the search bar/table, inside the same card (e.g. a category header). */
  header?: React.ReactNode;
  /** Wraps the table body in a bounded, scrollable region with a sticky header, e.g. 'max-h-[32rem]'. Omit for unbounded rendering. */
  maxBodyHeightClassName?: string;
  /** Shows a search box that filters rows by matching text against every column's rendered value. */
  searchable?: boolean;
  searchPlaceholder?: string;
}

function rowMatchesSearch<Row>(row: Row, columns: AdminColumn<Row>[], needle: string): boolean {
  if (!needle) return true;
  return columns.some((col) => {
    const raw = col.type === 'readonly' && col.format ? col.format(row) : row[col.key];
    return String(raw ?? '').toLowerCase().includes(needle);
  });
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
  header,
  maxBodyHeightClassName,
  searchable = false,
  searchPlaceholder = 'Search…',
}: AdminTableProps<Row>) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [search, setSearch] = useState('');

  const visibleRows = searchable
    ? rows.filter((row) => rowMatchesSearch(row, columns, search.trim().toLowerCase()))
    : rows;

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
    if (col.format) {
      return col.format(row);
    }
    if (col.type === 'checkbox') {
      return row[col.key] ? 'Yes' : 'No';
    }
    if (col.type === 'select') {
      const raw = String(row[col.key] ?? '');
      return col.options?.find((opt) => opt.value === raw)?.label ?? raw;
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
    <div className={cn('bg-white rounded-lg shadow overflow-hidden', !header && 'pt-2')}>
      {header}
      {error && <div className="bg-red/10 text-red-700 px-4 py-2 text-sm">{error}</div>}
      {searchable && (
        <div className="px-4 py-3 border-b border-line">
          <input
            type="search"
            placeholder={searchPlaceholder}
            className="w-full max-w-sm border border-line rounded px-3 py-1.5 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}
      <div className={maxBodyHeightClassName ? cn(maxBodyHeightClassName, 'overflow-y-auto') : undefined}>
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-white">
            <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wide text-slate">
              {columns.map((col) => (
                <th key={col.key} className={cn('px-4 py-2', col.align === 'right' && 'text-right')}>
                  {col.label}
                </th>
              ))}
              <th className="px-4 py-2 text-right whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, i) => {
              const isEditing = editingId === row.id;
              return (
                <tr key={row.id} className={i % 2 === 0 ? 'bg-white' : 'bg-mist'}>
                  {columns.map((col) => (
                    <td key={col.key} className={cn('px-4 py-2', col.align === 'right' && 'text-right')}>
                      {isEditing ? renderInput(col, row) : renderCell(col, row)}
                    </td>
                  ))}
                  <td className="px-4 py-2 text-right whitespace-nowrap space-x-2">
                    {isEditing ? (
                      <>
                        <button disabled={pending} onClick={() => saveEdit(row.id)} className="rounded px-2 py-1 bg-navy text-white text-xs font-semibold hover:bg-navy-2 disabled:opacity-50">Save</button>
                        <button disabled={pending} onClick={cancelEdit} className="rounded px-2 py-1 border border-line text-xs text-slate hover:text-navy hover:border-navy">Cancel</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => startEdit(row)} className="rounded px-2 py-1 border border-line text-xs text-navy hover:bg-mist-2">Edit</button>
                        {onDelete && (
                          <button onClick={() => handleDelete(row.id)} className="rounded px-2 py-1 border border-line text-xs text-red hover:bg-red/10">Delete</button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
            {searchable && visibleRows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="px-4 py-6 text-center text-slate">
                  No rows match your search.
                </td>
              </tr>
            )}
            {adding && (
              <tr className="bg-mist-2">
                {columns.map((col) => (
                  <td key={col.key} className={cn('px-4 py-2', col.align === 'right' && 'text-right')}>
                    {renderInput(col)}
                  </td>
                ))}
                <td className="px-4 py-2 text-right whitespace-nowrap space-x-2">
                  <button disabled={pending} onClick={saveNew} className="rounded px-2 py-1 bg-navy text-white text-xs font-semibold hover:bg-navy-2 disabled:opacity-50">Save</button>
                  <button disabled={pending} onClick={cancelEdit} className="rounded px-2 py-1 border border-line text-xs text-slate hover:text-navy hover:border-navy">Cancel</button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {onCreate && !adding && (
        <div className="px-4 py-3 border-t border-line">
          <button onClick={startAdd} className="text-navy font-display font-semibold hover:text-red">+ Add Row</button>
        </div>
      )}
    </div>
  );
}
