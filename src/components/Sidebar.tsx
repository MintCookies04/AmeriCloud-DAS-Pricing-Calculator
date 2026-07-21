'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';

const NAV_ITEMS = [
  { href: '/', label: 'Cover Info' },
  { href: '/materials', label: 'Materials' },
  { href: '/labor', label: 'Labor' },
  { href: '/pass-throughs', label: 'Pass Throughs' },
  { href: '/summary', label: 'Executive Summary' },
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
        className="flex items-center justify-center h-12 border-b border-white/10 hover:bg-navy-2"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? '»' : '« Collapse'}
      </button>
      <ul className="flex-1 py-2">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  'block px-4 py-3 text-sm font-body transition-colors',
                  active ? 'bg-navy-2 border-l-4 border-red text-white' : 'text-white/70 hover:bg-navy-2 hover:text-white',
                )}
                title={collapsed ? item.label : undefined}
              >
                {collapsed ? item.label.charAt(0) : item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
