'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiRequest } from '../../../lib/api';
import type { AdminDisputeListItem, AdminDisputeQueueResponse } from '../../../lib/types';

const STATUS_TABS: Array<{ value: 'disputed' | 'resolved'; label: string }> = [
  { value: 'disputed', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
];

function formatRupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

export default function DisputesQueuePage() {
  const [status, setStatus] = useState<'disputed' | 'resolved'>('disputed');
  const [items, setItems] = useState<AdminDisputeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<AdminDisputeQueueResponse>({
        path: '/admin/disputes/queue',
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
        <h1 className="text-2xl font-semibold text-slate-900">Payment disputes</h1>
        <button onClick={() => void load()} className="text-sm text-blue-600 hover:text-blue-800">
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
          {status === 'disputed' ? 'No open disputes — nice and quiet.' : 'No resolved disputes yet.'}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Payer / Payee</th>
                <th className="px-4 py-3">Kind</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Receiver said</th>
                <th className="px-4 py-3">Opened</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">
                      {item.payerName} → {item.payeeName}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    {item.kind === 'emi' ? `EMI #${item.emiNumber}` : item.kind}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-900 font-medium">
                    {formatRupees(item.amountPaise)}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700 max-w-xs truncate">
                    {item.receiverAttestation?.reason ?? '(no reason given)'}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">
                    {new Date(item.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/disputes/${item.id}`}
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
