import { Sidebar } from './Sidebar';
import { SummaryStrip } from './SummaryStrip';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-mist">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <SummaryStrip />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
