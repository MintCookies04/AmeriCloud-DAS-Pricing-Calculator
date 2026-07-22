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
});
