import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DAS Bid Estimator',
  description: 'AmeriCloud DAS construction bid estimator',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
