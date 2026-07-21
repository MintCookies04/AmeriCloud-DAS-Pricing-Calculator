import type { Metadata } from 'next';
import './globals.css';
import { loadReferenceData, loadEstimateDefaults } from '@/lib/data/loadReferenceData';
import { EstimateProvider } from '@/lib/estimate/EstimateContext';
import { AppShell } from '@/components/AppShell';

export const metadata: Metadata = {
  title: 'DAS Bid Estimator',
  description: 'AmeriCloud DAS construction bid estimator',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [referenceData, estimateDefaults] = await Promise.all([
    loadReferenceData(),
    loadEstimateDefaults(),
  ]);

  return (
    <html lang="en">
      <body>
        <EstimateProvider referenceData={referenceData} estimateDefaults={estimateDefaults}>
          <AppShell>{children}</AppShell>
        </EstimateProvider>
      </body>
    </html>
  );
}
