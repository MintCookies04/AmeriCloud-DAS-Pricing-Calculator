'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import { logoutAction } from '../login/actions';

const ADMIN_NAV_ITEMS = [
  { href: '/admin/materials', label: 'Materials' },
  { href: '/admin/labor-tasks', label: 'Labor Tasks' },
  { href: '/admin/rates', label: 'Rates' },
  { href: '/admin/pass-throughs', label: 'Pass Throughs' },
  { href: '/admin/defaults', label: 'Defaults' },
];

export default function AdminSectionsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-line pb-4">
        <nav className="flex gap-2">
          {ADMIN_NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'px-3 py-2 rounded font-body text-sm transition-colors',
                  active ? 'bg-mist-2 text-navy font-semibold' : 'text-slate hover:bg-mist-2 hover:text-navy',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <form action={logoutAction}>
          <button type="submit" className="text-sm text-slate hover:text-red transition-colors">
            Log Out
          </button>
        </form>
      </div>
      {children}
    </div>
  );
}
