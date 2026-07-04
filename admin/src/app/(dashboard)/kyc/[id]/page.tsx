'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { apiRequest, ApiError } from '../../../../lib/api';
import type { AdminKycDetail } from '../../../../lib/types';

// Tesseract.js is loaded lazily from CDN (~3MB) only when admin clicks
// "Extract Aadhaar number". Avoids bundling it for every page load.
declare global {
  interface Window {
    Tesseract?: {
      recognize: (
        image: string,
        lang: string,
        options?: { logger?: (m: { status: string; progress: number }) => void },
      ) => Promise<{ data: { text: string } }>;
    };
  }
}

const STATUS_BADGE: Record<string, string> = {
  submitted: 'bg-amber-100 text-amber-800',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800',
  needs_clarification: 'bg-blue-100 text-blue-800',
};

export default function KycDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [detail, setDetail] = useState<AdminKycDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [deciding, setDeciding] = useState<null | 'approve' | 'reject' | 'request_clarification'>(
    null,
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<AdminKycDetail>({ path: `/admin/kyc/${id}` });
      setDetail(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load record');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (decision: 'approve' | 'reject' | 'request_clarification') => {
    if (decision !== 'approve' && !reason.trim()) {
      alert('A reason is required for reject and request_clarification.');
      return;
    }
    if (
      !confirm(
        decision === 'approve'
          ? 'Approve this KYC submission? The user will become active.'
          : decision === 'reject'
            ? 'Reject this KYC? The user will be suspended.'
            : 'Send this back for clarification? The user can re-submit.',
      )
    ) {
      return;
    }

    setDeciding(decision);
    try {
      const updated = await apiRequest<AdminKycDetail>({
        path: `/admin/kyc/${id}/decision`,
        method: 'POST',
        body: { decision, reason: reason.trim() || undefined },
      });
      setDetail(updated);
      setReason('');
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Decision failed');
    } finally {
      setDeciding(null);
    }
  };

  if (loading) {
    return <div className="text-slate-500 py-12 text-center">Loading…</div>;
  }
  if (error || !detail) {
    return <div className="text-red-600 py-12 text-center">{error ?? 'Not found'}</div>;
  }

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? '';
  const imgUrl = (publicId: string) =>
    cloudName ? `https://res.cloudinary.com/${cloudName}/image/upload/${publicId}` : '';
  const videoUrl = (publicId: string) =>
    cloudName ? `https://res.cloudinary.com/${cloudName}/video/upload/${publicId}` : '';

  const canDecide = detail.status === 'submitted';

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
          <h1 className="text-2xl font-semibold text-slate-900">{detail.userName}</h1>
          <span
            className={`px-2 py-1 rounded text-xs font-medium ${
              STATUS_BADGE[detail.status] ?? 'bg-slate-100 text-slate-700'
            }`}
          >
            {detail.status.replace('_', ' ')}
          </span>
        </div>
        <div className="text-sm text-slate-500 mt-1">
          {detail.userEmail} · {detail.userPhone} · TrustScore {detail.user.trustScore} (
          {detail.user.trustBand})
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-8">
        <DocumentCard label="Aadhaar — front">
          <ImagePreview src={imgUrl(detail.aadhaarFrontCloudinaryId)} />
        </DocumentCard>
        <DocumentCard label="Aadhaar — back">
          <ImagePreview src={imgUrl(detail.aadhaarBackCloudinaryId)} />
        </DocumentCard>
        <DocumentCard label="PAN — front">
          <ImagePreview src={imgUrl(detail.panFrontCloudinaryId)} />
        </DocumentCard>
        <DocumentCard label="Selfie video">
          <video
            src={videoUrl(detail.selfieVideoCloudinaryId)}
            controls
            className="w-full rounded-lg bg-slate-900"
          />
        </DocumentCard>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
        <h2 className="text-base font-semibold text-slate-900 mb-4">Submitted details</h2>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <Field label="PAN number" value={detail.pan} />
          <Field label="UPI ID" value={detail.vpa} mono />
          <Field label="Submitted" value={new Date(detail.submittedAt).toLocaleString()} />
          {detail.reviewedAt && (
            <Field label="Reviewed" value={new Date(detail.reviewedAt).toLocaleString()} />
          )}
        </dl>
        {detail.reviewerNotes && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-1">
              Reviewer notes
            </div>
            <div className="text-sm text-slate-700">{detail.reviewerNotes}</div>
          </div>
        )}
      </div>

      <VpaVerifyCard vpa={detail.vpa} userName={detail.userName} />

      <UidaiVerifyCard
        aadhaarFrontImageUrl={imgUrl(detail.aadhaarFrontCloudinaryId)}
      />

      {canDecide ? (
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h2 className="text-base font-semibold text-slate-900 mb-4">Decision</h2>
          <label className="block text-xs uppercase tracking-wide text-slate-500 font-medium mb-1">
            Reason (required for reject / clarification)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 500))}
            rows={3}
            placeholder="e.g. Aadhaar image is blurred; please re-capture."
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
          />
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() => decide('approve')}
              disabled={deciding !== null}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-lg text-sm font-medium"
            >
              {deciding === 'approve' ? 'Approving…' : 'Approve'}
            </button>
            <button
              onClick={() => decide('request_clarification')}
              disabled={deciding !== null}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-lg text-sm font-medium"
            >
              {deciding === 'request_clarification' ? 'Sending…' : 'Request clarification'}
            </button>
            <button
              onClick={() => decide('reject')}
              disabled={deciding !== null}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white rounded-lg text-sm font-medium"
            >
              {deciding === 'reject' ? 'Rejecting…' : 'Reject'}
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-slate-100 rounded-lg p-4 text-sm text-slate-600">
          This submission is already <strong>{detail.status.replace('_', ' ')}</strong>. A new
          submission from the user is required for a fresh decision.
        </div>
      )}

      <div className="mt-8">
        <Link href="/kyc" className="text-sm text-blue-600 hover:text-blue-800">
          ← Back to queue
        </Link>
      </div>
    </div>
  );
}

function DocumentCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wide text-slate-600 font-medium">
        {label}
      </div>
      <div className="p-3 flex items-center justify-center">{children}</div>
    </div>
  );
}

function ImagePreview({ src }: { src: string }) {
  if (!src) {
    return <div className="text-slate-400 text-sm py-12">No image (Cloudinary not configured)</div>;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="KYC document" className="max-h-80 w-auto rounded" />;
}

function Field({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500 font-medium">{label}</dt>
      <dd className={`text-sm text-slate-900 mt-1 ${mono ? 'font-mono' : ''}`}>{value}</dd>
    </div>
  );
}

/**
 * VPA verification panel.
 *
 * Phase 1 verification path — zero cost, no third-party API:
 *
 *   1. Open your own UPI app (GPay / PhonePe / Paytm / BHIM).
 *   2. Tap "New Payment" or "Send to UPI ID" — or, on mobile, hit the
 *      "Open in UPI app" button below which fires a `upi://pay` Intent and
 *      jumps straight to the app picker with the VPA pre-filled.
 *   3. Paste the user's VPA (or skip — Intent does it for you).
 *   4. The UPI app calls NPCI for a name lookup and displays the registered
 *      holder name (no money moves yet).
 *   5. Compare that name with the user's KYC name shown above.
 *   6. Cancel the transfer — nothing has been sent.
 *
 * Phase 2 swap: replace steps 1-6 with a Cashfree penny-drop API call wired
 * behind the existing IPaymentVerificationProvider adapter. ~₹2/user one-time,
 * single-file change. See ARCHITECTURE.md §6.3.2.
 */
function VpaVerifyCard({ vpa, userName }: { vpa: string; userName: string }) {
  const [copied, setCopied] = useState(false);
  const upiIntentUrl = `upi://pay?pa=${encodeURIComponent(vpa)}&pn=${encodeURIComponent(
    userName,
  )}&am=1&cu=INR&tn=${encodeURIComponent('TrustPe VPA check (cancel before paying)')}`;

  const onCopy = () => {
    void navigator.clipboard.writeText(vpa);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 mb-6">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center shrink-0">
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
            <path d="m9 12 2 2 4-4" />
            <circle cx="12" cy="12" r="10" />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-emerald-900">
            Verify UPI ID via free NPCI name-lookup
          </h3>
          <p className="text-xs text-emerald-800 leading-relaxed mt-1">
            Open your UPI app → paste this VPA → NPCI returns the registered holder name → compare
            with <strong>{userName}</strong> → <em>cancel</em> the transfer (no money moves).
          </p>
        </div>
      </div>

      <div className="bg-white border border-emerald-300 rounded-lg p-3 flex items-center justify-between mb-3">
        <code className="font-mono text-sm text-slate-900 break-all">{vpa}</code>
        <button
          onClick={onCopy}
          className={`ml-3 shrink-0 px-3 py-1.5 rounded-md text-xs font-medium transition ${
            copied
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
          }`}
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <a
          href={upiIntentUrl}
          className="flex-1 text-center px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition shadow-sm shadow-emerald-500/20 flex items-center justify-center gap-2"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-4 h-4"
          >
            <rect width="14" height="20" x="5" y="2" rx="2" />
            <path d="M12 18h.01" />
          </svg>
          Open in UPI app
        </a>
        <p className="flex-1 text-xs text-emerald-700/80 sm:text-right sm:self-center px-2">
          Tip: open this page on your phone — the button fires a UPI Intent and shows the GPay /
          PhonePe / Paytm / BHIM picker.
        </p>
      </div>
    </div>
  );
}

/**
 * UIDAI verification panel.
 *
 * Phase 1 verification path:
 *  - (optional) Click "Extract from image" — Tesseract.js OCR pulls the
 *    12-digit Aadhaar number out of the uploaded Aadhaar front image.
 *    Falls back to manual entry if OCR confidence is low.
 *  - Click "Open UIDAI portal" — opens UIDAI's public verification page.
 *  - Type the Aadhaar number, complete UIDAI's OTP step.
 *  - UIDAI returns: valid + last-4 of mobile + age band + state + gender.
 *  - Cross-check those against the user's profile.
 *
 * Aadhaar Act §29 compliance: the number we extract here is held in component
 * state only, never persisted to our DB. Browser memory is cleared on
 * navigation. Phase 2 swaps to DigiLocker which returns a signed XML.
 */
function UidaiVerifyCard({ aadhaarFrontImageUrl }: { aadhaarFrontImageUrl: string }) {
  const [ocrStatus, setOcrStatus] = useState<'idle' | 'loading' | 'running' | 'done' | 'error'>(
    'idle',
  );
  const [progress, setProgress] = useState(0);
  const [extracted, setExtracted] = useState<string>('');
  const [manual, setManual] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const aadhaarNumber = (extracted || manual).replace(/\D/g, '');
  const isValidLength = aadhaarNumber.length === 12;

  const ensureTesseractLoaded = (): Promise<void> => {
    if (typeof window !== 'undefined' && window.Tesseract) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(
        'script[data-tesseract]',
      ) as HTMLScriptElement | null;
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () =>
          reject(new Error('Failed to load Tesseract.js from CDN')),
        );
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/tesseract.js@5.1.0/dist/tesseract.min.js';
      script.async = true;
      script.dataset.tesseract = 'true';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Tesseract.js from CDN'));
      document.head.appendChild(script);
    });
  };

  const extractFromImage = async () => {
    if (!aadhaarFrontImageUrl) {
      setErrorMsg('No Aadhaar image is available to OCR.');
      setOcrStatus('error');
      return;
    }
    setOcrStatus('loading');
    setErrorMsg(null);
    setProgress(0);
    try {
      await ensureTesseractLoaded();
      const T = window.Tesseract!;
      setOcrStatus('running');
      const result = await T.recognize(aadhaarFrontImageUrl, 'eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') setProgress(Math.round(m.progress * 100));
        },
      });
      const text = result.data.text ?? '';
      // Aadhaar numbers print as "1234 5678 9012" — collapse whitespace and
      // pull the first 12-digit run.
      const cleaned = text.replace(/[^0-9\s]/g, ' ');
      const match = cleaned.match(/\b(\d{4})\s*(\d{4})\s*(\d{4})\b/);
      if (match) {
        const num = `${match[1]}${match[2]}${match[3]}`;
        setExtracted(num);
        setOcrStatus('done');
      } else {
        setErrorMsg(
          "Couldn't find a 12-digit Aadhaar pattern in the image. Try entering it manually below.",
        );
        setOcrStatus('error');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'OCR failed');
      setOcrStatus('error');
    }
  };

  const onCopy = () => {
    if (!aadhaarNumber) return;
    void navigator.clipboard.writeText(aadhaarNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const display = (() => {
    const n = aadhaarNumber;
    if (n.length !== 12) return n;
    return `${n.slice(0, 4)} ${n.slice(4, 8)} ${n.slice(8, 12)}`;
  })();

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
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
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-blue-900">
            Verify Aadhaar on UIDAI portal
          </h3>
          <p className="text-xs text-blue-800 leading-relaxed mt-1">
            Extract the 12-digit number from the uploaded Aadhaar image, then verify on UIDAI&apos;s
            portal. We never store the number — Aadhaar Act §29.
          </p>
        </div>
      </div>

      {/* Number display + copy */}
      <div className="bg-white border border-blue-300 rounded-lg p-3 mb-3">
        <div className="flex items-center justify-between gap-3">
          <code className="font-mono text-base text-slate-900 break-all">
            {display || <span className="text-slate-400">— not extracted yet —</span>}
          </code>
          {isValidLength ? (
            <button
              onClick={onCopy}
              className={`shrink-0 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                copied ? 'bg-blue-100 text-blue-700' : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          ) : null}
        </div>
      </div>

      {/* OCR + manual entry */}
      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <button
          onClick={extractFromImage}
          disabled={ocrStatus === 'loading' || ocrStatus === 'running'}
          className="flex-1 px-4 py-2.5 bg-white border border-blue-300 hover:bg-blue-50 disabled:bg-slate-100 disabled:text-slate-400 text-blue-700 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-4 h-4"
          >
            <path d="M9 20H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5" />
            <path d="M15 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5" />
            <path d="M12 4v16" />
            <circle cx="7" cy="9" r="1" />
            <path d="m6 13 1.5-1.5L10 14" />
          </svg>
          {ocrStatus === 'loading' && 'Loading OCR…'}
          {ocrStatus === 'running' && `Reading image… ${progress}%`}
          {ocrStatus === 'done' && '✓ Extracted — re-run'}
          {(ocrStatus === 'idle' || ocrStatus === 'error') && 'Extract from image'}
        </button>
        <a
          href="https://myaadhaar.uidai.gov.in/verify-aadhaar"
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 text-center px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition shadow-sm shadow-blue-500/20 flex items-center justify-center gap-2"
        >
          Open UIDAI portal
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-4 h-4"
          >
            <path d="M7 7h10v10" />
            <path d="M7 17 17 7" />
          </svg>
        </a>
      </div>

      {errorMsg ? (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-3">
          {errorMsg}
        </div>
      ) : null}

      <details className="text-xs text-blue-900">
        <summary className="cursor-pointer hover:text-blue-700 select-none">
          OCR failed or unclear? Enter manually
        </summary>
        <input
          type="text"
          value={manual}
          onChange={(e) => {
            setManual(e.target.value.replace(/\D/g, '').slice(0, 12));
            setExtracted('');
            setErrorMsg(null);
          }}
          placeholder="12-digit Aadhaar number"
          inputMode="numeric"
          className="mt-2 w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
        />
      </details>
    </div>
  );
}

