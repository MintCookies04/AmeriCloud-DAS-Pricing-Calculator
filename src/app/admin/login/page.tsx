import { loginAction } from './actions';

export default function AdminLoginPage({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <form action={loginAction} className="bg-white rounded-lg shadow p-8 w-full max-w-sm space-y-4">
        <h1 className="font-display text-3xl font-bold tracking-tight text-navy">Admin Login</h1>
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
