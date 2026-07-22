import { describe, it, expect, afterEach, vi } from 'vitest';
import { prisma } from '@/lib/db';
import {
  updatePassThroughRoleRate, createRental, updateRental, deleteRental,
  createSoftCost, updateSoftCost, deleteSoftCost,
} from './actions';

vi.mock('@/lib/auth/adminAuth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/adminAuth')>();
  return { ...actual, requireAdminSession: vi.fn().mockResolvedValue(true) };
});

describe('pass-throughs admin actions (integration — requires a live, seeded local Postgres)', () => {
  const restoreRoleRates: { id: string; amount: number }[] = [];
  const createdRentalIds: string[] = [];
  const createdSoftCostIds: string[] = [];

  afterEach(async () => {
    for (const r of restoreRoleRates.splice(0)) {
      await prisma.passThroughRoleRate.update({ where: { id: r.id }, data: { amount: r.amount } });
    }
    for (const id of createdRentalIds.splice(0)) {
      await prisma.rentalRate.deleteMany({ where: { id } });
    }
    for (const id of createdSoftCostIds.splice(0)) {
      await prisma.softCostRate.deleteMany({ where: { id } });
    }
  });

  it('updates a pass-through role rate', async () => {
    const original = await prisma.passThroughRoleRate.findFirstOrThrow({
      where: { kind: 'PerDiem', role: 'Technician' },
    });
    restoreRoleRates.push({ id: original.id, amount: original.amount });

    const result = await updatePassThroughRoleRate(original.id, { amount: '75' });
    expect(result.error).toBeUndefined();

    const updated = await prisma.passThroughRoleRate.findUniqueOrThrow({ where: { id: original.id } });
    expect(updated.amount).toBe(75);
  });

  it('rejects a negative pass-through role rate', async () => {
    const original = await prisma.passThroughRoleRate.findFirstOrThrow({
      where: { kind: 'PerDiem', role: 'Technician' },
    });
    const result = await updatePassThroughRoleRate(original.id, { amount: '-1' });
    expect(result.error).toMatch(/non-negative/);
  });

  it('creates, updates, and deletes a rental', async () => {
    const created = await createRental({ key: 'test-admin-rental-1', name: 'Test Rental', rate: '100', unit: 'day' });
    expect(created.error).toBeUndefined();
    const row = await prisma.rentalRate.findUniqueOrThrow({ where: { key: 'test-admin-rental-1' } });
    createdRentalIds.push(row.id);

    const updated = await updateRental(row.id, { key: 'test-admin-rental-1', name: 'Updated Rental', rate: '150', unit: 'day' });
    expect(updated.error).toBeUndefined();

    const deleted = await deleteRental(row.id);
    expect(deleted.error).toBeUndefined();
    createdRentalIds.splice(createdRentalIds.indexOf(row.id), 1);

    const gone = await prisma.rentalRate.findUnique({ where: { id: row.id } });
    expect(gone).toBeNull();
  });

  it('creates, updates, and deletes a soft cost', async () => {
    const created = await createSoftCost({ key: 'test-admin-softcost-1', name: 'Test Soft Cost', fee: '500' });
    expect(created.error).toBeUndefined();
    const row = await prisma.softCostRate.findUniqueOrThrow({ where: { key: 'test-admin-softcost-1' } });
    createdSoftCostIds.push(row.id);

    const updated = await updateSoftCost(row.id, { key: 'test-admin-softcost-1', name: 'Updated', fee: '600' });
    expect(updated.error).toBeUndefined();

    const deleted = await deleteSoftCost(row.id);
    expect(deleted.error).toBeUndefined();
    createdSoftCostIds.splice(createdSoftCostIds.indexOf(row.id), 1);

    const gone = await prisma.softCostRate.findUnique({ where: { id: row.id } });
    expect(gone).toBeNull();
  });

  it('rejects a duplicate rental key', async () => {
    const created = await createRental({ key: 'test-admin-rental-dup', name: 'A', rate: '1', unit: 'day' });
    expect(created.error).toBeUndefined();
    const row = await prisma.rentalRate.findUniqueOrThrow({ where: { key: 'test-admin-rental-dup' } });
    createdRentalIds.push(row.id);

    const dup = await createRental({ key: 'test-admin-rental-dup', name: 'B', rate: '2', unit: 'day' });
    expect(dup.error).toMatch(/already exists/);
  });
});
