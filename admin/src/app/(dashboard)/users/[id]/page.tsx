'use client';

/**
 * Admin per-user detail.
 *
 * Single page that pulls together everything an operator needs to know about
 * a member: identity, profile, KYC, loans (both sides), reviews received, and
 * recent audit-log activity. Read-only — mutations live in their own admin
 * tools (KYC decision, dispute resolution).
 */
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiRequest } from '../../../../lib/api';
import type { AdminUserDetail, AdminUserLoanRow } from '../../../../lib/types';

const STATUS_BADGE: Record<string, string> = {
  unverified: 'bg-slate-100 text-slate-700',
  onboarding: 'bg-blue-100 text-blue-800',
  pending_review: 'bg-amber-100 text-amber-800',
  active: 'bg-emerald-100 text-emerald-800',
  suspended: 'bg-red-100 text-red-800',
};

const LOAN_STATUS_BADGE: Record<string, string> = {
  awaiting_disbursal: 'bg-amber-100 text-amber-800',
  awaiting_agreement: 'bg-blue-100 text-blue-800',
  active: 'bg-emerald-100 text-emerald-800',
  closed: 'bg-slate-100 text-slate-700',
  defaulted: 'bg-red-100 text-red-800',
  cancelled: 'bg-slate-100 text-slate-500',
};

function rupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

