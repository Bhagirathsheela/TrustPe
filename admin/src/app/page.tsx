'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '../lib/auth-context';

export default function HomePage() {
  const { ready, isAuthenticated, isAdmin } = useAdminAuth();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    if (!isAuthenticated) router.replace('/login');
    else if (!isAdmin) router.replace('/not-authorized');
    else router.replace('/kyc');
  }, [ready, isAuthenticated, isAdmin, router]);

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="text-slate-500">Loading…</div>
    </main>
  );
}
