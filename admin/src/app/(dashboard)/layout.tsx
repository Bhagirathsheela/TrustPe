'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAdminAuth } from '../../lib/auth-context';
import { apiRequest } from '../../lib/api';
import type { AdminDisputeQueueResponse, AdminKycQueueResponse } from '../../lib/types';

const PENDING_REFRESH_MS = 30_000;

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { ready, isAuthenticated, isAdmin, user, logout } = useAdminAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [disputeCount, setDisputeCount] = useState<number | null>(null);

  const loadPending = useCallback(async () => {
    if (!isAuthenticated || !isAdmin) return;
    try {
      const [kyc, disputes] = await Promise.all([
        apiRequest<AdminKycQueueResponse>({
          path: '/admin/kyc/queue',
          query: { status: 'submitted', limit: 100 },
        }),
        apiRequest<AdminDisputeQueueResponse>({
          path: '/admin/disputes/queue',
          query: { status: 'disputed', limit: 100 },
        }).catch(() => ({ items: [], nextCursor: null })),
      ]);
      setPendingCount(kyc.items.length);
      setDisputeCount(disputes.items.length);
    } catch {
      // Quietly ignore — count badges are non-critical UI.
    }
  }, [isAuthenticated, isAdmin]);

  useEffect(() => {
    if (!ready) return;
    if (!isAuthenticated) router.replace('/login');
    else if (!isAdmin) router.replace('/not-authorized');
  }, [ready, isAuthenticated, isAdmin, router]);

  // Background-refresh pending count so the badge stays current as reviewers
  // work through the queue.
  useEffect(() => {
    if (!ready || !isAuthenticated || !isAdmin) return;
    void loadPending();
    const interval = setInterval(loadPending, PENDING_REFRESH_MS);
    return () => clearInterval(interval);
  }, [ready, isAuthenticated, isAdmin, loadPending]);

  if (!ready || !isAuthenticated || !isAdmin) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-500">Loading…</div>
      </main>
    );
  }

  const isKyc = pathname.startsWith('/kyc');
  const isDisputes = pathname.startsWith('/disputes');
  const isUsers = pathname.startsWith('/users');
  const isAudit = pathname.startsWith('/audit-logs');

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/kyc" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center shadow-sm shadow-blue-500/20 group-hover:shadow-md transition">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-4 h-4"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <span className="text-base font-semibold text-slate-900">TrustPe Admin</span>
            </Link>
            <nav className="flex gap-1 text-sm">
              <Link
                href="/kyc"
                className={`px-3 py-1.5 rounded-md flex items-center gap-2 transition ${
                  isKyc
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                KYC review
                {pendingCount !== null && pendingCount > 0 ? (
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded-full font-semibold tabular-nums ${
                      isKyc ? 'bg-blue-600 text-white' : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {pendingCount}
                  </span>
                ) : null}
              </Link>
              <Link
                href="/disputes"
                className={`px-3 py-1.5 rounded-md flex items-center gap-2 transition ${
                  isDisputes
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                Disputes
                {disputeCount !== null && disputeCount > 0 ? (
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded-full font-semibold tabular-nums ${
                      isDisputes ? 'bg-blue-600 text-white' : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {disputeCount}
                  </span>
                ) : null}
              </Link>
              <Link
                href="/users"
                className={`px-3 py-1.5 rounded-md transition ${
                  isUsers
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                Users
              </Link>
              <Link
                href="/audit-logs"
                className={`px-3 py-1.5 rounded-md transition ${
                  isAudit
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                Audit log
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="hidden sm:flex flex-col items-end leading-tight">
              <span className="text-slate-900 font-medium">{user?.email}</span>
              {user?.roles?.length ? (
                <span className="text-xs text-slate-500">
                  {user.roles.filter((r) => r !== 'user').join(' · ') || 'admin'}
                </span>
              ) : null}
            </div>
            <button
              onClick={() => logout().then(() => router.replace('/login'))}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-md text-slate-700 text-sm font-medium transition"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
