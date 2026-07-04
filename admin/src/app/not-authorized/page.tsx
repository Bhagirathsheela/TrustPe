'use client';

import { useAdminAuth } from '../../lib/auth-context';

export default function NotAuthorizedPage() {
  const { user, logout } = useAdminAuth();

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold text-slate-900">Not authorized</h1>
        <p className="text-sm text-slate-500 mt-2">
          Your account ({user?.email}) doesn't have admin access. If you need access, ask the
          TrustPe owner to promote you via the{' '}
          <code className="px-1 py-0.5 bg-slate-100 rounded">promote-admin</code> script.
        </p>
        <button
          onClick={() => logout()}
          className="mt-6 px-4 py-2 bg-slate-200 hover:bg-slate-300 rounded-lg text-sm"
        >
          Sign out
        </button>
      </div>
    </main>
  );
}
