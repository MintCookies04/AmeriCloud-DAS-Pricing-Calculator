import { prisma } from '@/lib/db';
import { PassThroughRatesSection } from './PassThroughRatesSection';
import { RentalsSection } from './RentalsSection';
import { SoftCostsSection } from './SoftCostsSection';

export default async function PassThroughsAdminPage() {
  const [roleRates, rentals, softCosts] = await Promise.all([
    prisma.passThroughRoleRate.findMany({ orderBy: [{ kind: 'asc' }, { role: 'asc' }] }),
    prisma.rentalRate.findMany({ orderBy: { key: 'asc' } }),
    prisma.softCostRate.findMany({ orderBy: { key: 'asc' } }),
  ]);

  return (
    <div className="space-y-8">
      <h1 className="font-display text-3xl font-bold tracking-tight text-navy">Pass Throughs</h1>
      <PassThroughRatesSection rows={roleRates} />
      <RentalsSection rows={rentals} />
      <SoftCostsSection rows={softCosts} />
    </div>
  );
}
