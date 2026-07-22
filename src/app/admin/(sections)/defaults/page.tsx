import { prisma } from '@/lib/db';
import { EstimateDefaultsForm } from './EstimateDefaultsForm';

export default async function DefaultsAdminPage() {
  const defaults = await prisma.estimateDefaults.findUniqueOrThrow({ where: { id: 'singleton' } });
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl text-navy">Estimate Defaults</h1>
      <EstimateDefaultsForm defaults={defaults} />
    </div>
  );
}
