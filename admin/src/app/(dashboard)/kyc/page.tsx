'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiRequest } from '../../../lib/api';
import type { AdminKycListItem, AdminKycQueueResponse } from '../../../lib/types';

const STATUS_TABS: Array<{
  value: 'submitted' | 'approved' | 'rejected' | 'needs_clarification';
  label: string;
}> = [
  { value: 'submitted', label: 'Pending' },
  { value: 'needs_clarification', label: 'Needs info' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

const STATUS_BADGE: Record<string, string> = {
  submitted: 'bg-amber-100 text-amber-800',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800',
  needs_clarification: 'bg-blue-100 text-blue-800',
};

export default function KycQueuePage() {
  const [status, setStatus] = useState<(typeof STATUS_TABS)[number]['value']>('submitted');
  const [items, setItems] = useState<AdminKycListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<AdminKycQueueResponse>({
        path: '/admin/kyc/queue',
        query: { status, limit: 50 },
      });
      setItems(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load queue');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">KYC review</h1>
        <button
          onClick={() => void load()}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          ↻ Refresh
        </button>
      </div>

      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatus(tab.value)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
              status === tab.value
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-slate-500 py-12 text-center">Loading…</div>
      ) : error ? (
        <div className="text-red-600 py-12 text-center">{error}</div>
      ) : items.length === 0 ? (
        <div className="text-slate-500 py-12 text-center bg-white rounded-lg border border-slate-200">
          No KYC records with this status.
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Applicant</th>
                <th className="px-4 py-3">PAN</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{item.userName}</div>
                    <div className="text-xs text-slate-500">
                      {item.userEmail} · {item.userPhone}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    <div>{item.pan}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        STATUS_BADGE[item.status] ?? 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {item.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">
                    {new Date(item.submittedAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/kyc/${item.id}`}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      Review →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
