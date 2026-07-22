'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FileText, Package, HardHat, Receipt, BarChart3, Settings, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const NAV_ITEMS = [
  { href: '/', label: 'Cover Info', icon: FileText },
  { href: '/materials', label: 'Materials', icon: Package },
  { href: '/labor', label: 'Labor', icon: HardHat },
  { href: '/pass-throughs', label: 'Pass Throughs', icon: Receipt },
  { href: '/summary', label: 'Executive Summary', icon: BarChart3 },
  { href: '/admin', label: 'Admin', icon: Settings },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        'flex flex-col bg-navy text-white transition-all duration-200',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center justify-center gap-2 h-12 border-b border-white/10 hover:bg-navy-2 text-sm"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight className="w-5 h-5" aria-hidden="true" /> : (
          <>
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            Collapse
          </>
        )}
      </button>
      <ul className="flex-1 py-2">
        {NAV_ITEMS.map((item) => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 text-sm font-body transition-colors',
                  collapsed && 'justify-center px-0',
                  active ? 'bg-navy-2 border-l-4 border-red text-white' : 'text-white/70 hover:bg-navy-2 hover:text-white',
                )}
                title={collapsed ? item.label : undefined}
                aria-label={collapsed ? item.label : undefined}
              >
                <Icon className="w-5 h-5 shrink-0" aria-hidden="true" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
