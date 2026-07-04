'use client';

/**
 * Admin users directory.
 *
 * Closed pilot: small membership, so a single paginated table with simple
 * full-text search and status/KYC filters is sufficient. Clicking a row
 * opens the per-user detail view.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiRequest } from '../../../lib/api';
import type { AdminUserListItem, AdminUserListResponse } from '../../../lib/types';

const STATUS_BADGE: Record<string, string> = {
  unverified: 'bg-slate-100 text-slate-700',
  onboarding: 'bg-blue-100 text-blue-800',
  pending_review: 'bg-amber-100 text-amber-800',
  active: 'bg-emerald-100 text-emerald-800',
  suspended: 'bg-red-100 text-red-800',
};

const KYC_BADGE: Record<string, string> = {
  not_started: 'bg-slate-100 text-slate-600',
  submitted: 'bg-amber-100 text-amber-800',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800',
  needs_clarification: 'bg-blue-100 text-blue-800',
};

const TRUST_BAND_COLOR: Record<string, string> = {
  building: 'text-slate-500',
  fair: 'text-blue-600',
  good: 'text-emerald-600',
  very_good: 'text-emerald-700',
  excellent: 'text-purple-700',
};

export default function AdminUsersPage() {
  const [items, setItems] = useState<AdminUserListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [kycFilter, setKycFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<AdminUserListResponse>({
        path: '/admin/users',
        query: {
          q: q || undefined,
          status: statusFilter || undefined,
          kycStatus: kycFilter || undefined,
          page,
          limit: pageSize,
        },
      });
      setItems(data.items);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [q, statusFilter, kycFilter, page, pageSize]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(Math.ceil(total / pageSize), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Users</h1>
          <p className="text-sm text-slate-500 mt-1">
            Directory of all pilot members. {total.toLocaleString()} total.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap gap-3">
        <input
          type="text"
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
          placeholder="Search by name, email, phone, handle…"
          className="flex-1 min-w-[280px] px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
        />
        <select
          value={statusFilter}
          onChange={(e) => {
            setPage(1);
            setStatusFilter(e.target.value);
          }}
          className="px-3 py-2 text-sm border border-slate-200 rounded-md bg-white"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="onboarding">Onboarding</option>
          <option value="pending_review">Pending review</option>
          <option value="suspended">Suspended</option>
          <option value="unverified">Unverified</option>
        </select>
        <select
          value={kycFilter}
          onChange={(e) => {
            setPage(1);
            setKycFilter(e.target.value);
          }}
          className="px-3 py-2 text-sm border border-slate-200 rounded-md bg-white"
        >
          <option value="">All KYC</option>
          <option value="approved">KYC approved</option>
          <option value="submitted">KYC submitted</option>
          <option value="needs_clarification">Needs clarification</option>
          <option value="rejected">Rejected</option>
          <option value="not_started">Not started</option>
        </select>
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">User</th>
              <th className="px-4 py-3 text-left font-semibold">Status</th>
              <th className="px-4 py-3 text-left font-semibold">KYC</th>
              <th className="px-4 py-3 text-left font-semibold">TrustScore</th>
              <th className="px-4 py-3 text-left font-semibold">Joined</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                  Loading…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                  No users match these filters.
                </td>
              </tr>
            ) : (
              items.map((u) => (
                <tr key={u.id} className="border-t border-slate-100 hover:bg-slate-50 transition">
                  <td className="px-4 py-3">
                    <Link href={`/users/${u.id}`} className="block">
                      <div className="font-medium text-slate-900 group-hover:text-blue-700">
                        {u.name}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {u.email} · {u.phone}
                        {u.handle ? ` · @${u.handle}` : ''}
                      </div>
                      {u.roles.filter((r) => r !== 'user').length > 0 ? (
                        <div className="text-xs text-purple-700 font-medium mt-0.5">
                          {u.roles.filter((r) => r !== 'user').join(' · ')}
                        </div>
                      ) : null}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        STATUS_BADGE[u.status] ?? 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {u.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        KYC_BADGE[u.kycStatus] ?? 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {u.kycStatus.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`font-semibold tabular-nums ${
                        TRUST_BAND_COLOR[u.trustBand] ?? 'text-slate-700'
                      }`}
                    >
                      {u.trustScore}
                    </span>
                    <span className="text-xs text-slate-500 ml-1">
                      {u.trustBand.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 text-xs tabular-nums">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-slate-600">
        <div>
          Page {page} of {totalPages} · {total.toLocaleString()} users
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setPage((p) => Math.max(p - 1, 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 border border-slate-200 rounded-md disabled:opacity-40 hover:bg-slate-50"
          >
            ← Previous
          </button>
          <button
            onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
            disabled={page >= totalPages}
            className="px-3 py-1.5 border border-slate-200 rounded-md disabled:opacity-40 hover:bg-slate-50"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
