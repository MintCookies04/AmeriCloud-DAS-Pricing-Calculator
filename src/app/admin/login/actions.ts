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
