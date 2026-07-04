'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError, useAdminAuth } from '../../lib/auth-context';

const RESEND_COOLDOWN_SEC = 30;

export default function LoginPage() {
  const { login, verifyOtp } = useAdminAuth();
  const router = useRouter();

  const [stage, setStage] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cooldown countdown — runs when cooldown > 0.
  useEffect(() => {
    if (cooldown <= 0) return;
    tickRef.current = setInterval(() => {
      setCooldown((s) => {
        if (s <= 1) {
          if (tickRef.current) clearInterval(tickRef.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [cooldown > 0]);

  const sendCode = async () => {
    setError(null);
    setInfo(null);
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Enter a valid email');
      return;
    }
    setSubmitting(true);
    try {
      await login(email.trim().toLowerCase());
      setInfo(`Code sent to ${email}.`);
      setStage('otp');
      setCooldown(RESEND_COOLDOWN_SEC);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to send code');
    } finally {
      setSubmitting(false);
    }
  };

  const verify = async () => {
    setError(null);
    if (!/^\d{6}$/.test(otp)) {
      setError('Enter the 6-digit code');
      return;
    }
    setSubmitting(true);
    try {
      await verifyOtp({ email: email.trim().toLowerCase(), otp });
      router.replace('/kyc');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Verification failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <div className="w-full max-w-md">
        {/* Brand mark */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center shadow-lg shadow-blue-500/20 mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-8 h-8"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">TrustPe Admin</h1>
          <p className="text-sm text-slate-500 mt-2">
            {stage === 'email' ? 'Sign in with your admin email' : 'Enter the code we just sent'}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200 p-8">
          {stage === 'email' ? (
            <div className="space-y-5">
              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-500 font-semibold mb-2">
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendCode()}
                  placeholder="you@trustpe.in"
                  autoFocus
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition placeholder:text-slate-400"
                />
              </div>
              {error && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}
              <button
                onClick={sendCode}
                disabled={submitting}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-lg font-semibold transition shadow-sm shadow-blue-500/20"
              >
                {submitting ? 'Sending…' : 'Send sign-in code'}
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-500 font-semibold mb-2">
                  6-digit code
                </label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  onKeyDown={(e) => e.key === 'Enter' && verify()}
                  inputMode="numeric"
                  autoFocus
                  className="w-full px-4 py-4 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-center text-3xl tracking-[0.5em] font-mono"
                />
              </div>
              {info && (
                <div className="text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                  {info}
                </div>
              )}
              {error && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}
              <button
                onClick={verify}
                disabled={submitting || otp.length !== 6}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-lg font-semibold transition shadow-sm shadow-blue-500/20"
              >
                {submitting ? 'Verifying…' : 'Verify and sign in'}
              </button>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <button
                  onClick={() => {
                    setStage('email');
                    setOtp('');
                    setError(null);
                    setInfo(null);
                  }}
                  className="text-sm text-slate-500 hover:text-slate-800 transition"
                >
                  ← Different email
                </button>

                {cooldown > 0 ? (
                  <span className="text-xs text-slate-400">Resend in {cooldown}s</span>
                ) : (
                  <button
                    onClick={() => {
                      void sendCode();
                    }}
                    disabled={submitting}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium transition disabled:opacity-50"
                  >
                    Resend code
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <p className="text-xs text-center text-slate-400 mt-6">
          Phase 1 closed pilot. Only allow-listed admin accounts can sign in.
        </p>
      </div>
    </main>
  );
}
