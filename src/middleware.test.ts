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