export default function AdminUserDetailPage() {
  const params = useParams<{ id: string }>();
  const userId = params?.id ?? '';
  const [data, setData] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<AdminUserDetail>({ path: `/admin/users/${userId}` });
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) void load();
  }, [userId, load]);

  if (loading) {
    return <div className="text-slate-500">Loading user…</div>;
  }
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4 text-sm text-red-800">
        {error}
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/users" className="hover:text-slate-900">
          ← All users
        </Link>
      </div>

      {/* Identity header */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 flex items-start gap-5">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center text-blue-700 font-bold text-xl">
          {data.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-slate-900">{data.name}</h1>
          <div className="text-sm text-slate-600 mt-1">
            {data.email} · {data.phone}
            {data.handle ? ` · @${data.handle}` : ''}
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                STATUS_BADGE[data.status] ?? 'bg-slate-100 text-slate-600'
              }`}
            >
              {data.status}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-700">
              KYC: {data.kycStatus.replace('_', ' ')}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-purple-100 text-purple-800">
              TrustScore {data.trustScore} ({data.trustBand.replace('_', ' ')})
            </span>
            {data.roles.filter((r) => r !== 'user').map((r) => (
              <span
                key={r}
                className="text-xs px-2 py-0.5 rounded-full font-medium bg-indigo-100 text-indigo-800"
              >
                {r}
              </span>
            ))}
          </div>
          {data.suspendedAt ? (
            <div className="mt-3 bg-red-50 border border-red-200 rounded p-2 text-xs text-red-800">
              Suspended {new Date(data.suspendedAt).toLocaleString()}
              {data.suspendedReason ? ` — ${data.suspendedReason}` : ''}
            </div>
          ) : null}
        </div>
        <div className="text-right text-xs text-slate-500">
          Joined {new Date(data.createdAt).toLocaleDateString()}
        </div>
      </div>

      {/* Profile + KYC */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="Profile">
          {data.profile ? (
            <dl className="grid grid-cols-3 gap-x-3 gap-y-2 text-sm">
              <DtDd label="City" value={data.profile.city} />
              <DtDd
                label="Occupation"
                value={
                  data.profile.occupationCategory
                    ? data.profile.occupationCategory.replace(/_/g, ' ')
                    : undefined
                }
              />
              <DtDd label="Detail" value={data.profile.occupationDetail} />
              <DtDd
                label="Monthly income"
                value={data.profile.declaredMonthlyIncome?.replace(/_/g, ' ')}
              />
              {data.profile.bio ? (
                <div className="col-span-3 mt-2">
                  <dt className="text-xs uppercase text-slate-500 mb-1">Bio</dt>
                  <dd className="text-slate-800 text-sm">{data.profile.bio}</dd>
                </div>
              ) : null}
            </dl>
          ) : (
            <Empty>No profile yet</Empty>
          )}
        </Card>

        <Card title="KYC">
          {data.kyc ? (
            <dl className="grid grid-cols-3 gap-x-3 gap-y-2 text-sm">
              <DtDd label="Status" value={data.kyc.status.replace('_', ' ')} />
              <DtDd label="PAN" value={data.kyc.pan} mono />
              <DtDd label="VPA" value={data.kyc.vpa} mono />
              <DtDd
                label="Submitted"
                value={new Date(data.kyc.submittedAt).toLocaleString()}
              />
              {data.kyc.reviewedAt ? (
                <DtDd
                  label="Reviewed"
                  value={new Date(data.kyc.reviewedAt).toLocaleString()}
                />
              ) : null}
              {data.kyc.reviewerNotes ? (
                <div className="col-span-3 mt-1">
                  <dt className="text-xs uppercase text-slate-500 mb-1">Reviewer notes</dt>
                  <dd className="text-slate-700 text-sm italic">
                    &ldquo;{data.kyc.reviewerNotes}&rdquo;
                  </dd>
                </div>
              ) : null}
              <div className="col-span-3 mt-2">
                <Link
                  href={`/kyc/${data.kyc.id}`}
                  className="text-blue-700 text-xs font-medium hover:underline"
                >
                  Open KYC record →
                </Link>
              </div>
            </dl>
          ) : (
            <Empty>No KYC submitted</Empty>
          )}
        </Card>
      </div>

      {/* Loans */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card
          title={`Loans as borrower (${data.loans.asBorrower.length})`}
          subtitle="Most recent 25"
        >
          <LoanList loans={data.loans.asBorrower} role="borrower" />
        </Card>
        <Card
          title={`Loans as lender (${data.loans.asLender.length})`}
          subtitle="Most recent 25"
        >
          <LoanList loans={data.loans.asLender} role="lender" />
        </Card>
      </div>

      {/* Reviews received */}
      <Card
        title={`Reviews received (${data.reviewsReceived.length})`}
        subtitle="Most recent 10"
      >
        {data.reviewsReceived.length === 0 ? (
          <Empty>No reviews yet</Empty>
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.reviewsReceived.map((r, idx) => (
              <li key={idx} className="py-3">
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-amber-500">
                    {'★'.repeat(r.rating)}
                    <span className="text-slate-300">{'★'.repeat(5 - r.rating)}</span>
                  </span>
                  <span className="text-slate-700 font-medium">{r.reviewerName}</span>
                  <span className="text-xs text-slate-500">as {r.role}</span>
                  <span className="text-xs text-slate-400 ml-auto">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </span>
                </div>
                {r.comment ? (
                  <p className="text-sm text-slate-700 mt-1 italic">&ldquo;{r.comment}&rdquo;</p>
                ) : null}
                {r.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {r.tags.map((t) => (
                      <span
                        key={t}
                        className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Audit log slice */}
      <Card
        title={`Recent audit activity (${data.auditLog.length})`}
        subtitle="Last 50 actions touching this user"
      >
        {data.auditLog.length === 0 ? (
          <Empty>No audit entries</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs tabular-nums">
              <thead className="text-slate-500 uppercase">
                <tr className="text-left">
                  <th className="py-2 pr-3 font-semibold">When</th>
                  <th className="py-2 pr-3 font-semibold">Actor</th>
                  <th className="py-2 pr-3 font-semibold">Action</th>
                  <th className="py-2 pr-3 font-semibold">Entity</th>
                  <th className="py-2 pr-3 font-semibold">IP</th>
                </tr>
              </thead>
              <tbody>
                {data.auditLog.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="py-1.5 pr-3 text-slate-600">
                      {new Date(row.at).toLocaleString()}
                    </td>
                    <td className="py-1.5 pr-3">
                      <span className="text-slate-700">{row.actorType}</span>
                      {row.actorId ? (
                        <span className="text-slate-400 ml-1 font-mono">
                          {row.actorId.slice(-6)}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-1.5 pr-3">
                      <span className="font-mono text-slate-800">{row.action}</span>
                    </td>
                    <td className="py-1.5 pr-3 text-slate-600">
                      {row.entityType}{' '}
                      <span className="font-mono text-slate-400">
                        {row.entityId.slice(-6)}
                      </span>
                    </td>
                    <td className="py-1.5 pr-3 text-slate-500 font-mono">{row.ip ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Link
              href={`/audit-logs?entityType=user&entityId=${userId}`}
              className="inline-block mt-3 text-blue-700 text-xs font-medium hover:underline"
            >
              View full audit log →
            </Link>
          </div>
        )}
      </Card>
    </div>
  );
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white border border-slate-200 rounded-lg p-5">
      <header className="mb-3">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {subtitle ? <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p> : null}
      </header>
      {children}
    </section>
  );
}

function DtDd({ label, value, mono = false }: { label: string; value?: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs uppercase text-slate-500">{label}</dt>
      <dd className={`text-slate-800 ${mono ? 'font-mono text-xs' : ''}`}>
        {value || <span className="text-slate-400">—</span>}
      </dd>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-sm text-slate-400 italic">{children}</div>;
}

function LoanList({ loans, role }: { loans: AdminUserLoanRow[]; role: 'borrower' | 'lender' }) {
  if (loans.length === 0) {
    return <Empty>No loans as {role}</Empty>;
  }
  return (
    <ul className="divide-y divide-slate-100">
      {loans.map((l) => (
        <li key={l.id} className="py-2.5 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-slate-900">
              {rupees(l.amountPaise)}{' '}
              <span className="text-slate-500 font-normal">@ {l.roiPercent}%</span>
            </div>
            <div className="text-xs text-slate-500">
              with {l.counterpartyName} · {l.tenureMonths}mo ·{' '}
              {new Date(l.createdAt).toLocaleDateString()}
            </div>
          </div>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              LOAN_STATUS_BADGE[l.status] ?? 'bg-slate-100 text-slate-600'
            }`}
          >
            {l.status.replace('_', ' ')}
          </span>
        </li>
      ))}
    </ul>
  );
}
