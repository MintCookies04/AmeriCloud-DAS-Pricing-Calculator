import { loadReferenceData, loadEstimateDefaults } from '@/lib/data/loadReferenceData';
import { EstimateProvider } from '@/lib/estimate/EstimateContext';
import { AppShell } from '@/components/AppShell';

export const dynamic = 'force-dynamic';

export default async function EstimatorLayout({ children }: { children: React.ReactNode }) {
  const [referenceData, estimateDefaults] = await Promise.all([
    loadReferenceData(),
    loadEstimateDefaults(),
  ]);

  return (
    <EstimateProvider referenceData={referenceData} estimateDefaults={estimateDefaults}>
      <AppShell>{children}</AppShell>
    </EstimateProvider>
  );
}
