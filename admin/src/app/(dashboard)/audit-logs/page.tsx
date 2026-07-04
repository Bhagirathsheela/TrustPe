'use client';

/**
 * Admin audit log viewer.
 *
 * Filterable list across the entire AuditLog collection. Mostly an
 * investigation tool — pivoting from a user, dispute, or KYC record into
 * "what actually happened to this thing in order".
 *
 * URL query params (entityType, entityId, actorId, action, from, to) seed
 * the filters so the per-user-detail page can deep-link in.
 */
import { useCallback, useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiRequest } from '../../../lib/api';
import type { AdminAuditLogResponse, AdminAuditLogRow } from '../../../lib/types';

function AuditLogsInner() {
  const sp = useSearchParams();
  const [entityType, setEntityType] = useState(sp?.get('entityType') ?? '');
  const [entityId, setEntityId] = useState(sp?.get('entityId') ?? '');
  const [actorId, setActorId] = useState(sp?.get('actorId') ?? '');
  const [action, setAction] = useState(sp?.get('action') ?? '');
  const [from, setFrom] = useState(sp?.get('from') ?? '');
  const [to, setTo] = useState(sp?.get('to') ?? '');

  const [items, setItems] = useState<AdminAuditLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<AdminAuditLogResponse>({
        path: '/admin/audit-logs',
        query: {
          entityType: entityType || undefined,
          entityId: entityId || undefined,
          actorId: actorId || undefined,
          action: action || undefined,
          from: from || undefined,
          to: to || undefined,
          page,
          limit: pageSize,
        },
      });
      setItems(data.items);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit log');
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId, actorId, action, from, to, page, pageSize]);

  useEffect(() => {
    void load();
  }, [load]);

  const clearFilters = () => {
    setEntityType('');
    setEntityId('');
    setActorId('');
    setAction('');
    setFrom('');
    setTo('');
    setPage(1);
  };

  const totalPages = Math.max(Math.ceil(total / pageSize), 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Audit log</h1>
        <p className="text-sm text-slate-500 mt-1">
          Append-only record of every state change touching money or identity. Retained 5 years.
        </p>
      </div>

      {/* Filter bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <FilterInput
            label="Action (prefix)"
            value={action}
            onChange={setAction}
            placeholder="e.g. loan.disbursed"
            mono
          />
          <FilterInput
            label="Entity type"
            value={entityType}
            onChange={setEntityType}
            placeholder="loan, user, kyc…"
          />
          <FilterInput
            label="Entity ID"
            value={entityId}
            onChange={setEntityId}
            placeholder="ObjectId"
            mono
          />
          <FilterInput
            label="Actor ID"
            value={actorId}
            onChange={setActorId}
            placeholder="User ID"
            mono
          />
          <FilterInput
            label="From"
            value={from}
            onChange={setFrom}
            type="datetime-local"
          />
          <FilterInput label="To" value={to} onChange={setTo} type="datetime-local" />
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => {
              setPage(1);
              void load();
            }}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md"
          >
            Apply filters
          </button>
          <button
            onClick={clearFilters}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-md"
          >
            Clear
          </button>
        </div>
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {/* Results table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-xs tabular-nums">
          <thead className="bg-slate-50 text-slate-500 uppercase">
            <tr>
              <th className="px-4 py-2.5 text-left font-semibold">When</th>
              <th className="px-4 py-2.5 text-left font-semibold">Actor</th>
              <th className="px-4 py-2.5 text-left font-semibold">Action</th>
              <th className="px-4 py-2.5 text-left font-semibold">Entity</th>
              <th className="px-4 py-2.5 text-left font-semibold">IP</th>
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
                  No audit entries match these filters.
                </td>
              </tr>
            ) : (
              items.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
                  className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer transition"
                >
                  <td className="px-4 py-2 text-slate-600">{new Date(row.at).toLocaleString()}</td>
                  <td className="px-4 py-2">
                    <span className="text-slate-700">{row.actorType}</span>
                    {row.actorId ? (
                      <span className="text-slate-400 ml-1 font-mono">
                        {row.actorId.slice(-8)}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2">
                    <span className="font-mono text-slate-900">{row.action}</span>
                  </td>
                  <td className="px-4 py-2 text-slate-700">
                    {row.entityType}{' '}
                    <span className="font-mono text-slate-400">{row.entityId.slice(-8)}</span>
                  </td>
                  <td className="px-4 py-2 text-slate-500 font-mono">{row.ip ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-slate-600">
        <div>
          Page {page} of {totalPages} · {total.toLocaleString()} entries
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

function FilterInput({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  mono = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  mono?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-xs uppercase text-slate-500 mb-1">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 ${
          mono ? 'font-mono text-xs' : ''
        }`}
      />
    </label>
  );
}

export default function AdminAuditLogsPage() {
  return (
    <Suspense fallback={<div className="text-slate-500">Loading…</div>}>
      <AuditLogsInner />
    </Suspense>
  );
}
