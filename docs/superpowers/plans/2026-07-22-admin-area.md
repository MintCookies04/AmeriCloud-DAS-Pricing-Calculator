# Admin Area Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Admin Area (Plan 3): a password-gated `/admin` section with CRUD screens for every piece of editable reference data (material catalog, labor task library, labor rates, crew-size table, pass-through rate defaults, markup/tax defaults), and fix the root layout so admin edits are actually visible on the estimating pages without a redeploy.

**Architecture:** A shared, generic `<AdminTable>` client component (column config + Server Actions for create/update/delete) drives every list-type entity; two small bespoke singleton forms handle `LaborProjectionSettings` and `EstimateDefaults`. Mutations are Next.js Server Actions calling Prisma directly — no separate API layer. Auth is a single shared-password gate: `src/middleware.ts` checks an httpOnly cookie (a SHA-256 hash of `ADMIN_PASSWORD`, computed via the Web Crypto API so the same code runs in both the Edge middleware and Node.js Server Actions) and redirects unauthenticated requests to `/admin/login`. The root layout switches from static to forced-dynamic rendering so every request reflects current DB state.

**Tech Stack:** Next.js 14 (App Router, Server Actions, Middleware), Prisma (existing schema, no migrations needed), Vitest + `@testing-library/react` for component tests, Vitest integration tests against the real seeded local Postgres for Server Actions.

## Global Constraints

- No user accounts/roles — one shared password via `ADMIN_PASSWORD`, no accounts table (confirmed in the design spec).
- Brand theme (already in `tailwind.config.ts`): navy `navy`/`navy-deep`/`navy-2` for chrome, `mist`/`mist-2`/white for content, `red`/`red-700` for primary actions, `slate`/`slate-2` for secondary text, `font-display` (Archivo) for headings, `font-body` (Manrope, default) for body/data. Reuse the existing table styling pattern from `src/app/materials/page.tsx` (zebra-striped rows, sticky header, right-aligned numeric columns).
- This project uses `noUncheckedIndexedAccess: true` in `tsconfig.json` — run `npx tsc --noEmit` before every commit.
- No placeholders, no `TODO`s in committed code. Every function/component must be fully implemented before merging.
- **Every integration test that mutates real seeded reference data must restore the original values it changed (capture before, restore in a `finally`/`afterEach`).** This project shares one local Postgres across all test files; `loadReferenceData.integration.test.ts` (from Plan 2) asserts exact hand-verified values (RF-Engineer $100/$75, crew-size-4 → 1 CM, `bom-3` → $4685, `EstimateDefaults` at 25%/25%/25%/5%/8.25%/10%) that will fail unpredictably if a later test run leaves mutated data behind. This applies to every entity this plan tests against real Postgres: `LaborRate`, `CrewSizeRow`, `PassThroughRoleRate`, `LaborProjectionSettings`, `EstimateDefaults` (all edit-only/singleton) — tests that `create` + `delete` their own row (Materials, Labor Tasks, Rentals, Soft Costs) are self-cleaning by construction and don't need this.
- A `LaborTask`'s `derivedFromJson` (its derived-quantity formula) is never editable through the Admin UI (confirmed in the design spec) — it's displayed read-only, omitted entirely from update payloads (preserving whatever value is already in the DB), and always absent (null) on newly created tasks.
- Deleting a `LaborTask` that another task's `derivedFromJson` references must be rejected with an error naming the referencing task(s) — never allowed to silently orphan a derived formula.
- Routes: `/admin/login` (public), `/admin` (redirects to `/admin/materials`), `/admin/materials`, `/admin/labor-tasks`, `/admin/rates`, `/admin/pass-throughs`, `/admin/defaults` (all password-gated, share a sub-nav).
- Testing philosophy (per the design spec and consistent with Plan 2): the shared `<AdminTable>` component gets targeted component tests (render + one edit/add/delete/error interaction, not exhaustive); each entity's Server Actions get an integration test against the real seeded local Postgres (same pattern as `src/lib/data/loadReferenceData.integration.test.ts`); full click-through via `npm run dev` confirms an Admin edit shows up on the corresponding estimating page before considering this plan done.
- Local Postgres must be running for every integration test in this plan: `docker start das-estimator-postgres` (start Docker Desktop first if needed), with `.env`'s `DATABASE_URL` pointing at it (see `CLAUDE.md`).

---

### Task 1: Admin auth gate, shell, and the static-data fix

**Files:**
- Create: `src/lib/auth/adminAuth.ts`
- Test: `src/lib/auth/adminAuth.test.ts`
- Create: `src/middleware.ts`
- Test: `src/middleware.test.ts`
- Create: `src/app/admin/login/actions.ts`
- Create: `src/app/admin/login/page.tsx`
- Create: `src/app/admin/(sections)/layout.tsx`
- Create: `src/app/admin/page.tsx`
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `.env.example`

**Interfaces:**
- Produces: `ADMIN_SESSION_COOKIE: string`, `checkAdminPassword(candidate: string): Promise<boolean>`, `adminSessionCookieValue(): Promise<string>`, `isValidAdminSessionCookie(cookieValue: string | undefined): Promise<boolean>` from `@/lib/auth/adminAuth` — used by `src/middleware.ts` and `src/app/admin/login/actions.ts`, and by every later task's manual/integration testing indirectly (nothing else consumes them directly).
- Produces: `logoutAction(): Promise<void>` from `src/app/admin/login/actions.ts` — consumed by `src/app/admin/(sections)/layout.tsx`.
- Global effect: `src/app/layout.tsx` (root layout, already fetches reference data — see Plan 2) gains `export const dynamic = 'force-dynamic'`. No other task touches this file again.

- [ ] **Step 1: Write the failing test for `adminAuth`**

```ts
// src/lib/auth/adminAuth.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  ADMIN_SESSION_COOKIE,
  checkAdminPassword,
  adminSessionCookieValue,
  isValidAdminSessionCookie,
} from './adminAuth';

const ORIGINAL_PASSWORD = process.env.ADMIN_PASSWORD;

beforeEach(() => {
  process.env.ADMIN_PASSWORD = 'test-password-123';
});

afterEach(() => {
  // Note: `process.env.X = undefined` sets the string "undefined", it does not unset the var —
  // must delete explicitly when the var wasn't originally present.
  if (ORIGINAL_PASSWORD === undefined) {
    delete process.env.ADMIN_PASSWORD;
  } else {
    process.env.ADMIN_PASSWORD = ORIGINAL_PASSWORD;
  }
});

describe('adminAuth', () => {
  it('exports a stable cookie name', () => {
    expect(ADMIN_SESSION_COOKIE).toBe('das_admin_session');
  });

  it('accepts the correct password', async () => {
    expect(await checkAdminPassword('test-password-123')).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    expect(await checkAdminPassword('wrong')).toBe(false);
  });

  it('produces a session cookie value that is not the plaintext password', async () => {
    const value = await adminSessionCookieValue();
    expect(value).not.toBe('test-password-123');
    expect(value).toMatch(/^[0-9a-f]{64}$/); // hex-encoded SHA-256
  });

  it('round-trips: the produced cookie value validates as a valid session', async () => {
    const value = await adminSessionCookieValue();
    expect(await isValidAdminSessionCookie(value)).toBe(true);
  });

  it('rejects a wrong or missing cookie value', async () => {
    expect(await isValidAdminSessionCookie('not-the-right-value')).toBe(false);
    expect(await isValidAdminSessionCookie(undefined)).toBe(false);
  });

  it('throws a clear error when ADMIN_PASSWORD is not set', async () => {
    delete process.env.ADMIN_PASSWORD;
    await expect(checkAdminPassword('anything')).rejects.toThrow('ADMIN_PASSWORD');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/auth/adminAuth.test.ts`
Expected: FAIL — `Cannot find module './adminAuth'`.

- [ ] **Step 3: Implement `adminAuth.ts`**

```ts
// src/lib/auth/adminAuth.ts
export const ADMIN_SESSION_COOKIE = 'das_admin_session';

function requireAdminPassword(): string {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    throw new Error('ADMIN_PASSWORD environment variable is not set.');
  }
  return password;
}

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function checkAdminPassword(candidate: string): Promise<boolean> {
  return candidate === requireAdminPassword();
}

export async function adminSessionCookieValue(): Promise<string> {
  return sha256Hex(requireAdminPassword());
}

export async function isValidAdminSessionCookie(cookieValue: string | undefined): Promise<boolean> {
  if (!cookieValue) return false;
  try {
    return cookieValue === (await adminSessionCookieValue());
  } catch {
    return false;
  }
}
```

Uses the Web Crypto API (`crypto.subtle`), not `node:crypto` — this same module is imported by `src/middleware.ts`, which runs on Next.js's Edge Runtime and cannot use Node-only builtins. Web Crypto works identically in both the Edge Runtime and Node.js (verified: Node v24 in this environment exposes `globalThis.crypto.subtle`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/auth/adminAuth.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/adminAuth.ts src/lib/auth/adminAuth.test.ts
git commit -m "Add admin password check and session-cookie helpers"
```

- [ ] **Step 6: Write the failing test for the middleware**

```ts
// src/middleware.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from './middleware';
import { ADMIN_SESSION_COOKIE, adminSessionCookieValue } from '@/lib/auth/adminAuth';

const ORIGINAL_PASSWORD = process.env.ADMIN_PASSWORD;

beforeEach(() => {
  process.env.ADMIN_PASSWORD = 'test-password-123';
});

afterEach(() => {
  if (ORIGINAL_PASSWORD === undefined) {
    delete process.env.ADMIN_PASSWORD;
  } else {
    process.env.ADMIN_PASSWORD = ORIGINAL_PASSWORD;
  }
});

