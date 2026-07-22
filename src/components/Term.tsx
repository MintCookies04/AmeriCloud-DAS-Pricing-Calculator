import type { ReactNode } from 'react';

export function Term({ definition, children }: { definition: string; children: ReactNode }) {
  return (
    <span className="border-b border-dotted border-slate-2 cursor-help" title={definition}>
      {children}
    </span>
  );
}
