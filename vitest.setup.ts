import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Server Actions in src/app/admin/**/actions.ts call revalidatePath() on their
// success path. Outside a real Next.js request, there is no static-generation
// store for it to invalidate, and the real implementation throws
// ("Invariant: static generation store missing in revalidatePath"). Our
// integration tests call those action functions directly (not through an HTTP
// request), so we mock next/cache to a no-op here — there's no real Router
// Cache in the test process to assert against anyway.
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

afterEach(() => {
  cleanup();
});
