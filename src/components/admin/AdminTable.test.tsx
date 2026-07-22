/// <reference types="@testing-library/jest-dom" />
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdminTable } from './AdminTable';
import type { AdminColumn } from './AdminTable';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

interface TestRow {
  id: string;
  name: string;
  cost: number;
}

const columns: AdminColumn<TestRow>[] = [
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'cost', label: 'Cost', type: 'number', align: 'right' },
];

interface ReadonlyRow {
  id: string;
  name: string;
  total: number;
}

const readonlyColumns: AdminColumn<ReadonlyRow>[] = [
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'total', label: 'Total', type: 'readonly', format: (row) => `$${row.total.toFixed(2)}` },
];

interface CheckboxRow {
  id: string;
  name: string;
  active: boolean;
}

const checkboxColumns: AdminColumn<CheckboxRow>[] = [
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'active', label: 'Active', type: 'checkbox' },
];

interface SelectRow {
  id: string;
  name: string;
  status: string;
}

const selectColumns: AdminColumn<SelectRow>[] = [
  { key: 'name', label: 'Name', type: 'text', required: true },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { value: 'open', label: 'Open' },
      { value: 'closed', label: 'Closed' },
    ],
  },
];

describe('AdminTable', () => {
  it('renders existing rows', () => {
    render(
      <AdminTable<TestRow>
        columns={columns}
        rows={[{ id: '1', name: 'Widget', cost: 10 }]}
        onUpdate={vi.fn().mockResolvedValue({})}
      />,
    );
    expect(screen.getByText('Widget')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('edits a row and calls onUpdate with the new values', async () => {
    const onUpdate = vi.fn().mockResolvedValue({});
    render(
      <AdminTable<TestRow>
        columns={columns}
        rows={[{ id: '1', name: 'Widget', cost: 10 }]}
        onUpdate={onUpdate}
      />,
    );
    fireEvent.click(screen.getByText('Edit'));
    fireEvent.change(screen.getByDisplayValue('Widget'), { target: { value: 'Gadget' } });
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith('1', { name: 'Gadget', cost: '10' }));
  });

  it('shows an inline error and stays in edit mode when onUpdate fails validation', async () => {
    const onUpdate = vi.fn().mockResolvedValue({ error: 'Cost must be positive' });
    render(
      <AdminTable<TestRow>
        columns={columns}
        rows={[{ id: '1', name: 'Widget', cost: 10 }]}
        onUpdate={onUpdate}
      />,
    );
    fireEvent.click(screen.getByText('Edit'));
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(screen.getByText('Cost must be positive')).toBeInTheDocument());
    expect(screen.queryByDisplayValue('Widget')).toBeTruthy(); // still editing
  });

  it('adds a new row via onCreate when provided', async () => {
    const onCreate = vi.fn().mockResolvedValue({});
    render(
      <AdminTable<TestRow>
        columns={columns}
        rows={[]}
        onUpdate={vi.fn()}
        onCreate={onCreate}
        emptyValues={{ name: '', cost: '0' }}
      />,
    );
    fireEvent.click(screen.getByText('+ Add Row'));
    fireEvent.change(screen.getAllByRole('textbox')[0]!, { target: { value: 'New Item' } });
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(onCreate).toHaveBeenCalledWith({ name: 'New Item', cost: '0' }));
  });

  it('hides Add and Delete controls when onCreate/onDelete are not provided', () => {
    render(
      <AdminTable<TestRow>
        columns={columns}
        rows={[{ id: '1', name: 'Widget', cost: 10 }]}
        onUpdate={vi.fn()}
      />,
    );
    expect(screen.queryByText('+ Add Row')).not.toBeInTheDocument();
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
  });

  it('renders a formatted readonly column value in view mode', () => {
    render(
      <AdminTable<ReadonlyRow>
        columns={readonlyColumns}
        rows={[{ id: '1', name: 'Widget', total: 42 }]}
        onUpdate={vi.fn().mockResolvedValue({})}
      />,
    );
    expect(screen.getByText('$42.00')).toBeInTheDocument();
  });

  it('renders a placeholder for a readonly column while adding a new row (no row available yet)', () => {
    render(
      <AdminTable<ReadonlyRow>
        columns={readonlyColumns}
        rows={[]}
        onUpdate={vi.fn()}
        onCreate={vi.fn().mockResolvedValue({})}
        emptyValues={{ name: '' }}
      />,
    );
    fireEvent.click(screen.getByText('+ Add Row'));
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('renders Yes/No in view mode and a working checkbox in edit mode for a checkbox column', async () => {
    const onUpdate = vi.fn().mockResolvedValue({});
    render(
      <AdminTable<CheckboxRow>
        columns={checkboxColumns}
        rows={[{ id: '1', name: 'Widget', active: false }]}
        onUpdate={onUpdate}
      />,
    );
    expect(screen.getByText('No')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Edit'));
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();

    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith('1', { name: 'Widget', active: 'true' }));
  });

  it('renders a select with the given options in edit mode and updates the draft on change', async () => {
    const onUpdate = vi.fn().mockResolvedValue({});
    render(
      <AdminTable<SelectRow>
        columns={selectColumns}
        rows={[{ id: '1', name: 'Widget', status: 'open' }]}
        onUpdate={onUpdate}
      />,
    );

    fireEvent.click(screen.getByText('Edit'));
    const select = screen.getByRole('combobox');
    expect(screen.getByRole('option', { name: 'Open' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Closed' })).toBeInTheDocument();

    fireEvent.change(select, { target: { value: 'closed' } });
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith('1', { name: 'Widget', status: 'closed' }));
  });

  it('starting an edit cancels an in-progress add, so the add row and edit row never share a draft', async () => {
    const onUpdate = vi.fn().mockResolvedValue({});
    const onCreate = vi.fn().mockResolvedValue({});
    render(
      <AdminTable<TestRow>
        columns={columns}
        rows={[{ id: '1', name: 'Widget', cost: 10 }]}
        onUpdate={onUpdate}
        onCreate={onCreate}
        emptyValues={{ name: '', cost: '0' }}
      />,
    );

    // Start adding a new row first.
    fireEvent.click(screen.getByText('+ Add Row'));

    // Then start editing the existing row without saving/cancelling the add.
    fireEvent.click(screen.getByText('Edit'));

    // Only one row (the edit row) should be in edit state - the add row must have been cancelled,
    // not left rendering side-by-side and bound to the same draft.
    expect(screen.getAllByText('Save')).toHaveLength(1);
    expect(screen.getAllByText('Cancel')).toHaveLength(1);
    expect(screen.getByDisplayValue('Widget')).toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue('Widget'), { target: { value: 'Gadget' } });
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith('1', { name: 'Gadget', cost: '10' }));
    expect(onCreate).not.toHaveBeenCalled();
  });
});
