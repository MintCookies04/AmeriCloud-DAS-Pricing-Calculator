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
