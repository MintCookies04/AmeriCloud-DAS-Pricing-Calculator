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
