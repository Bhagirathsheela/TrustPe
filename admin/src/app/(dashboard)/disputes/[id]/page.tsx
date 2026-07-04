'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { apiRequest, ApiError } from '../../../../lib/api';
import type { AdminDisputeDetail } from '../../../../lib/types';

const STATUS_BADGE: Record<string, string> = {
  disputed: 'bg-red-100 text-red-800',
  verified: 'bg-emerald-100 text-emerald-800',
  failed: 'bg-slate-100 text-slate-700',
};

function formatRupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

type Action = 'verify' | 'mark_failed' | 'default_loan';

export default function DisputeDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [detail, setDetail] = useState<AdminDisputeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [action, setAction] = useState<Action | ''>('');
  const [reason, setReason] = useState('');
  const [defaultBy, setDefaultBy] = useState<'borrower' | 'lender'>('borrower');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<AdminDisputeDetail>({ path: `/admin/disputes/${id}` });
      setDetail(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dispute');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const onResolve = async () => {
    if (!action) {
      alert('Pick a resolution action.');
      return;
    }
    if (reason.trim().length < 10) {
      alert('Reason must be at least 10 characters.');
      return;
    }
    const confirmMsg =
      action === 'verify'
        ? 'Confirm the payment was received. The loan flow will resume.'
        : action === 'mark_failed'
          ? 'Confirm the payment never happened. The payer can retry.'
          : `Default the loan against the ${defaultBy}. -100 TrustScore penalty applied.`;
    if (!confirm(confirmMsg)) return;

    setSubmitting(true);
    try {
      const updated = await apiRequest<AdminDisputeDetail>({
        path: `/admin/disputes/${id}/resolve`,
        method: 'POST',
        body: {
          action,
          reason: reason.trim(),
          defaultBy: action === 'default_loan' ? defaultBy : undefined,
        },
      });
      setDetail(updated);
      setAction('');
      setReason('');
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Resolution failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="text-slate-500 py-12 text-center">Loading…</div>;
  if (error || !detail) {
    return <div className="text-red-600 py-12 text-center">{error ?? 'Not found'}</div>;
  }

  const isOpen = detail.status === 'disputed';

  return (
    <div>
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="text-sm text-blue-600 hover:text-blue-800 mb-2"
        >
          ← Back to queue
        </button>
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-semibold text-slate-900">
            Dispute · {detail.kind === 'emi' ? `EMI #${detail.emiNumber}` : detail.kind} ·{' '}
            {formatRupees(detail.amountPaise)}
          </h1>
          <span
            className={`px-2 py-1 rounded text-xs font-medium ${
              STATUS_BADGE[detail.status] ?? 'bg-slate-100 text-slate-700'
            }`}
          >
            {detail.status}
          </span>
        </div>
        <div className="text-sm text-slate-500 mt-1">
          Reference {detail.referenceId.slice(0, 8)} · Opened{' '}
          {new Date(detail.createdAt).toLocaleString()}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <PartyCard role="Payer" data={detail.payer} vpa={detail.payerVpa} />
        <PartyCard role="Payee" data={detail.payee} vpa={detail.payeeVpa} />
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
        <h2 className="text-base font-semibold text-slate-900 mb-4">Loan context</h2>
        <dl className="grid grid-cols-3 gap-4 text-sm">
          <Field label="Status" value={detail.loan.status} />
          <Field label="Principal" value={formatRupees(detail.loan.amountPaise)} />
          <Field label="Tenure" value={`${detail.loan.tenureMonths} months`} />
          <Field label="ROI" value={`${detail.loan.roiPercent}% p.a.`} />
          <Field
            label="Agreement signed"
            value={new Date(detail.loan.agreedAt).toLocaleDateString()}
          />
          {detail.loan.disbursedAt ? (
            <Field
              label="Disbursed"
              value={new Date(detail.loan.disbursedAt).toLocaleDateString()}
            />
          ) : null}
        </dl>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
        <h2 className="text-base font-semibold text-slate-900 mb-4">Evidence</h2>
        <div className="grid grid-cols-2 gap-6 text-sm">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-2">
              Payer marked sent
            </div>
            {detail.payerEvidence ? (
              <div className="text-slate-700">
                {detail.payerEvidence.submittedAt
                  ? new Date(detail.payerEvidence.submittedAt).toLocaleString()
                  : '—'}
                {detail.payerEvidence.utr ? (
                  <div className="mt-1 font-mono text-xs">
                    UTR {detail.payerEvidence.utr}
                  </div>
                ) : (
                  <div className="mt-1 text-slate-500">No UTR provided</div>
                )}
              </div>
            ) : (
              <div className="text-slate-500">No payer evidence captured</div>
            )}
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-2">
              Payee disputed
            </div>
            {detail.receiverAttestation ? (
              <div className="text-slate-700">
                {detail.receiverAttestation.submittedAt
                  ? new Date(detail.receiverAttestation.submittedAt).toLocaleString()
                  : '—'}
                <div className="mt-1 italic">
                  &ldquo;{detail.receiverAttestation.reason ?? '(no reason)'}&rdquo;
                </div>
              </div>
            ) : (
              <div className="text-slate-500">No attestation on file</div>
            )}
          </div>
        </div>
      </div>

      {isOpen ? (
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h2 className="text-base font-semibold text-slate-900 mb-4">Resolve</h2>

          <div className="space-y-2 mb-4">
            <RadioOption
              value="verify"
              current={action}
              setCurrent={setAction}
              label="Verify the payment"
              hint="UPI / bank evidence shows the money moved. Intent → verified, loan flow resumes."
            />
            <RadioOption
              value="mark_failed"
              current={action}
              setCurrent={setAction}
              label="Mark as failed"
              hint="The payment didn't happen. Intent → failed, payer can retry."
            />
            <RadioOption
              value="default_loan"
              current={action}
              setCurrent={setAction}
              label="Default the loan"
              hint="One party is at fault and the loan can't continue. -100 TrustScore + appears on defaulter's public profile."
            />
          </div>

          {action === 'default_loan' ? (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
              <div className="text-xs uppercase tracking-wide text-red-700 font-medium mb-2">
                Defaulter
              </div>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="defaultBy"
                    value="borrower"
                    checked={defaultBy === 'borrower'}
                    onChange={() => setDefaultBy('borrower')}
                  />
                  Borrower ({detail.loan.status === 'awaiting_disbursal'
                    ? detail.payee.name
                    : detail.payer.name})
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="defaultBy"
                    value="lender"
                    checked={defaultBy === 'lender'}
                    onChange={() => setDefaultBy('lender')}
                  />
                  Lender
                </label>
              </div>
            </div>
          ) : null}

          <label className="block text-xs uppercase tracking-wide text-slate-500 font-medium mb-1">
            Reason (recorded in audit log and shared with both parties)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 1000))}
            rows={4}
            placeholder="What you found and why this resolution is correct (≥ 10 characters)"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
          />

          <button
            onClick={onResolve}
            disabled={!action || submitting || reason.trim().length < 10}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              action === 'default_loan'
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            } disabled:bg-slate-300 disabled:cursor-not-allowed`}
          >
            {submitting ? 'Applying…' : 'Apply resolution'}
          </button>
        </div>
      ) : (
        <div className="bg-slate-100 rounded-lg p-4 text-sm text-slate-600">
          This dispute is already <strong>{detail.status}</strong>.
        </div>
      )}

      <div className="mt-8">
        <Link href="/disputes" className="text-sm text-blue-600 hover:text-blue-800">
          ← Back to queue
        </Link>
      </div>
    </div>
  );
}

function PartyCard({
  role,
  data,
  vpa,
}: {
  role: string;
  data: { id: string; name: string; trustScore: number; trustBand: string };
  vpa: string;
}) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6">
      <div className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-2">
        {role}
      </div>
      <div className="text-lg font-semibold text-slate-900">{data.name}</div>
      <div className="text-sm text-slate-600 mt-1">
        TrustScore {data.trustScore} ({data.trustBand.replace('_', ' ')})
      </div>
      <div className="mt-3 font-mono text-xs text-slate-700 break-all">{vpa}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500 font-medium">{label}</dt>
      <dd className="text-sm text-slate-900 mt-1">{value}</dd>
    </div>
  );
}

function RadioOption({
  value,
  current,
  setCurrent,
  label,
  hint,
}: {
  value: Action;
  current: Action | '';
  setCurrent: (v: Action) => void;
  label: string;
  hint: string;
}) {
  const selected = current === value;
  return (
    <button
      type="button"
      onClick={() => setCurrent(value)}
      className={`w-full text-left p-3 rounded-lg border transition ${
        selected
          ? value === 'default_loan'
            ? 'border-red-400 bg-red-50'
            : 'border-blue-400 bg-blue-50'
          : 'border-slate-200 hover:border-slate-300 bg-white'
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span
          className={`w-4 h-4 rounded-full border-2 ${
            selected
              ? value === 'default_loan'
                ? 'border-red-600 bg-red-600'
                : 'border-blue-600 bg-blue-600'
              : 'border-slate-300'
          }`}
        />
        <span className="font-medium text-slate-900">{label}</span>
      </div>
      <div className="text-xs text-slate-600 ml-6">{hint}</div>
    </button>
  );
}
