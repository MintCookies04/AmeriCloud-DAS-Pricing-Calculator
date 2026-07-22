import { describe, it, expect, afterEach, vi } from 'vitest';
import { prisma } from '@/lib/db';
import { updateEstimateDefaults } from './actions';

vi.mock('@/lib/auth/adminAuth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/adminAuth')>();
  return { ...actual, requireAdminSession: vi.fn().mockResolvedValue(true) };
});

describe('estimate defaults admin actions (integration — requires a live, seeded local Postgres)', () => {
  let restore: Record<string, number> | null = null;

  afterEach(async () => {
    if (restore) {
      await prisma.estimateDefaults.update({ where: { id: 'singleton' }, data: restore });
      restore = null;
    }
  });

  it('updates estimate defaults, converting percent inputs to fractions', async () => {
    const original = await prisma.estimateDefaults.findUniqueOrThrow({ where: { id: 'singleton' } });
    restore = {
      laborMarkupPct: original.laborMarkupPct,
      passThroughMarkupPct: original.passThroughMarkupPct,
      materialMarkupPct: original.materialMarkupPct,
      corporateMarkupPct: original.corporateMarkupPct,
      taxRate: original.taxRate,
      contingencyPct: original.contingencyPct,
    };

    const result = await updateEstimateDefaults({
      laborMarkupPct: '30', passThroughMarkupPct: '20', materialMarkupPct: '25',
      corporateMarkupPct: '5', taxRate: '8.25', contingencyPct: '10',
    });
    expect(result.error).toBeUndefined();

    const updated = await prisma.estimateDefaults.findUniqueOrThrow({ where: { id: 'singleton' } });
    expect(updated.laborMarkupPct).toBeCloseTo(0.30, 6);
    expect(updated.passThroughMarkupPct).toBeCloseTo(0.20, 6);
    expect(updated.taxRate).toBeCloseTo(0.0825, 6);
  });

  it('rejects an out-of-range percent', async () => {
    const result = await updateEstimateDefaults({
      laborMarkupPct: '150', passThroughMarkupPct: '20', materialMarkupPct: '25',
      corporateMarkupPct: '5', taxRate: '8.25', contingencyPct: '10',
    });
    expect(result.error).toMatch(/0 and 100/);
  });

  it('rejects a missing field', async () => {
    const result = await updateEstimateDefaults({
      laborMarkupPct: '', passThroughMarkupPct: '20', materialMarkupPct: '25',
      corporateMarkupPct: '5', taxRate: '8.25', contingencyPct: '10',
    });
    expect(result.error).toMatch(/required/);
  });
});
