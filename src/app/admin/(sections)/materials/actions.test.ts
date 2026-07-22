import { describe, it, expect, afterEach } from 'vitest';
import { prisma } from '@/lib/db';
import { createMaterial, updateMaterial, deleteMaterial } from './actions';

describe('material admin actions (integration — requires a live, seeded local Postgres)', () => {
  const createdIds: string[] = [];

  afterEach(async () => {
    for (const id of createdIds.splice(0)) {
      await prisma.materialItem.deleteMany({ where: { id } });
    }
  });

  it('creates a material with valid values', async () => {
    const result = await createMaterial({
      key: 'test-admin-material-1',
      type: 'Test Type',
      manufacturer: 'Test Mfr',
      model: 'TM-1',
      description: 'A test material',
      vendor: 'Test Vendor',
      category: 'Consumable',
      unitCost: '12.5',
    });
    expect(result.error).toBeUndefined();

    const created = await prisma.materialItem.findUnique({ where: { key: 'test-admin-material-1' } });
    expect(created).toMatchObject({ type: 'Test Type', unitCost: 12.5, category: 'Consumable' });
    if (created) createdIds.push(created.id);
  });

  it('rejects a duplicate key', async () => {
    const first = await createMaterial({
      key: 'test-admin-material-dup',
      type: 'T', description: 'D', category: 'Consumable', unitCost: '1',
      manufacturer: '', model: '', vendor: '',
    });
    expect(first.error).toBeUndefined();
    const created = await prisma.materialItem.findUnique({ where: { key: 'test-admin-material-dup' } });
    if (created) createdIds.push(created.id);

    const second = await createMaterial({
      key: 'test-admin-material-dup',
      type: 'T2', description: 'D2', category: 'Consumable', unitCost: '2',
      manufacturer: '', model: '', vendor: '',
    });
    expect(second.error).toMatch(/already exists/);
  });

  it('rejects a negative unit cost', async () => {
    const result = await createMaterial({
      key: 'test-admin-material-negative',
      type: 'T', description: 'D', category: 'Consumable', unitCost: '-5',
      manufacturer: '', model: '', vendor: '',
    });
    expect(result.error).toMatch(/non-negative/);
  });

  it('updates an existing material', async () => {
    const created = await prisma.materialItem.create({
      data: {
        key: 'test-admin-material-update', type: 'T', description: 'D',
        category: 'Consumable', unitCost: 1,
      },
    });
    createdIds.push(created.id);

    const result = await updateMaterial(created.id, {
      key: 'test-admin-material-update', type: 'Updated Type', description: 'Updated',
      category: 'DAS_Materials', unitCost: '99.99', manufacturer: '', model: '', vendor: '',
    });
    expect(result.error).toBeUndefined();

    const updated = await prisma.materialItem.findUnique({ where: { id: created.id } });
    expect(updated).toMatchObject({ type: 'Updated Type', unitCost: 99.99, category: 'DAS_Materials' });
  });

  it('deletes a material', async () => {
    const created = await prisma.materialItem.create({
      data: { key: 'test-admin-material-delete', type: 'T', description: 'D', category: 'Consumable', unitCost: 1 },
    });

    const result = await deleteMaterial(created.id);
    expect(result.error).toBeUndefined();

    const gone = await prisma.materialItem.findUnique({ where: { id: created.id } });
    expect(gone).toBeNull();
  });
});
