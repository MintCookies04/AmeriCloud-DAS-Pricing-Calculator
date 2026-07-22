import { describe, it, expect, afterEach } from 'vitest';
import { prisma } from '@/lib/db';
import { createLaborTask, updateLaborTask, deleteLaborTask } from './actions';

describe('labor task admin actions (integration — requires a live, seeded local Postgres)', () => {
  const createdIds: string[] = [];

  afterEach(async () => {
    for (const id of createdIds.splice(0)) {
      await prisma.laborTask.deleteMany({ where: { id } });
    }
  });

  it('creates a non-derived labor task with valid values', async () => {
    const result = await createLaborTask({
      key: 'test-admin-task-1', sheet: 'LOE', category: 'Test Category', name: 'Test Task',
      minutesPerUnit: '15', unit: 'Each', laborRole: 'Technician', includedInSubtotal: 'true',
    });
    expect(result.error).toBeUndefined();

    const created = await prisma.laborTask.findUnique({ where: { key: 'test-admin-task-1' } });
    if (created) createdIds.push(created.id);
    expect(created).toMatchObject({ sheet: 'LOE', minutesPerUnit: 15, laborRole: 'Technician' });
    expect(created?.derivedFromJson).toBeNull();
  });

  it('rejects an invalid labor role', async () => {
    const result = await createLaborTask({
      key: 'test-admin-task-badrole', sheet: 'LOE', category: 'C', name: 'N',
      minutesPerUnit: '1', unit: 'Each', laborRole: 'Not A Role', includedInSubtotal: 'false',
    });
    expect(result.error).toMatch(/labor role/i);
  });

  it('rejects a negative minutesPerUnit', async () => {
    const result = await createLaborTask({
      key: 'test-admin-task-negative', sheet: 'LOE', category: 'C', name: 'N',
      minutesPerUnit: '-1', unit: 'Each', laborRole: 'Technician', includedInSubtotal: 'false',
    });
    expect(result.error).toMatch(/non-negative/);
  });

  it('updates a task without touching its existing derivedFromJson', async () => {
    const created = await prisma.laborTask.create({
      data: {
        key: 'test-admin-task-derived', sheet: 'LOE', category: 'C', name: 'N',
        minutesPerUnit: 1, unit: 'Each', laborRole: 'Technician', includedInSubtotal: true,
        derivedFromJson: { terms: [{ key: 'loe-21', coeff: 1 }], divisor: 1 },
      },
    });
    createdIds.push(created.id);

    const result = await updateLaborTask(created.id, {
      key: 'test-admin-task-derived', sheet: 'LOE', category: 'Updated', name: 'Updated Name',
      minutesPerUnit: '2', unit: 'Each', laborRole: 'Technician', includedInSubtotal: 'true',
    });
    expect(result.error).toBeUndefined();

    const updated = await prisma.laborTask.findUnique({ where: { id: created.id } });
    expect(updated).toMatchObject({ category: 'Updated', name: 'Updated Name', minutesPerUnit: 2 });
    expect(updated?.derivedFromJson).toEqual({ terms: [{ key: 'loe-21', coeff: 1 }], divisor: 1 });
  });

  it('blocks deleting a task that another task\'s derivation formula references', async () => {
    const source = await prisma.laborTask.create({
      data: {
        key: 'test-admin-task-source', sheet: 'LOE', category: 'C', name: 'Source',
        minutesPerUnit: 1, unit: 'Each', laborRole: 'Technician', includedInSubtotal: true,
      },
    });
    createdIds.push(source.id);
    const derived = await prisma.laborTask.create({
      data: {
        key: 'test-admin-task-derived-2', sheet: 'LOE', category: 'C', name: 'Derived',
        minutesPerUnit: 1, unit: 'Each', laborRole: 'Technician', includedInSubtotal: true,
        derivedFromJson: { terms: [{ key: 'test-admin-task-source', coeff: 1 }], divisor: 1 },
      },
    });
    createdIds.push(derived.id);

    const result = await deleteLaborTask(source.id);
    expect(result.error).toMatch(/test-admin-task-derived-2/);

    const stillThere = await prisma.laborTask.findUnique({ where: { id: source.id } });
    expect(stillThere).not.toBeNull();
  });

  it('allows deleting a task nothing else derives from', async () => {
    const created = await prisma.laborTask.create({
      data: {
        key: 'test-admin-task-deletable', sheet: 'SOW', category: 'C', name: 'N',
        minutesPerUnit: 1, unit: 'Each', laborRole: 'Technician', includedInSubtotal: true,
      },
    });
    // Register for cleanup BEFORE calling the function under test — if deleteLaborTask
    // itself fails or the assertion below throws, afterEach's deleteMany still cleans up
    // (it's a no-op if the row was already deleted successfully).
    createdIds.push(created.id);

    const result = await deleteLaborTask(created.id);
    expect(result.error).toBeUndefined();

    const gone = await prisma.laborTask.findUnique({ where: { id: created.id } });
    expect(gone).toBeNull();
  });
});