describe('admin middleware', () => {
  it('allows /admin/login through without a session cookie', async () => {
    const response = await middleware(new NextRequest('http://localhost/admin/login'));
    expect(response.status).toBe(200);
  });

  it('redirects to /admin/login when no session cookie is present', async () => {
    const response = await middleware(new NextRequest('http://localhost/admin/materials'));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/admin/login');
  });

  it('redirects when the session cookie is wrong', async () => {
    const response = await middleware(
      new NextRequest('http://localhost/admin/materials', {
        headers: { cookie: `${ADMIN_SESSION_COOKIE}=wrong-value` },
      }),
    );
    expect(response.status).toBe(307);
  });

  it('allows the request through with a valid session cookie', async () => {
    const validValue = await adminSessionCookieValue();
    const response = await middleware(
      new NextRequest('http://localhost/admin/materials', {
        headers: { cookie: `${ADMIN_SESSION_COOKIE}=${validValue}` },
      }),
    );
    expect(response.status).toBe(200);
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npx vitest run src/middleware.test.ts`
Expected: FAIL — `Cannot find module './middleware'`.

- [ ] **Step 8: Implement `middleware.ts`**

```ts
// src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ADMIN_SESSION_COOKIE, isValidAdminSessionCookie } from '@/lib/auth/adminAuth';

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/admin/login')) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (await isValidAdminSessionCookie(cookie)) {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL('/admin/login', request.url));
}

export const config = {
  matcher: ['/admin', '/admin/:path*'],
};
```

Placed at `src/middleware.ts` (not the project root) because this project uses the `src/` directory convention (`src/app`) — Next.js requires middleware to live alongside `src/app` in that case.

- [ ] **Step 9: Run test to verify it passes**

Run: `npx vitest run src/middleware.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 10: Commit**

```bash
git add src/middleware.ts src/middleware.test.ts
git commit -m "Add middleware gating /admin behind the shared-password session cookie"
```

- [ ] **Step 11: Add the login action, login page, admin shell, sidebar entry, and the static-data fix**

```ts
// src/app/admin/login/actions.ts
'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ADMIN_SESSION_COOKIE, adminSessionCookieValue, checkAdminPassword } from '@/lib/auth/adminAuth';

export async function loginAction(formData: FormData) {
  const password = formData.get('password');
  if (typeof password !== 'string' || !(await checkAdminPassword(password))) {
    redirect('/admin/login?error=1');
  }

  cookies().set(ADMIN_SESSION_COOKIE, await adminSessionCookieValue(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
  redirect('/admin/materials');
}

export async function logoutAction() {
  cookies().delete(ADMIN_SESSION_COOKIE);
  redirect('/admin/login');
}
```

```tsx
// src/app/admin/login/page.tsx
import { loginAction } from './actions';

export default function AdminLoginPage({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <form action={loginAction} className="bg-white rounded-lg shadow p-8 w-full max-w-sm space-y-4">
        <h1 className="font-display text-2xl text-navy">Admin Login</h1>
        {searchParams.error && <p className="text-red-700 text-sm">Incorrect password.</p>}
        <label className="block space-y-1">
          <span className="text-slate text-sm">Password</span>
          <input
            type="password"
            name="password"
            required
            autoFocus
            className="w-full border border-line rounded px-3 py-2"
          />
        </label>
        <button
          type="submit"
          className="w-full bg-red hover:bg-red-700 text-white font-display font-semibold px-4 py-2 rounded transition-colors"
        >
          Log In
        </button>
      </form>
    </div>
  );
}
```

```tsx
// src/app/admin/(sections)/layout.tsx
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
```

```tsx
// src/app/admin/page.tsx
import { redirect } from 'next/navigation';

export default function AdminIndexPage() {
  redirect('/admin/materials');
}
```

Modify `src/components/Sidebar.tsx` — add the Admin nav entry and switch the active-link check to `startsWith` so multi-route sections (Admin, whose sub-pages all live under `/admin/...`) highlight correctly:

```tsx
// src/components/Sidebar.tsx
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
  { href: '/admin', label: 'Admin' },
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
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
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
```

Modify `src/app/layout.tsx` — add `export const dynamic = 'force-dynamic'` right after the imports (this is the fix: without it, `npm run build` prerenders every route statically, and Admin edits never reach `/materials`, `/labor`, etc. without a full redeploy):

```tsx
// src/app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';
import { loadReferenceData, loadEstimateDefaults } from '@/lib/data/loadReferenceData';
import { EstimateProvider } from '@/lib/estimate/EstimateContext';
import { AppShell } from '@/components/AppShell';

export const dynamic = 'force-dynamic';

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
```

Modify `.env.example` — document the new required variable:

```
DATABASE_URL="postgresql://user:password@host/dbname?sslmode=require"
ADMIN_PASSWORD="changeme"
```

- [ ] **Step 12: Set a local `ADMIN_PASSWORD` and verify the app builds and type-checks**

Add `ADMIN_PASSWORD="dev-password"` to your local `.env` (gitignored, alongside `DATABASE_URL`).

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx vitest run`
Expected: all existing tests plus this task's 11 new tests pass (58/58 total by the end of this task, per Plan 2's 54 + 4 middleware + 7 adminAuth... note the exact running total is confirmed by the command's own summary line, not hand-counted here).

Run: `npm run build`
Expected: succeeds. Check the route output — `/admin/login` and `/admin` should now be listed with a `λ`/dynamic marker (or at minimum no longer part of the fully-static `○` set that Plan 2's final review flagged), confirming the root layout's `force-dynamic` took effect.

- [ ] **Step 13: Manual verification**

Run `npm run dev`, then in a browser:
1. Visit `/admin` — expect a redirect to `/admin/login`.
2. Submit the login form with a wrong password — expect "Incorrect password." and no cookie set.
3. Submit with the correct password (your local `ADMIN_PASSWORD`) — expect a redirect toward `/admin/materials`. This 404s for now (Task 3 hasn't built that page yet) — that's expected; what matters here is the redirect itself and that a `das_admin_session` cookie is now set (check DevTools → Application → Cookies).
4. Manually navigate to `/admin/login` again while the cookie is set — the login form still renders (middleware only redirects *away* from protected pages when unauthenticated; it doesn't redirect *away from* the login page when already authenticated). This is an accepted, low-stakes quirk for v1 — not a bug to fix.
5. Click "Log Out" is not reachable yet (no sub-nav page exists to click it from) — verified indirectly by `logoutAction` being exercised once Task 3 lands and the sub-nav is actually visible.

- [ ] **Step 14: Commit**

```bash
git add src/app/admin/login/actions.ts src/app/admin/login/page.tsx src/app/admin/\(sections\)/layout.tsx src/app/admin/page.tsx src/components/Sidebar.tsx src/app/layout.tsx .env.example
git commit -m "Add admin login page, sub-nav shell, sidebar entry, and force-dynamic rendering"
```

---

### Task 2: Shared `<AdminTable>` component

**Files:**
- Create: `src/components/admin/AdminTable.tsx`
- Test: `src/components/admin/AdminTable.test.tsx`

**Interfaces:**
- Consumes: nothing project-specific — a fully generic component.
- Produces: `AdminColumn<Row>`, `AdminTableProps<Row>`, `AdminTable<Row extends { id: string }>` from `@/components/admin/AdminTable` — consumed by every Task 3-7 entity page's client component.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/admin/AdminTable.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdminTable } from './AdminTable';
import type { AdminColumn } from './AdminTable';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

interface TestRow {
  id: string;
  name: string;
  cost: number;
}

const columns: AdminColumn<TestRow>[] = [
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'cost', label: 'Cost', type: 'number', align: 'right' },
];

describe('AdminTable', () => {
  it('renders existing rows', () => {
    render(
      <AdminTable<TestRow>
        columns={columns}
        rows={[{ id: '1', name: 'Widget', cost: 10 }]}
        onUpdate={vi.fn().mockResolvedValue({})}
      />,
    );
    expect(screen.getByText('Widget')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('edits a row and calls onUpdate with the new values', async () => {
    const onUpdate = vi.fn().mockResolvedValue({});
    render(
      <AdminTable<TestRow>
        columns={columns}
        rows={[{ id: '1', name: 'Widget', cost: 10 }]}
        onUpdate={onUpdate}
      />,
    );
    fireEvent.click(screen.getByText('Edit'));
    fireEvent.change(screen.getByDisplayValue('Widget'), { target: { value: 'Gadget' } });
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith('1', { name: 'Gadget', cost: '10' }));
  });

  it('shows an inline error and stays in edit mode when onUpdate fails validation', async () => {
    const onUpdate = vi.fn().mockResolvedValue({ error: 'Cost must be positive' });
    render(
      <AdminTable<TestRow>
        columns={columns}
        rows={[{ id: '1', name: 'Widget', cost: 10 }]}
        onUpdate={onUpdate}
      />,
    );
    fireEvent.click(screen.getByText('Edit'));
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(screen.getByText('Cost must be positive')).toBeInTheDocument());
    expect(screen.getByDisplayValue('Widget')).toBeInTheDocument(); // still editing
  });

  it('adds a new row via onCreate when provided', async () => {
    const onCreate = vi.fn().mockResolvedValue({});
    render(
      <AdminTable<TestRow>
        columns={columns}
        rows={[]}
        onUpdate={vi.fn()}
        onCreate={onCreate}
        emptyValues={{ name: '', cost: '0' }}
      />,
    );
    fireEvent.click(screen.getByText('+ Add Row'));
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'New Item' } });
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(onCreate).toHaveBeenCalledWith({ name: 'New Item', cost: '0' }));
  });

  it('hides Add and Delete controls when onCreate/onDelete are not provided', () => {
    render(
      <AdminTable<TestRow>
        columns={columns}
        rows={[{ id: '1', name: 'Widget', cost: 10 }]}
        onUpdate={vi.fn()}
      />,
    );
    expect(screen.queryByText('+ Add Row')).not.toBeInTheDocument();
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/admin/AdminTable.test.tsx`
Expected: FAIL — `Cannot find module './AdminTable'`.

- [ ] **Step 3: Implement `AdminTable.tsx`**

```tsx
// src/components/admin/AdminTable.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils/cn';

export type AdminColumnType = 'text' | 'number' | 'select' | 'checkbox' | 'readonly';

export interface AdminColumn<Row> {
  key: Extract<keyof Row, string>;
  label: string;
  type: AdminColumnType;
  required?: boolean;
  options?: { value: string; label: string }[];
  align?: 'left' | 'right';
  format?: (row: Row) => string;
}

export interface AdminTableProps<Row extends { id: string }> {
  columns: AdminColumn<Row>[];
  rows: Row[];
  onCreate?: (values: Record<string, string>) => Promise<{ error?: string }>;
  onUpdate: (id: string, values: Record<string, string>) => Promise<{ error?: string }>;
  onDelete?: (id: string) => Promise<{ error?: string }>;
  emptyValues?: Record<string, string>;
}

function rowToValues<Row>(row: Row, columns: AdminColumn<Row>[]): Record<string, string> {
  const values: Record<string, string> = {};
  for (const col of columns) {
    if (col.type === 'readonly') continue;
    const raw = row[col.key];
    values[col.key] = col.type === 'checkbox' ? String(Boolean(raw)) : String(raw ?? '');
  }
  return values;
}

export function AdminTable<Row extends { id: string }>({
  columns,
  rows,
  onCreate,
  onUpdate,
  onDelete,
  emptyValues = {},
}: AdminTableProps<Row>) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function startEdit(row: Row) {
    setEditingId(row.id);
    setDraft(rowToValues(row, columns));
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setAdding(false);
    setError(null);
  }

  function startAdd() {
    setAdding(true);
    setEditingId(null);
    setDraft({ ...emptyValues });
    setError(null);
  }

  async function saveEdit(id: string) {
    setPending(true);
    setError(null);
    const result = await onUpdate(id, draft);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setEditingId(null);
    router.refresh();
  }

  async function saveNew() {
    if (!onCreate) return;
    setPending(true);
    setError(null);
    const result = await onCreate(draft);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setAdding(false);
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!onDelete) return;
    if (!window.confirm('Delete this row? This cannot be undone.')) return;
    setPending(true);
    setError(null);
    const result = await onDelete(id);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  function renderCell(col: AdminColumn<Row>, row: Row) {
    if (col.type === 'readonly') {
      return <span className="text-slate">{col.format ? col.format(row) : String(row[col.key] ?? '')}</span>;
    }
    if (col.type === 'checkbox') {
      return row[col.key] ? 'Yes' : 'No';
    }
    return String(row[col.key] ?? '');
  }

  function renderInput(col: AdminColumn<Row>, row?: Row) {
    if (col.type === 'readonly') {
      return (
        <span className="text-slate">
          {row ? (col.format ? col.format(row) : String(row[col.key] ?? '')) : '—'}
        </span>
      );
    }
    if (col.type === 'checkbox') {
      return (
        <input
          type="checkbox"
          checked={draft[col.key] === 'true'}
          onChange={(e) => setDraft((d) => ({ ...d, [col.key]: String(e.target.checked) }))}
        />
      );
    }
    if (col.type === 'select') {
      return (
        <select
          className="w-full border border-line rounded px-2 py-1"
          value={draft[col.key] ?? ''}
          onChange={(e) => setDraft((d) => ({ ...d, [col.key]: e.target.value }))}
        >
          {(col.options ?? []).map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      );
    }
    return (
      <input
        type={col.type === 'number' ? 'number' : 'text'}
        required={col.required}
        className={cn('w-full border border-line rounded px-2 py-1', col.align === 'right' && 'text-right')}
        value={draft[col.key] ?? ''}
        onChange={(e) => setDraft((d) => ({ ...d, [col.key]: e.target.value }))}
      />
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {error && <div className="bg-red/10 text-red-700 px-4 py-2 text-sm">{error}</div>}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-slate">
            {columns.map((col) => (
              <th key={col.key} className={cn('px-4 py-2', col.align === 'right' && 'text-right')}>
                {col.label}
              </th>
            ))}
            <th className="px-4 py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const isEditing = editingId === row.id;
            return (
              <tr key={row.id} className={i % 2 === 0 ? 'bg-white' : 'bg-mist'}>
                {columns.map((col) => (
                  <td key={col.key} className={cn('px-4 py-2', col.align === 'right' && 'text-right')}>
                    {isEditing ? renderInput(col, row) : renderCell(col, row)}
                  </td>
                ))}
                <td className="px-4 py-2 text-right space-x-2">
                  {isEditing ? (
                    <>
                      <button disabled={pending} onClick={() => saveEdit(row.id)} className="text-navy hover:text-red">Save</button>
                      <button disabled={pending} onClick={cancelEdit} className="text-slate hover:text-navy">Cancel</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => startEdit(row)} className="text-navy hover:text-red">Edit</button>
                      {onDelete && (
                        <button onClick={() => handleDelete(row.id)} className="text-slate hover:text-red">Delete</button>
                      )}
                    </>
                  )}
                </td>
              </tr>
            );
          })}
          {adding && (
            <tr className="bg-mist-2">
              {columns.map((col) => (
                <td key={col.key} className={cn('px-4 py-2', col.align === 'right' && 'text-right')}>
                  {renderInput(col)}
                </td>
              ))}
              <td className="px-4 py-2 text-right space-x-2">
                <button disabled={pending} onClick={saveNew} className="text-navy hover:text-red">Save</button>
                <button disabled={pending} onClick={cancelEdit} className="text-slate hover:text-navy">Cancel</button>
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {onCreate && !adding && (
        <div className="px-4 py-3 border-t border-line">
          <button onClick={startAdd} className="text-navy font-display font-semibold hover:text-red">+ Add Row</button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/admin/AdminTable.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Run full type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/AdminTable.tsx src/components/admin/AdminTable.test.tsx
git commit -m "Add shared AdminTable component for admin CRUD screens"
```

---

### Task 3: Material catalog admin page

**Files:**
- Create: `src/app/admin/(sections)/materials/actions.ts`
- Test: `src/app/admin/(sections)/materials/actions.test.ts`
- Create: `src/app/admin/(sections)/materials/MaterialsAdminClient.tsx`
- Create: `src/app/admin/(sections)/materials/page.tsx`

**Interfaces:**
- Consumes: `AdminTable`, `AdminColumn` from `@/components/admin/AdminTable` (Task 2); `prisma` from `@/lib/db`; `MaterialItem`, `MaterialCategory` types from `@prisma/client`.
- Produces: `createMaterial`, `updateMaterial`, `deleteMaterial` (each `(...) => Promise<{ error?: string }>`) from `./actions` — consumed only by `MaterialsAdminClient.tsx` in this task.

- [ ] **Step 1: Write the failing integration test**

```ts
// src/app/admin/(sections)/materials/actions.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { prisma } from '@/lib/db';
import { createMaterial, updateMaterial, deleteMaterial } from './actions';

describe('material admin actions (integration — requires a live, seeded local Postgres)', () => {
  const createdIds: string[] = [];

  afterEach(async () => {
    for (const id of createdIds.splice(0)) {
      await prisma.materialItem.deleteMany({ where: { id } });
    }
  });

  it('creates a material with valid values', async () => {
    const result = await createMaterial({
      key: 'test-admin-material-1',
      type: 'Test Type',
      manufacturer: 'Test Mfr',
      model: 'TM-1',
      description: 'A test material',
      vendor: 'Test Vendor',
      category: 'Consumable',
      unitCost: '12.5',
    });
    expect(result.error).toBeUndefined();

    const created = await prisma.materialItem.findUnique({ where: { key: 'test-admin-material-1' } });
    expect(created).toMatchObject({ type: 'Test Type', unitCost: 12.5, category: 'Consumable' });
    if (created) createdIds.push(created.id);
  });

  it('rejects a duplicate key', async () => {
    const first = await createMaterial({
      key: 'test-admin-material-dup',
      type: 'T', description: 'D', category: 'Consumable', unitCost: '1',
      manufacturer: '', model: '', vendor: '',
    });
    expect(first.error).toBeUndefined();
    const created = await prisma.materialItem.findUnique({ where: { key: 'test-admin-material-dup' } });
    if (created) createdIds.push(created.id);

    const second = await createMaterial({
      key: 'test-admin-material-dup',
      type: 'T2', description: 'D2', category: 'Consumable', unitCost: '2',
      manufacturer: '', model: '', vendor: '',
    });
    expect(second.error).toMatch(/already exists/);
  });

  it('rejects a negative unit cost', async () => {
    const result = await createMaterial({
      key: 'test-admin-material-negative',
      type: 'T', description: 'D', category: 'Consumable', unitCost: '-5',
      manufacturer: '', model: '', vendor: '',
    });
    expect(result.error).toMatch(/non-negative/);
  });

  it('updates an existing material', async () => {
    const created = await prisma.materialItem.create({
      data: {
        key: 'test-admin-material-update', type: 'T', description: 'D',
        category: 'Consumable', unitCost: 1,
      },
    });
    createdIds.push(created.id);

    const result = await updateMaterial(created.id, {
      key: 'test-admin-material-update', type: 'Updated Type', description: 'Updated',
      category: 'DAS_Materials', unitCost: '99.99', manufacturer: '', model: '', vendor: '',
    });
    expect(result.error).toBeUndefined();

    const updated = await prisma.materialItem.findUnique({ where: { id: created.id } });
    expect(updated).toMatchObject({ type: 'Updated Type', unitCost: 99.99, category: 'DAS_Materials' });
  });

  it('deletes a material', async () => {
    const created = await prisma.materialItem.create({
      data: { key: 'test-admin-material-delete', type: 'T', description: 'D', category: 'Consumable', unitCost: 1 },
    });

    const result = await deleteMaterial(created.id);
    expect(result.error).toBeUndefined();

    const gone = await prisma.materialItem.findUnique({ where: { id: created.id } });
    expect(gone).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "src/app/admin/(sections)/materials/actions.test.ts"`
Expected: FAIL — `Cannot find module './actions'`.

- [ ] **Step 3: Implement `actions.ts`**

```ts
// src/app/admin/(sections)/materials/actions.ts
'use server';

import { prisma } from '@/lib/db';
import type { MaterialCategory } from '@prisma/client';

interface ActionResult {
  error?: string;
}

const VALID_CATEGORIES: MaterialCategory[] = ['Consumable', 'DAS_Materials', 'BAT_Materials'];

interface MaterialOk {
  ok: true;
  key: string;
  type: string;
  description: string;
  category: MaterialCategory;
  unitCost: number;
  manufacturer: string | null;
  model: string | null;
  vendor: string | null;
}
interface ValidationErr {
  ok: false;
  error: string;
}

function validateMaterialValues(values: Record<string, string>): MaterialOk | ValidationErr {
  const key = values.key?.trim();
  if (!key) return { ok: false, error: 'Key is required.' };
  const type = values.type?.trim();
  if (!type) return { ok: false, error: 'Type is required.' };
  const description = values.description?.trim();
  if (!description) return { ok: false, error: 'Description is required.' };
  const category = values.category as MaterialCategory;
  if (!VALID_CATEGORIES.includes(category)) return { ok: false, error: 'Category is invalid.' };
  const unitCost = Number(values.unitCost);
  if (values.unitCost === undefined || values.unitCost === '' || Number.isNaN(unitCost) || unitCost < 0) {
    return { ok: false, error: 'Unit cost must be a non-negative number.' };
  }
  return {
    ok: true,
    key,
    type,
    description,
    category,
    unitCost,
    manufacturer: values.manufacturer?.trim() || null,
    model: values.model?.trim() || null,
    vendor: values.vendor?.trim() || null,
  };
}

export async function createMaterial(values: Record<string, string>): Promise<ActionResult> {
  const parsed = validateMaterialValues(values);
  if (!parsed.ok) return { error: parsed.error };

  const existing = await prisma.materialItem.findUnique({ where: { key: parsed.key } });
  if (existing) return { error: `A material with key "${parsed.key}" already exists.` };

  await prisma.materialItem.create({
    data: {
      key: parsed.key,
      type: parsed.type,
      manufacturer: parsed.manufacturer,
      model: parsed.model,
      description: parsed.description,
      vendor: parsed.vendor,
      category: parsed.category,
      unitCost: parsed.unitCost,
    },
  });
  return {};
}

export async function updateMaterial(id: string, values: Record<string, string>): Promise<ActionResult> {
  const parsed = validateMaterialValues(values);
  if (!parsed.ok) return { error: parsed.error };

  const keyOwner = await prisma.materialItem.findUnique({ where: { key: parsed.key } });
  if (keyOwner && keyOwner.id !== id) return { error: `A material with key "${parsed.key}" already exists.` };

  await prisma.materialItem.update({
    where: { id },
    data: {
      key: parsed.key,
      type: parsed.type,
      manufacturer: parsed.manufacturer,
      model: parsed.model,
      description: parsed.description,
      vendor: parsed.vendor,
      category: parsed.category,
      unitCost: parsed.unitCost,
    },
  });
  return {};
}

export async function deleteMaterial(id: string): Promise<ActionResult> {
  await prisma.materialItem.delete({ where: { id } });
  return {};
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run "src/app/admin/(sections)/materials/actions.test.ts"`
Expected: PASS (5 tests). (Requires the local Postgres running — `docker start das-estimator-postgres`.)

- [ ] **Step 5: Build the page and its client component**

```tsx
// src/app/admin/(sections)/materials/MaterialsAdminClient.tsx
'use client';

import type { MaterialItem, MaterialCategory } from '@prisma/client';
import { AdminTable, type AdminColumn } from '@/components/admin/AdminTable';
import { createMaterial, updateMaterial, deleteMaterial } from './actions';

const CATEGORY_OPTIONS: { value: MaterialCategory; label: string }[] = [
  { value: 'Consumable', label: 'Consumable' },
  { value: 'DAS_Materials', label: 'DAS Materials' },
  { value: 'BAT_Materials', label: 'BAT Materials' },
];

const columns: AdminColumn<MaterialItem>[] = [
  { key: 'key', label: 'Key', type: 'text', required: true },
  { key: 'type', label: 'Type', type: 'text', required: true },
  { key: 'manufacturer', label: 'Manufacturer', type: 'text' },
  { key: 'model', label: 'Model', type: 'text' },
  { key: 'description', label: 'Description', type: 'text', required: true },
  { key: 'vendor', label: 'Vendor', type: 'text' },
  { key: 'category', label: 'Category', type: 'select', options: CATEGORY_OPTIONS, required: true },
  { key: 'unitCost', label: 'Unit Cost', type: 'number', align: 'right', required: true },
];

const emptyValues = {
  key: '', type: '', manufacturer: '', model: '', description: '', vendor: '',
  category: 'Consumable', unitCost: '0',
};

export function MaterialsAdminClient({ rows }: { rows: MaterialItem[] }) {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl text-navy">Material Catalog</h1>
      <AdminTable<MaterialItem>
        columns={columns}
        rows={rows}
        onCreate={createMaterial}
        onUpdate={updateMaterial}
        onDelete={deleteMaterial}
        emptyValues={emptyValues}
      />
    </div>
  );
}
```

```tsx
// src/app/admin/(sections)/materials/page.tsx
import { prisma } from '@/lib/db';
import { MaterialsAdminClient } from './MaterialsAdminClient';

export default async function MaterialsAdminPage() {
  const materials = await prisma.materialItem.findMany({ orderBy: { key: 'asc' } });
  return <MaterialsAdminClient rows={materials} />;
}
```

- [ ] **Step 6: Run full verification**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 7: Manual verification**

`npm run dev`, log in at `/admin/login`, land on `/admin/materials` (no longer 404). Confirm: the sub-nav from Task 1 is now visible and clickable; add a new material, edit an existing one, delete one; then open `/materials` in another tab and confirm the edited/added item appears there without restarting the dev server — this is the concrete proof the Task 1 static-data fix works end to end.

- [ ] **Step 8: Commit**

```bash
git add "src/app/admin/(sections)/materials"
git commit -m "Add material catalog admin page"
```

---

### Task 4: Labor task library admin page

**Files:**
- Create: `src/app/admin/(sections)/labor-tasks/actions.ts`
- Test: `src/app/admin/(sections)/labor-tasks/actions.test.ts`
- Create: `src/app/admin/(sections)/labor-tasks/LaborTasksAdminClient.tsx`
- Create: `src/app/admin/(sections)/labor-tasks/page.tsx`

**Interfaces:**
- Consumes: `AdminTable`, `AdminColumn` (Task 2); `parseDerivedFrom` from `@/lib/data/loadReferenceData` (Plan 2 — reused as-is, not modified); `LaborTask`, `LaborRoleName`, `LaborSheet` types from `@prisma/client`.
- Produces: `createLaborTask`, `updateLaborTask`, `deleteLaborTask` from `./actions` — consumed only by `LaborTasksAdminClient.tsx`.

- [ ] **Step 1: Write the failing integration test**

```ts
// src/app/admin/(sections)/labor-tasks/actions.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { prisma } from '@/lib/db';
import { createLaborTask, updateLaborTask, deleteLaborTask } from './actions';

describe('labor task admin actions (integration — requires a live, seeded local Postgres)', () => {
  const createdIds: string[] = [];

  afterEach(async () => {
    for (const id of createdIds.splice(0)) {
      await prisma.laborTask.deleteMany({ where: { id } });
    }
  });

  it('creates a non-derived labor task with valid values', async () => {
    const result = await createLaborTask({
      key: 'test-admin-task-1', sheet: 'LOE', category: 'Test Category', name: 'Test Task',
      minutesPerUnit: '15', unit: 'Each', laborRole: 'Technician', includedInSubtotal: 'true',
    });
    expect(result.error).toBeUndefined();

    const created = await prisma.laborTask.findUnique({ where: { key: 'test-admin-task-1' } });
    expect(created).toMatchObject({ sheet: 'LOE', minutesPerUnit: 15, laborRole: 'Technician' });
    expect(created?.derivedFromJson).toBeNull();
    if (created) createdIds.push(created.id);
  });

  it('rejects an invalid labor role', async () => {
    const result = await createLaborTask({
      key: 'test-admin-task-badrole', sheet: 'LOE', category: 'C', name: 'N',
      minutesPerUnit: '1', unit: 'Each', laborRole: 'Not A Role', includedInSubtotal: 'false',
    });
    expect(result.error).toMatch(/labor role/i);
  });

  it('rejects a negative minutesPerUnit', async () => {
    const result = await createLaborTask({
      key: 'test-admin-task-negative', sheet: 'LOE', category: 'C', name: 'N',
      minutesPerUnit: '-1', unit: 'Each', laborRole: 'Technician', includedInSubtotal: 'false',
    });
    expect(result.error).toMatch(/non-negative/);
  });

  it('updates a task without touching its existing derivedFromJson', async () => {
    const created = await prisma.laborTask.create({
      data: {
        key: 'test-admin-task-derived', sheet: 'LOE', category: 'C', name: 'N',
        minutesPerUnit: 1, unit: 'Each', laborRole: 'Technician', includedInSubtotal: true,
        derivedFromJson: { terms: [{ key: 'loe-21', coeff: 1 }], divisor: 1 },
      },
    });
    createdIds.push(created.id);

    const result = await updateLaborTask(created.id, {
      key: 'test-admin-task-derived', sheet: 'LOE', category: 'Updated', name: 'Updated Name',
      minutesPerUnit: '2', unit: 'Each', laborRole: 'Technician', includedInSubtotal: 'true',
    });
    expect(result.error).toBeUndefined();

    const updated = await prisma.laborTask.findUnique({ where: { id: created.id } });
    expect(updated).toMatchObject({ category: 'Updated', name: 'Updated Name', minutesPerUnit: 2 });
    expect(updated?.derivedFromJson).toEqual({ terms: [{ key: 'loe-21', coeff: 1 }], divisor: 1 });
  });

  it('blocks deleting a task that another task\'s derivation formula references', async () => {
    const source = await prisma.laborTask.create({
      data: {
        key: 'test-admin-task-source', sheet: 'LOE', category: 'C', name: 'Source',
        minutesPerUnit: 1, unit: 'Each', laborRole: 'Technician', includedInSubtotal: true,
      },
    });
    createdIds.push(source.id);
    const derived = await prisma.laborTask.create({
      data: {
        key: 'test-admin-task-derived-2', sheet: 'LOE', category: 'C', name: 'Derived',
        minutesPerUnit: 1, unit: 'Each', laborRole: 'Technician', includedInSubtotal: true,
        derivedFromJson: { terms: [{ key: 'test-admin-task-source', coeff: 1 }], divisor: 1 },
      },
    });
    createdIds.push(derived.id);

    const result = await deleteLaborTask(source.id);
    expect(result.error).toMatch(/test-admin-task-derived-2/);

    const stillThere = await prisma.laborTask.findUnique({ where: { id: source.id } });
    expect(stillThere).not.toBeNull();
  });

  it('allows deleting a task nothing else derives from', async () => {
    const created = await prisma.laborTask.create({
      data: {
        key: 'test-admin-task-deletable', sheet: 'SOW', category: 'C', name: 'N',
        minutesPerUnit: 1, unit: 'Each', laborRole: 'Technician', includedInSubtotal: true,
      },
    });

    const result = await deleteLaborTask(created.id);
    expect(result.error).toBeUndefined();

    const gone = await prisma.laborTask.findUnique({ where: { id: created.id } });
    expect(gone).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "src/app/admin/(sections)/labor-tasks/actions.test.ts"`
Expected: FAIL — `Cannot find module './actions'`.

- [ ] **Step 3: Implement `actions.ts`**

```ts
// src/app/admin/(sections)/labor-tasks/actions.ts
'use server';

import { prisma } from '@/lib/db';
import type { LaborRoleName, LaborSheet } from '@prisma/client';
import { parseDerivedFrom } from '@/lib/data/loadReferenceData';

interface ActionResult {
  error?: string;
}

const VALID_SHEETS: LaborSheet[] = ['LOE', 'SOW'];
const VALID_ROLES: LaborRoleName[] = [
  'Technician', 'Construction_Manager', 'RF_Engineer', 'RF_Technician', 'Project_Coordinator', 'Project_Manager',
];

interface LaborTaskOk {
  ok: true;
  key: string;
  sheet: LaborSheet;
  category: string;
  name: string;
  minutesPerUnit: number;
  unit: string;
  laborRole: LaborRoleName;
  includedInSubtotal: boolean;
}
interface ValidationErr {
  ok: false;
  error: string;
}

function validateLaborTaskValues(values: Record<string, string>): LaborTaskOk | ValidationErr {
  const key = values.key?.trim();
  if (!key) return { ok: false, error: 'Key is required.' };
  const sheet = values.sheet as LaborSheet;
  if (!VALID_SHEETS.includes(sheet)) return { ok: false, error: 'Sheet must be LOE or SOW.' };
  const category = values.category?.trim();
  if (!category) return { ok: false, error: 'Category is required.' };
  const name = values.name?.trim();
  if (!name) return { ok: false, error: 'Name is required.' };
  const minutesPerUnit = Number(values.minutesPerUnit);
  if (values.minutesPerUnit === undefined || values.minutesPerUnit === '' || Number.isNaN(minutesPerUnit) || minutesPerUnit < 0) {
    return { ok: false, error: 'Minutes per unit must be a non-negative number.' };
  }
  const unit = values.unit?.trim();
  if (!unit) return { ok: false, error: 'Unit is required.' };
  const laborRole = values.laborRole as LaborRoleName;
  if (!VALID_ROLES.includes(laborRole)) return { ok: false, error: 'Labor role is invalid.' };
  const includedInSubtotal = values.includedInSubtotal === 'true';
  return { ok: true, key, sheet, category, name, minutesPerUnit, unit, laborRole, includedInSubtotal };
}

export async function createLaborTask(values: Record<string, string>): Promise<ActionResult> {
  const parsed = validateLaborTaskValues(values);
  if (!parsed.ok) return { error: parsed.error };

  const existing = await prisma.laborTask.findUnique({ where: { key: parsed.key } });
  if (existing) return { error: `A labor task with key "${parsed.key}" already exists.` };

  await prisma.laborTask.create({
    data: {
      key: parsed.key,
      sheet: parsed.sheet,
      category: parsed.category,
      name: parsed.name,
      minutesPerUnit: parsed.minutesPerUnit,
      unit: parsed.unit,
      laborRole: parsed.laborRole,
      includedInSubtotal: parsed.includedInSubtotal,
    },
  });
  return {};
}

export async function updateLaborTask(id: string, values: Record<string, string>): Promise<ActionResult> {
  const parsed = validateLaborTaskValues(values);
  if (!parsed.ok) return { error: parsed.error };

  const keyOwner = await prisma.laborTask.findUnique({ where: { key: parsed.key } });
  if (keyOwner && keyOwner.id !== id) return { error: `A labor task with key "${parsed.key}" already exists.` };

  await prisma.laborTask.update({
    where: { id },
    data: {
      key: parsed.key,
      sheet: parsed.sheet,
      category: parsed.category,
      name: parsed.name,
      minutesPerUnit: parsed.minutesPerUnit,
      unit: parsed.unit,
      laborRole: parsed.laborRole,
      includedInSubtotal: parsed.includedInSubtotal,
    },
  });
  return {};
}

export async function deleteLaborTask(id: string): Promise<ActionResult> {
  const target = await prisma.laborTask.findUnique({ where: { id } });
  if (!target) return { error: 'Task not found.' };

  const allTasks = await prisma.laborTask.findMany({ select: { key: true, derivedFromJson: true } });
  const referencingTasks = allTasks.filter((t) => {
    const derived = parseDerivedFrom(t.derivedFromJson, t.key);
    return derived?.terms.some((term) => term.key === target.key) ?? false;
  });
  if (referencingTasks.length > 0) {
    const names = referencingTasks.map((t) => t.key).join(', ');
    return { error: `Cannot delete "${target.key}" — it is referenced by the derived quantity formula of: ${names}.` };
  }

  await prisma.laborTask.delete({ where: { id } });
  return {};
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run "src/app/admin/(sections)/labor-tasks/actions.test.ts"`
Expected: PASS (6 tests).

- [ ] **Step 5: Build the page and its client component**

```tsx
// src/app/admin/(sections)/labor-tasks/LaborTasksAdminClient.tsx
'use client';

import type { LaborTask, LaborRoleName } from '@prisma/client';
import { AdminTable, type AdminColumn } from '@/components/admin/AdminTable';
import { parseDerivedFrom } from '@/lib/data/loadReferenceData';
import { createLaborTask, updateLaborTask, deleteLaborTask } from './actions';

const SHEET_OPTIONS = [
  { value: 'LOE', label: 'LOE' },
  { value: 'SOW', label: 'SOW' },
];

const ROLE_OPTIONS: { value: LaborRoleName; label: string }[] = [
  { value: 'Technician', label: 'Technician' },
  { value: 'Construction_Manager', label: 'Construction Manager' },
  { value: 'RF_Engineer', label: 'RF-Engineer' },
  { value: 'RF_Technician', label: 'RF-Technician' },
  { value: 'Project_Coordinator', label: 'Project Coordinator' },
  { value: 'Project_Manager', label: 'Project Manager' },
];

function formatDerivation(row: LaborTask): string {
  try {
    const derived = parseDerivedFrom(row.derivedFromJson, row.key);
    if (!derived) return '—';
    const termsText = derived.terms.map((t) => (t.coeff === 1 ? t.key : `${t.coeff}×${t.key}`)).join(' + ');
    return derived.divisor === 1 ? `= ${termsText}` : `= (${termsText}) ÷ ${derived.divisor}`;
  } catch {
    return '⚠ malformed';
  }
}

const columns: AdminColumn<LaborTask>[] = [
  { key: 'key', label: 'Key', type: 'text', required: true },
  { key: 'sheet', label: 'Sheet', type: 'select', options: SHEET_OPTIONS, required: true },
  { key: 'category', label: 'Category', type: 'text', required: true },
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'minutesPerUnit', label: 'Minutes/Unit', type: 'number', align: 'right', required: true },
  { key: 'unit', label: 'Unit', type: 'text', required: true },
  { key: 'laborRole', label: 'Labor Role', type: 'select', options: ROLE_OPTIONS, required: true },
  { key: 'includedInSubtotal', label: 'In Subtotal', type: 'checkbox' },
  { key: 'derivedFromJson', label: 'Derived Quantity', type: 'readonly', format: formatDerivation },
];

const emptyValues = {
  key: '', sheet: 'LOE', category: '', name: '', minutesPerUnit: '0', unit: '',
  laborRole: 'Technician', includedInSubtotal: 'false',
};

export function LaborTasksAdminClient({ rows }: { rows: LaborTask[] }) {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl text-navy">Labor Task Library</h1>
      <AdminTable<LaborTask>
        columns={columns}
        rows={rows}
        onCreate={createLaborTask}
        onUpdate={updateLaborTask}
        onDelete={deleteLaborTask}
        emptyValues={emptyValues}
      />
    </div>
  );
}
```

```tsx
// src/app/admin/(sections)/labor-tasks/page.tsx
import { prisma } from '@/lib/db';
import { LaborTasksAdminClient } from './LaborTasksAdminClient';

export default async function LaborTasksAdminPage() {
  const tasks = await prisma.laborTask.findMany({ orderBy: [{ sheet: 'asc' }, { category: 'asc' }, { key: 'asc' }] });
  return <LaborTasksAdminClient rows={tasks} />;
}
```

- [ ] **Step 6: Run full verification**

Run: `npx tsc --noEmit` — expected: no errors.
Run: `npx vitest run` — expected: all tests pass.

- [ ] **Step 7: Manual verification**

`npm run dev`, log in, visit `/admin/labor-tasks`. Confirm a derived task (e.g. search for `loe-25`) shows its formula as read-only text in the "Derived Quantity" column and that column has no input when editing that row's other fields. Try deleting a task referenced by a derivation (e.g. `loe-21`) and confirm the error names the referencing task instead of deleting it.

- [ ] **Step 8: Commit**

```bash
git add "src/app/admin/(sections)/labor-tasks"
git commit -m "Add labor task library admin page"
```

---

### Task 5: Rates admin page (Labor rates, Crew-size table, Labor Projection Settings)

**Files:**
- Create: `src/app/admin/(sections)/rates/actions.ts`
- Test: `src/app/admin/(sections)/rates/actions.test.ts`
- Create: `src/app/admin/(sections)/rates/LaborRatesSection.tsx`
- Create: `src/app/admin/(sections)/rates/CrewSizeSection.tsx`
- Create: `src/app/admin/(sections)/rates/LaborProjectionSettingsForm.tsx`
- Create: `src/app/admin/(sections)/rates/page.tsx`

**Interfaces:**
- Consumes: `AdminTable`, `AdminColumn` (Task 2); `LaborRate`, `CrewSizeRow`, `LaborProjectionSettings` types from `@prisma/client`.
- Produces: `updateLaborRate`, `updateCrewSizeRow`, `updateLaborProjectionSettings` from `./actions` — consumed only within this task's own components.

- [ ] **Step 1: Write the failing integration test**

```ts
// src/app/admin/(sections)/rates/actions.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { prisma } from '@/lib/db';
import { updateLaborRate, updateCrewSizeRow, updateLaborProjectionSettings } from './actions';

describe('rates admin actions (integration — requires a live, seeded local Postgres)', () => {
  const restoreLaborRate: { id: string; hourlyRate: number; rawWageRate: number }[] = [];
  const restoreCrewSize: { id: string; cmsNeeded: number }[] = [];
  let restoreSettings: Record<string, number> | null = null;

  afterEach(async () => {
    for (const r of restoreLaborRate.splice(0)) {
      await prisma.laborRate.update({ where: { id: r.id }, data: { hourlyRate: r.hourlyRate, rawWageRate: r.rawWageRate } });
    }
    for (const r of restoreCrewSize.splice(0)) {
      await prisma.crewSizeRow.update({ where: { id: r.id }, data: { cmsNeeded: r.cmsNeeded } });
    }
    if (restoreSettings) {
      await prisma.laborProjectionSettings.update({ where: { id: 'singleton' }, data: restoreSettings });
      restoreSettings = null;
    }
  });

  it('updates a labor rate', async () => {
    const original = await prisma.laborRate.findFirstOrThrow({ where: { role: 'Technician' } });
    restoreLaborRate.push({ id: original.id, hourlyRate: original.hourlyRate, rawWageRate: original.rawWageRate });

    const result = await updateLaborRate(original.id, { hourlyRate: '90', rawWageRate: '80' });
    expect(result.error).toBeUndefined();

    const updated = await prisma.laborRate.findUniqueOrThrow({ where: { id: original.id } });
    expect(updated).toMatchObject({ hourlyRate: 90, rawWageRate: 80 });
  });

  it('rejects a negative labor rate', async () => {
    const original = await prisma.laborRate.findFirstOrThrow({ where: { role: 'Technician' } });
    const result = await updateLaborRate(original.id, { hourlyRate: '-1', rawWageRate: '80' });
    expect(result.error).toMatch(/non-negative/);
  });

  it('updates a crew-size row', async () => {
    const original = await prisma.crewSizeRow.findFirstOrThrow({ where: { technicianCount: 4 } });
    restoreCrewSize.push({ id: original.id, cmsNeeded: original.cmsNeeded });

    const result = await updateCrewSizeRow(original.id, { cmsNeeded: '3' });
    expect(result.error).toBeUndefined();

    const updated = await prisma.crewSizeRow.findUniqueOrThrow({ where: { id: original.id } });
    expect(updated.cmsNeeded).toBe(3);
  });

  it('updates labor projection settings, converting percent inputs to fractions', async () => {
    const original = await prisma.laborProjectionSettings.findUniqueOrThrow({ where: { id: 'singleton' } });
    restoreSettings = {
      hoursPerManDay: original.hoursPerManDay,
      hoursPerManWeek: original.hoursPerManWeek,
      stagingMaterialMultiplier: original.stagingMaterialMultiplier,
      cmPercentOfTechHours: original.cmPercentOfTechHours,
      pmPercentOfTechHours: original.pmPercentOfTechHours,
      coordinatorPercentOfTechHours: original.coordinatorPercentOfTechHours,
    };

    const result = await updateLaborProjectionSettings({
      hoursPerManDay: '8', hoursPerManWeek: '40', stagingMaterialMultiplier: '10',
      cmPercentOfTechHours: '50', pmPercentOfTechHours: '25', coordinatorPercentOfTechHours: '15',
    });
    expect(result.error).toBeUndefined();

    const updated = await prisma.laborProjectionSettings.findUniqueOrThrow({ where: { id: 'singleton' } });
    expect(updated.stagingMaterialMultiplier).toBeCloseTo(0.10, 6);
    expect(updated.cmPercentOfTechHours).toBeCloseTo(0.50, 6);
  });

  it('rejects an out-of-range percent', async () => {
    const result = await updateLaborProjectionSettings({
      hoursPerManDay: '8', hoursPerManWeek: '40', stagingMaterialMultiplier: '150',
      cmPercentOfTechHours: '50', pmPercentOfTechHours: '25', coordinatorPercentOfTechHours: '15',
    });
    expect(result.error).toMatch(/0-100/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "src/app/admin/(sections)/rates/actions.test.ts"`
Expected: FAIL — `Cannot find module './actions'`.

- [ ] **Step 3: Implement `actions.ts`**

```ts
// src/app/admin/(sections)/rates/actions.ts
'use server';

import { prisma } from '@/lib/db';

interface ActionResult {
  error?: string;
}

function parseNonNegative(raw: string | undefined): number | null {
  if (raw === undefined || raw === '') return null;
  const value = Number(raw);
  if (Number.isNaN(value) || value < 0) return null;
  return value;
}

function parsePercent(raw: string | undefined): number | null {
  if (raw === undefined || raw === '') return null;
  const value = Number(raw);
  if (Number.isNaN(value) || value < 0 || value > 100) return null;
  return value / 100;
}

export async function updateLaborRate(id: string, values: Record<string, string>): Promise<ActionResult> {
  const hourlyRate = parseNonNegative(values.hourlyRate);
  if (hourlyRate === null) return { error: 'Hourly rate must be a non-negative number.' };
  const rawWageRate = parseNonNegative(values.rawWageRate);
  if (rawWageRate === null) return { error: 'Raw wage rate must be a non-negative number.' };

  await prisma.laborRate.update({ where: { id }, data: { hourlyRate, rawWageRate } });
  return {};
}

export async function updateCrewSizeRow(id: string, values: Record<string, string>): Promise<ActionResult> {
  const cmsNeeded = parseNonNegative(values.cmsNeeded);
  if (cmsNeeded === null) return { error: 'CMs needed must be a non-negative number.' };

  await prisma.crewSizeRow.update({ where: { id }, data: { cmsNeeded } });
  return {};
}

interface SettingsOk {
  ok: true;
  hoursPerManDay: number;
  hoursPerManWeek: number;
  stagingMaterialMultiplier: number;
  cmPercentOfTechHours: number;
  pmPercentOfTechHours: number;
  coordinatorPercentOfTechHours: number;
}
interface ValidationErr {
  ok: false;
  error: string;
}

function validateSettingsValues(values: Record<string, string>): SettingsOk | ValidationErr {
  const hoursPerManDay = parseNonNegative(values.hoursPerManDay);
  if (hoursPerManDay === null) return { ok: false, error: 'Hours per man-day must be a non-negative number.' };
  const hoursPerManWeek = parseNonNegative(values.hoursPerManWeek);
  if (hoursPerManWeek === null) return { ok: false, error: 'Hours per man-week must be a non-negative number.' };
  const stagingMaterialMultiplier = parsePercent(values.stagingMaterialMultiplier);
  if (stagingMaterialMultiplier === null) return { ok: false, error: 'Staging/material multiplier must be 0-100%.' };
  const cmPercentOfTechHours = parsePercent(values.cmPercentOfTechHours);
  if (cmPercentOfTechHours === null) return { ok: false, error: 'Construction Manager % must be 0-100%.' };
  const pmPercentOfTechHours = parsePercent(values.pmPercentOfTechHours);
  if (pmPercentOfTechHours === null) return { ok: false, error: 'Project Manager % must be 0-100%.' };
  const coordinatorPercentOfTechHours = parsePercent(values.coordinatorPercentOfTechHours);
  if (coordinatorPercentOfTechHours === null) return { ok: false, error: 'Project Coordinator % must be 0-100%.' };
  return {
    ok: true,
    hoursPerManDay,
    hoursPerManWeek,
    stagingMaterialMultiplier,
    cmPercentOfTechHours,
    pmPercentOfTechHours,
    coordinatorPercentOfTechHours,
  };
}

export async function updateLaborProjectionSettings(values: Record<string, string>): Promise<ActionResult> {
  const parsed = validateSettingsValues(values);
  if (!parsed.ok) return { error: parsed.error };

  await prisma.laborProjectionSettings.update({
    where: { id: 'singleton' },
    data: {
      hoursPerManDay: parsed.hoursPerManDay,
      hoursPerManWeek: parsed.hoursPerManWeek,
      stagingMaterialMultiplier: parsed.stagingMaterialMultiplier,
      cmPercentOfTechHours: parsed.cmPercentOfTechHours,
      pmPercentOfTechHours: parsed.pmPercentOfTechHours,
      coordinatorPercentOfTechHours: parsed.coordinatorPercentOfTechHours,
    },
  });
  return {};
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run "src/app/admin/(sections)/rates/actions.test.ts"`
Expected: PASS (5 tests).

- [ ] **Step 5: Build the three sections and the page**

```tsx
// src/app/admin/(sections)/rates/LaborRatesSection.tsx
'use client';

import type { LaborRate } from '@prisma/client';
import { AdminTable, type AdminColumn } from '@/components/admin/AdminTable';
import { updateLaborRate } from './actions';

const ROLE_LABELS: Record<string, string> = {
  Technician: 'Technician',
  Construction_Manager: 'Construction Manager',
  RF_Engineer: 'RF-Engineer',
  RF_Technician: 'RF-Technician',
  Project_Coordinator: 'Project Coordinator',
  Project_Manager: 'Project Manager',
};

const columns: AdminColumn<LaborRate>[] = [
  { key: 'role', label: 'Role', type: 'readonly', format: (row) => ROLE_LABELS[row.role] ?? row.role },
  { key: 'hourlyRate', label: 'Hourly (Billing) Rate', type: 'number', align: 'right', required: true },
  { key: 'rawWageRate', label: 'Raw Wage Rate', type: 'number', align: 'right', required: true },
];

export function LaborRatesSection({ rows }: { rows: LaborRate[] }) {
  return (
    <section className="space-y-2">
      <h2 className="font-display text-lg text-navy">Labor Rates</h2>
      <AdminTable<LaborRate> columns={columns} rows={rows} onUpdate={updateLaborRate} />
    </section>
  );
}
```

```tsx
// src/app/admin/(sections)/rates/CrewSizeSection.tsx
'use client';

import type { CrewSizeRow } from '@prisma/client';
import { AdminTable, type AdminColumn } from '@/components/admin/AdminTable';
import { updateCrewSizeRow } from './actions';

const columns: AdminColumn<CrewSizeRow>[] = [
  { key: 'technicianCount', label: 'Technicians', type: 'readonly' },
  { key: 'cmsNeeded', label: 'CMs Needed', type: 'number', align: 'right', required: true },
];

export function CrewSizeSection({ rows }: { rows: CrewSizeRow[] }) {
  return (
    <section className="space-y-2">
      <h2 className="font-display text-lg text-navy">Crew-Size Table</h2>
      <AdminTable<CrewSizeRow> columns={columns} rows={rows} onUpdate={updateCrewSizeRow} />
    </section>
  );
}
```

```tsx
// src/app/admin/(sections)/rates/LaborProjectionSettingsForm.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { LaborProjectionSettings } from '@prisma/client';
import { updateLaborProjectionSettings } from './actions';

function toDisplayValues(settings: LaborProjectionSettings): Record<string, string> {
  return {
    hoursPerManDay: String(settings.hoursPerManDay),
    hoursPerManWeek: String(settings.hoursPerManWeek),
    stagingMaterialMultiplier: String(settings.stagingMaterialMultiplier * 100),
    cmPercentOfTechHours: String(settings.cmPercentOfTechHours * 100),
    pmPercentOfTechHours: String(settings.pmPercentOfTechHours * 100),
    coordinatorPercentOfTechHours: String(settings.coordinatorPercentOfTechHours * 100),
  };
}

const FIELDS: { key: string; label: string; suffix: string }[] = [
  { key: 'hoursPerManDay', label: 'Hours per Man-Day', suffix: 'hrs' },
  { key: 'hoursPerManWeek', label: 'Hours per Man-Week', suffix: 'hrs' },
  { key: 'stagingMaterialMultiplier', label: 'Staging/Material Time Multiplier', suffix: '%' },
  { key: 'cmPercentOfTechHours', label: 'Construction Manager % of Tech Hours', suffix: '%' },
  { key: 'pmPercentOfTechHours', label: 'Project Manager % of Tech Hours', suffix: '%' },
  { key: 'coordinatorPercentOfTechHours', label: 'Project Coordinator % of Tech Hours', suffix: '%' },
];

export function LaborProjectionSettingsForm({ settings }: { settings: LaborProjectionSettings }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(toDisplayValues(settings));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSave() {
    setPending(true);
    setError(null);
    const result = await updateLaborProjectionSettings(values);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <section className="space-y-2">
      <h2 className="font-display text-lg text-navy">Labor Projection Settings</h2>
      <div className="bg-white rounded-lg shadow p-4 space-y-3 max-w-md">
        {error && <p className="text-red-700 text-sm">{error}</p>}
        {FIELDS.map((field) => (
          <label key={field.key} className="flex items-center justify-between gap-4">
            <span className="text-slate">{field.label}</span>
            <span className="flex items-center gap-1">
              <input
                type="number"
                className="w-24 border border-line rounded px-2 py-1 text-right"
                value={values[field.key] ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
              />
              <span className="text-slate text-sm">{field.suffix}</span>
            </span>
          </label>
        ))}
        <button
          disabled={pending}
          onClick={handleSave}
          className="bg-red hover:bg-red-700 text-white font-display font-semibold px-4 py-2 rounded transition-colors"
        >
          Save
        </button>
      </div>
    </section>
  );
}
```

```tsx
// src/app/admin/(sections)/rates/page.tsx
import { prisma } from '@/lib/db';
import { LaborRatesSection } from './LaborRatesSection';
import { CrewSizeSection } from './CrewSizeSection';
import { LaborProjectionSettingsForm } from './LaborProjectionSettingsForm';

export default async function RatesAdminPage() {
  const [laborRates, crewSizeRows, settings] = await Promise.all([
    prisma.laborRate.findMany({ orderBy: { role: 'asc' } }),
    prisma.crewSizeRow.findMany({ orderBy: { technicianCount: 'asc' } }),
    prisma.laborProjectionSettings.findUniqueOrThrow({ where: { id: 'singleton' } }),
  ]);

  return (
    <div className="space-y-8">
      <h1 className="font-display text-2xl text-navy">Rates</h1>
      <LaborRatesSection rows={laborRates} />
      <CrewSizeSection rows={crewSizeRows} />
      <LaborProjectionSettingsForm settings={settings} />
    </div>
  );
}
```

- [ ] **Step 6: Run full verification**

Run: `npx tsc --noEmit` — expected: no errors.
Run: `npx vitest run` — expected: all tests pass.

- [ ] **Step 7: Manual verification**

`npm run dev`, log in, visit `/admin/rates`. Confirm all three sections render (6 labor rates, 20 crew-size rows, one settings form), edit one value in each, and confirm Labor's Crew Planner panel on `/labor` reflects a Rates edit (e.g. change crew-size-4's CMs Needed and confirm `/labor`'s Crew Planner output changes for a 4-technician selection) — then restore the value back to what it was (this is real seed data, not a throwaway test row).

- [ ] **Step 8: Commit**

```bash
git add "src/app/admin/(sections)/rates"
git commit -m "Add rates admin page (labor rates, crew-size table, projection settings)"
```

---

### Task 6: Pass Throughs admin page (role rates, rentals, soft costs)

**Files:**
- Create: `src/app/admin/(sections)/pass-throughs/actions.ts`
- Test: `src/app/admin/(sections)/pass-throughs/actions.test.ts`
- Create: `src/app/admin/(sections)/pass-throughs/PassThroughRatesSection.tsx`
- Create: `src/app/admin/(sections)/pass-throughs/RentalsSection.tsx`
- Create: `src/app/admin/(sections)/pass-throughs/SoftCostsSection.tsx`
- Create: `src/app/admin/(sections)/pass-throughs/page.tsx`

**Interfaces:**
- Consumes: `AdminTable`, `AdminColumn` (Task 2); `PassThroughRoleRate`, `RentalRate`, `SoftCostRate` types from `@prisma/client`.
- Produces: `updatePassThroughRoleRate`, `createRental`, `updateRental`, `deleteRental`, `createSoftCost`, `updateSoftCost`, `deleteSoftCost` from `./actions`.

- [ ] **Step 1: Write the failing integration test**

```ts
// src/app/admin/(sections)/pass-throughs/actions.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { prisma } from '@/lib/db';
import {
  updatePassThroughRoleRate, createRental, updateRental, deleteRental,
  createSoftCost, updateSoftCost, deleteSoftCost,
} from './actions';

describe('pass-throughs admin actions (integration — requires a live, seeded local Postgres)', () => {
  const restoreRoleRates: { id: string; amount: number }[] = [];
  const createdRentalIds: string[] = [];
  const createdSoftCostIds: string[] = [];

  afterEach(async () => {
    for (const r of restoreRoleRates.splice(0)) {
      await prisma.passThroughRoleRate.update({ where: { id: r.id }, data: { amount: r.amount } });
    }
    for (const id of createdRentalIds.splice(0)) {
      await prisma.rentalRate.deleteMany({ where: { id } });
    }
    for (const id of createdSoftCostIds.splice(0)) {
      await prisma.softCostRate.deleteMany({ where: { id } });
    }
  });

  it('updates a pass-through role rate', async () => {
    const original = await prisma.passThroughRoleRate.findFirstOrThrow({
      where: { kind: 'PerDiem', role: 'Technician' },
    });
    restoreRoleRates.push({ id: original.id, amount: original.amount });

    const result = await updatePassThroughRoleRate(original.id, { amount: '75' });
    expect(result.error).toBeUndefined();

    const updated = await prisma.passThroughRoleRate.findUniqueOrThrow({ where: { id: original.id } });
    expect(updated.amount).toBe(75);
  });

  it('rejects a negative pass-through role rate', async () => {
    const original = await prisma.passThroughRoleRate.findFirstOrThrow({
      where: { kind: 'PerDiem', role: 'Technician' },
    });
    const result = await updatePassThroughRoleRate(original.id, { amount: '-1' });
    expect(result.error).toMatch(/non-negative/);
  });

  it('creates, updates, and deletes a rental', async () => {
    const created = await createRental({ key: 'test-admin-rental-1', name: 'Test Rental', rate: '100', unit: 'day' });
    expect(created.error).toBeUndefined();
    const row = await prisma.rentalRate.findUniqueOrThrow({ where: { key: 'test-admin-rental-1' } });
    createdRentalIds.push(row.id);

    const updated = await updateRental(row.id, { key: 'test-admin-rental-1', name: 'Updated Rental', rate: '150', unit: 'day' });
    expect(updated.error).toBeUndefined();

    const deleted = await deleteRental(row.id);
    expect(deleted.error).toBeUndefined();
    createdRentalIds.splice(createdRentalIds.indexOf(row.id), 1);

    const gone = await prisma.rentalRate.findUnique({ where: { id: row.id } });
    expect(gone).toBeNull();
  });

  it('creates, updates, and deletes a soft cost', async () => {
    const created = await createSoftCost({ key: 'test-admin-softcost-1', name: 'Test Soft Cost', fee: '500' });
    expect(created.error).toBeUndefined();
    const row = await prisma.softCostRate.findUniqueOrThrow({ where: { key: 'test-admin-softcost-1' } });
    createdSoftCostIds.push(row.id);

    const updated = await updateSoftCost(row.id, { key: 'test-admin-softcost-1', name: 'Updated', fee: '600' });
    expect(updated.error).toBeUndefined();

    const deleted = await deleteSoftCost(row.id);
    expect(deleted.error).toBeUndefined();
    createdSoftCostIds.splice(createdSoftCostIds.indexOf(row.id), 1);

    const gone = await prisma.softCostRate.findUnique({ where: { id: row.id } });
    expect(gone).toBeNull();
  });

  it('rejects a duplicate rental key', async () => {
    const created = await createRental({ key: 'test-admin-rental-dup', name: 'A', rate: '1', unit: 'day' });
    expect(created.error).toBeUndefined();
    const row = await prisma.rentalRate.findUniqueOrThrow({ where: { key: 'test-admin-rental-dup' } });
    createdRentalIds.push(row.id);

    const dup = await createRental({ key: 'test-admin-rental-dup', name: 'B', rate: '2', unit: 'day' });
    expect(dup.error).toMatch(/already exists/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "src/app/admin/(sections)/pass-throughs/actions.test.ts"`
Expected: FAIL — `Cannot find module './actions'`.

- [ ] **Step 3: Implement `actions.ts`**

```ts
// src/app/admin/(sections)/pass-throughs/actions.ts
'use server';

import { prisma } from '@/lib/db';

interface ActionResult {
  error?: string;
}

function parseNonNegative(raw: string | undefined): number | null {
  if (raw === undefined || raw === '') return null;
  const value = Number(raw);
  if (Number.isNaN(value) || value < 0) return null;
  return value;
}

export async function updatePassThroughRoleRate(id: string, values: Record<string, string>): Promise<ActionResult> {
  const amount = parseNonNegative(values.amount);
  if (amount === null) return { error: 'Amount must be a non-negative number.' };

  await prisma.passThroughRoleRate.update({ where: { id }, data: { amount } });
  return {};
}

interface RentalOk {
  ok: true;
  key: string;
  name: string;
  rate: number;
  unit: string;
}
interface ValidationErr {
  ok: false;
  error: string;
}

function validateRentalValues(values: Record<string, string>): RentalOk | ValidationErr {
  const key = values.key?.trim();
  if (!key) return { ok: false, error: 'Key is required.' };
  const name = values.name?.trim();
  if (!name) return { ok: false, error: 'Name is required.' };
  const rate = parseNonNegative(values.rate);
  if (rate === null) return { ok: false, error: 'Rate must be a non-negative number.' };
  const unit = values.unit?.trim();
  if (!unit) return { ok: false, error: 'Billing unit is required.' };
  return { ok: true, key, name, rate, unit };
}

export async function createRental(values: Record<string, string>): Promise<ActionResult> {
  const parsed = validateRentalValues(values);
  if (!parsed.ok) return { error: parsed.error };

  const existing = await prisma.rentalRate.findUnique({ where: { key: parsed.key } });
  if (existing) return { error: `A rental with key "${parsed.key}" already exists.` };

  await prisma.rentalRate.create({ data: { key: parsed.key, name: parsed.name, rate: parsed.rate, unit: parsed.unit } });
  return {};
}

export async function updateRental(id: string, values: Record<string, string>): Promise<ActionResult> {
  const parsed = validateRentalValues(values);
  if (!parsed.ok) return { error: parsed.error };

  const keyOwner = await prisma.rentalRate.findUnique({ where: { key: parsed.key } });
  if (keyOwner && keyOwner.id !== id) return { error: `A rental with key "${parsed.key}" already exists.` };

  await prisma.rentalRate.update({ where: { id }, data: { key: parsed.key, name: parsed.name, rate: parsed.rate, unit: parsed.unit } });
  return {};
}

export async function deleteRental(id: string): Promise<ActionResult> {
  await prisma.rentalRate.delete({ where: { id } });
  return {};
}

interface SoftCostOk {
  ok: true;
  key: string;
  name: string;
  fee: number;
}

function validateSoftCostValues(values: Record<string, string>): SoftCostOk | ValidationErr {
  const key = values.key?.trim();
  if (!key) return { ok: false, error: 'Key is required.' };
  const name = values.name?.trim();
  if (!name) return { ok: false, error: 'Name is required.' };
  const fee = parseNonNegative(values.fee);
  if (fee === null) return { ok: false, error: 'Fee must be a non-negative number.' };
  return { ok: true, key, name, fee };
}

export async function createSoftCost(values: Record<string, string>): Promise<ActionResult> {
  const parsed = validateSoftCostValues(values);
  if (!parsed.ok) return { error: parsed.error };

  const existing = await prisma.softCostRate.findUnique({ where: { key: parsed.key } });
  if (existing) return { error: `A soft cost with key "${parsed.key}" already exists.` };

  await prisma.softCostRate.create({ data: { key: parsed.key, name: parsed.name, fee: parsed.fee } });
  return {};
}

export async function updateSoftCost(id: string, values: Record<string, string>): Promise<ActionResult> {
  const parsed = validateSoftCostValues(values);
  if (!parsed.ok) return { error: parsed.error };

  const keyOwner = await prisma.softCostRate.findUnique({ where: { key: parsed.key } });
  if (keyOwner && keyOwner.id !== id) return { error: `A soft cost with key "${parsed.key}" already exists.` };

  await prisma.softCostRate.update({ where: { id }, data: { key: parsed.key, name: parsed.name, fee: parsed.fee } });
  return {};
}

export async function deleteSoftCost(id: string): Promise<ActionResult> {
  await prisma.softCostRate.delete({ where: { id } });
  return {};
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run "src/app/admin/(sections)/pass-throughs/actions.test.ts"`
Expected: PASS (5 tests).

- [ ] **Step 5: Build the three sections and the page**

```tsx
// src/app/admin/(sections)/pass-throughs/PassThroughRatesSection.tsx
'use client';

import type { PassThroughRoleRate } from '@prisma/client';
import { AdminTable, type AdminColumn } from '@/components/admin/AdminTable';
import { updatePassThroughRoleRate } from './actions';

const ROLE_LABELS: Record<string, string> = {
  Technician: 'Technician',
  Construction_Manager: 'Construction Manager',
  RF_Engineer: 'RF-Engineer',
  RF_Technician: 'RF-Technician',
  Project_Coordinator: 'Project Coordinator',
  Project_Manager: 'Project Manager',
};

const columns: AdminColumn<PassThroughRoleRate>[] = [
  { key: 'kind', label: 'Kind', type: 'readonly' },
  { key: 'role', label: 'Role', type: 'readonly', format: (row) => ROLE_LABELS[row.role] ?? row.role },
  { key: 'amount', label: 'Amount', type: 'number', align: 'right', required: true },
];

export function PassThroughRatesSection({ rows }: { rows: PassThroughRoleRate[] }) {
  return (
    <section className="space-y-2">
      <h2 className="font-display text-lg text-navy">Per Diem / Lodging / Airfare Rates</h2>
      <AdminTable<PassThroughRoleRate> columns={columns} rows={rows} onUpdate={updatePassThroughRoleRate} />
    </section>
  );
}
```

```tsx
// src/app/admin/(sections)/pass-throughs/RentalsSection.tsx
'use client';

import type { RentalRate } from '@prisma/client';
import { AdminTable, type AdminColumn } from '@/components/admin/AdminTable';
import { createRental, updateRental, deleteRental } from './actions';

const columns: AdminColumn<RentalRate>[] = [
  { key: 'key', label: 'Key', type: 'text', required: true },
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'rate', label: 'Rate', type: 'number', align: 'right', required: true },
  { key: 'unit', label: 'Billing Unit', type: 'text', required: true },
];

const emptyValues = { key: '', name: '', rate: '0', unit: '' };

export function RentalsSection({ rows }: { rows: RentalRate[] }) {
  return (
    <section className="space-y-2">
      <h2 className="font-display text-lg text-navy">Rentals</h2>
      <AdminTable<RentalRate>
        columns={columns}
        rows={rows}
        onCreate={createRental}
        onUpdate={updateRental}
        onDelete={deleteRental}
        emptyValues={emptyValues}
      />
    </section>
  );
}
```

```tsx
// src/app/admin/(sections)/pass-throughs/SoftCostsSection.tsx
'use client';

import type { SoftCostRate } from '@prisma/client';
import { AdminTable, type AdminColumn } from '@/components/admin/AdminTable';
import { createSoftCost, updateSoftCost, deleteSoftCost } from './actions';

const columns: AdminColumn<SoftCostRate>[] = [
  { key: 'key', label: 'Key', type: 'text', required: true },
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'fee', label: 'Fee', type: 'number', align: 'right', required: true },
];

const emptyValues = { key: '', name: '', fee: '0' };

export function SoftCostsSection({ rows }: { rows: SoftCostRate[] }) {
  return (
    <section className="space-y-2">
      <h2 className="font-display text-lg text-navy">Soft Costs</h2>
      <AdminTable<SoftCostRate>
        columns={columns}
        rows={rows}
        onCreate={createSoftCost}
        onUpdate={updateSoftCost}
        onDelete={deleteSoftCost}
        emptyValues={emptyValues}
      />
    </section>
  );
}
```

```tsx
// src/app/admin/(sections)/pass-throughs/page.tsx
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
      <h1 className="font-display text-2xl text-navy">Pass Throughs</h1>
      <PassThroughRatesSection rows={roleRates} />
      <RentalsSection rows={rentals} />
      <SoftCostsSection rows={softCosts} />
    </div>
  );
}
```

- [ ] **Step 6: Run full verification**

Run: `npx tsc --noEmit` — expected: no errors.
Run: `npx vitest run` — expected: all tests pass.

- [ ] **Step 7: Manual verification**

`npm run dev`, log in, visit `/admin/pass-throughs`. Confirm all 18 role-rate rows, all rentals, and all soft costs render; add a rental, edit a role rate, delete the rental you just added. Cross-check on `/pass-throughs` that a role-rate edit changes the corresponding Per Diem/Lodging/Airfare line — then restore the value.

- [ ] **Step 8: Commit**

```bash
git add "src/app/admin/(sections)/pass-throughs"
git commit -m "Add pass-throughs admin page (role rates, rentals, soft costs)"
```

---

### Task 7: Estimate Defaults admin page

**Files:**
- Create: `src/app/admin/(sections)/defaults/actions.ts`
- Test: `src/app/admin/(sections)/defaults/actions.test.ts`
- Create: `src/app/admin/(sections)/defaults/EstimateDefaultsForm.tsx`
- Create: `src/app/admin/(sections)/defaults/page.tsx`

**Interfaces:**
- Consumes: `EstimateDefaults` type from `@prisma/client`.
- Produces: `updateEstimateDefaults` from `./actions` — consumed only by `EstimateDefaultsForm.tsx`.

- [ ] **Step 1: Write the failing integration test**

```ts
// src/app/admin/(sections)/defaults/actions.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { prisma } from '@/lib/db';
import { updateEstimateDefaults } from './actions';

describe('estimate defaults admin actions (integration — requires a live, seeded local Postgres)', () => {
  let restore: Record<string, number> | null = null;

  afterEach(async () => {
    if (restore) {
      await prisma.estimateDefaults.update({ where: { id: 'singleton' }, data: restore });
      restore = null;
    }
  });

  it('updates estimate defaults, converting percent inputs to fractions', async () => {
    const original = await prisma.estimateDefaults.findUniqueOrThrow({ where: { id: 'singleton' } });
    restore = {
      laborMarkupPct: original.laborMarkupPct,
      passThroughMarkupPct: original.passThroughMarkupPct,
      materialMarkupPct: original.materialMarkupPct,
      corporateMarkupPct: original.corporateMarkupPct,
      taxRate: original.taxRate,
      contingencyPct: original.contingencyPct,
    };

    const result = await updateEstimateDefaults({
      laborMarkupPct: '30', passThroughMarkupPct: '20', materialMarkupPct: '25',
      corporateMarkupPct: '5', taxRate: '8.25', contingencyPct: '10',
    });
    expect(result.error).toBeUndefined();

    const updated = await prisma.estimateDefaults.findUniqueOrThrow({ where: { id: 'singleton' } });
    expect(updated.laborMarkupPct).toBeCloseTo(0.30, 6);
    expect(updated.passThroughMarkupPct).toBeCloseTo(0.20, 6);
    expect(updated.taxRate).toBeCloseTo(0.0825, 6);
  });

  it('rejects an out-of-range percent', async () => {
    const result = await updateEstimateDefaults({
      laborMarkupPct: '150', passThroughMarkupPct: '20', materialMarkupPct: '25',
      corporateMarkupPct: '5', taxRate: '8.25', contingencyPct: '10',
    });
    expect(result.error).toMatch(/0 and 100/);
  });

  it('rejects a missing field', async () => {
    const result = await updateEstimateDefaults({
      laborMarkupPct: '', passThroughMarkupPct: '20', materialMarkupPct: '25',
      corporateMarkupPct: '5', taxRate: '8.25', contingencyPct: '10',
    });
    expect(result.error).toMatch(/required/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "src/app/admin/(sections)/defaults/actions.test.ts"`
Expected: FAIL — `Cannot find module './actions'`.

- [ ] **Step 3: Implement `actions.ts`**

```ts
// src/app/admin/(sections)/defaults/actions.ts
'use server';

import { prisma } from '@/lib/db';

interface ActionResult {
  error?: string;
}

interface DefaultsOk {
  ok: true;
  laborMarkupPct: number;
  passThroughMarkupPct: number;
  materialMarkupPct: number;
  corporateMarkupPct: number;
  taxRate: number;
  contingencyPct: number;
}
interface ValidationErr {
  ok: false;
  error: string;
}

function parsePercent(raw: string | undefined, label: string): number | { error: string } {
  if (raw === undefined || raw === '') return { error: `${label} is required.` };
  const value = Number(raw);
  if (Number.isNaN(value) || value < 0 || value > 100) return { error: `${label} must be between 0 and 100.` };
  return value / 100;
}

function validateDefaultsValues(values: Record<string, string>): DefaultsOk | ValidationErr {
  const laborMarkupPct = parsePercent(values.laborMarkupPct, 'Labor markup %');
  if (typeof laborMarkupPct !== 'number') return { ok: false, error: laborMarkupPct.error };
  const passThroughMarkupPct = parsePercent(values.passThroughMarkupPct, 'Pass-through markup %');
  if (typeof passThroughMarkupPct !== 'number') return { ok: false, error: passThroughMarkupPct.error };
  const materialMarkupPct = parsePercent(values.materialMarkupPct, 'Material markup %');
  if (typeof materialMarkupPct !== 'number') return { ok: false, error: materialMarkupPct.error };
  const corporateMarkupPct = parsePercent(values.corporateMarkupPct, 'Corporate markup %');
  if (typeof corporateMarkupPct !== 'number') return { ok: false, error: corporateMarkupPct.error };
  const taxRate = parsePercent(values.taxRate, 'Tax rate');
  if (typeof taxRate !== 'number') return { ok: false, error: taxRate.error };
  const contingencyPct = parsePercent(values.contingencyPct, 'Contingency %');
  if (typeof contingencyPct !== 'number') return { ok: false, error: contingencyPct.error };
  return {
    ok: true, laborMarkupPct, passThroughMarkupPct, materialMarkupPct, corporateMarkupPct, taxRate, contingencyPct,
  };
}

export async function updateEstimateDefaults(values: Record<string, string>): Promise<ActionResult> {
  const parsed = validateDefaultsValues(values);
  if (!parsed.ok) return { error: parsed.error };

  await prisma.estimateDefaults.update({
    where: { id: 'singleton' },
    data: {
      laborMarkupPct: parsed.laborMarkupPct,
      passThroughMarkupPct: parsed.passThroughMarkupPct,
      materialMarkupPct: parsed.materialMarkupPct,
      corporateMarkupPct: parsed.corporateMarkupPct,
      taxRate: parsed.taxRate,
      contingencyPct: parsed.contingencyPct,
    },
  });
  return {};
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run "src/app/admin/(sections)/defaults/actions.test.ts"`
Expected: PASS (3 tests).

- [ ] **Step 5: Build the form and the page**

```tsx
// src/app/admin/(sections)/defaults/EstimateDefaultsForm.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { EstimateDefaults } from '@prisma/client';
import { updateEstimateDefaults } from './actions';

function toDisplayValues(defaults: EstimateDefaults): Record<string, string> {
  return {
    laborMarkupPct: String(defaults.laborMarkupPct * 100),
    passThroughMarkupPct: String(defaults.passThroughMarkupPct * 100),
    materialMarkupPct: String(defaults.materialMarkupPct * 100),
    corporateMarkupPct: String(defaults.corporateMarkupPct * 100),
    taxRate: String(defaults.taxRate * 100),
    contingencyPct: String(defaults.contingencyPct * 100),
  };
}

const FIELDS: { key: string; label: string }[] = [
  { key: 'laborMarkupPct', label: 'Labor Markup %' },
  { key: 'passThroughMarkupPct', label: 'Pass-Through Markup %' },
  { key: 'materialMarkupPct', label: 'Material Markup %' },
  { key: 'corporateMarkupPct', label: 'Corporate Markup %' },
  { key: 'taxRate', label: 'Tax Rate %' },
  { key: 'contingencyPct', label: 'Contingency %' },
];

export function EstimateDefaultsForm({ defaults }: { defaults: EstimateDefaults }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(toDisplayValues(defaults));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSave() {
    setPending(true);
    setError(null);
    const result = await updateEstimateDefaults(values);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="bg-white rounded-lg shadow p-4 space-y-3 max-w-md">
      {error && <p className="text-red-700 text-sm">{error}</p>}
      {FIELDS.map((field) => (
        <label key={field.key} className="flex items-center justify-between gap-4">
          <span className="text-slate">{field.label}</span>
          <span className="flex items-center gap-1">
            <input
              type="number"
              className="w-24 border border-line rounded px-2 py-1 text-right"
              value={values[field.key] ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
            />
            <span className="text-slate text-sm">%</span>
          </span>
        </label>
      ))}
      <button
        disabled={pending}
        onClick={handleSave}
        className="bg-red hover:bg-red-700 text-white font-display font-semibold px-4 py-2 rounded transition-colors"
      >
        Save
      </button>
    </div>
  );
}
```

```tsx
// src/app/admin/(sections)/defaults/page.tsx
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
```

- [ ] **Step 6: Run full verification**

Run: `npx tsc --noEmit` — expected: no errors.
Run: `npx vitest run` — expected: all tests pass.
Run: `npm run build` — expected: succeeds, all 6 admin routes present in the route list.

- [ ] **Step 7: Full end-to-end manual verification (this is the last task — confirm the whole Admin Area together)**

`npm run dev`:
1. Log in at `/admin/login`; confirm the sub-nav shows Materials, Labor Tasks, Rates, Pass Throughs, Defaults, and "Log Out" works (redirects to `/admin/login` and the session cookie is cleared).
2. Edit the Labor Markup % on `/admin/defaults`, then confirm `/summary`'s Executive Summary reflects the new markup — then restore the original 25%.
3. Confirm every one of the 6 admin routes renders without a console error, and that none of them are reachable without the session cookie (clear cookies, confirm each redirects to `/admin/login`).

- [ ] **Step 8: Commit**

```bash
git add "src/app/admin/(sections)/defaults"
git commit -m "Add estimate defaults admin page"
```
