'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { requireAdminSession } from '@/lib/auth/adminAuth';

interface ActionResult {
  error?: string;
}

interface DefaultsOk {
  ok: true;
  laborMarkupPct: number;
  passThroughMarkupPct: number;
  materialMarkupPct: number;
  corporateMarkupPct: number;
  taxRate: number;
  contingencyPct: number;
}
interface ValidationErr {
  ok: false;
  error: string;
}

function parsePercent(raw: string | undefined, label: string): number | { error: string } {
  if (raw === undefined || raw === '') return { error: `${label} is required.` };
  const value = Number(raw);
  if (Number.isNaN(value) || value < 0 || value > 100) return { error: `${label} must be between 0 and 100.` };
  return value / 100;
}

function validateDefaultsValues(values: Record<string, string>): DefaultsOk | ValidationErr {
  const laborMarkupPct = parsePercent(values.laborMarkupPct, 'Labor markup %');
  if (typeof laborMarkupPct !== 'number') return { ok: false, error: laborMarkupPct.error };
  const passThroughMarkupPct = parsePercent(values.passThroughMarkupPct, 'Pass-through markup %');
  if (typeof passThroughMarkupPct !== 'number') return { ok: false, error: passThroughMarkupPct.error };
  const materialMarkupPct = parsePercent(values.materialMarkupPct, 'Material markup %');
  if (typeof materialMarkupPct !== 'number') return { ok: false, error: materialMarkupPct.error };
  const corporateMarkupPct = parsePercent(values.corporateMarkupPct, 'Corporate markup %');
  if (typeof corporateMarkupPct !== 'number') return { ok: false, error: corporateMarkupPct.error };
  const taxRate = parsePercent(values.taxRate, 'Tax rate');
  if (typeof taxRate !== 'number') return { ok: false, error: taxRate.error };
  const contingencyPct = parsePercent(values.contingencyPct, 'Contingency %');
  if (typeof contingencyPct !== 'number') return { ok: false, error: contingencyPct.error };
  return {
    ok: true, laborMarkupPct, passThroughMarkupPct, materialMarkupPct, corporateMarkupPct, taxRate, contingencyPct,
  };
}

export async function updateEstimateDefaults(values: Record<string, string>): Promise<ActionResult> {
  if (!(await requireAdminSession())) return { error: 'Not authenticated.' };
  const parsed = validateDefaultsValues(values);
  if (!parsed.ok) return { error: parsed.error };

  await prisma.estimateDefaults.update({
    where: { id: 'singleton' },
    data: {
      laborMarkupPct: parsed.laborMarkupPct,
      passThroughMarkupPct: parsed.passThroughMarkupPct,
      materialMarkupPct: parsed.materialMarkupPct,
      corporateMarkupPct: parsed.corporateMarkupPct,
      taxRate: parsed.taxRate,
      contingencyPct: parsed.contingencyPct,
    },
  });
  revalidatePath('/', 'layout');
  return {};
}
