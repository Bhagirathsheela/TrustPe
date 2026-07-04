'use client';

/**
 * Global error boundary for the admin Next.js app.
 *
 * Next.js calls this whenever an error escapes a layout or page. It must
 * include its own <html> and <body> tags. We log to the tracker and show a
 * friendly fallback with a reset button.
 */
import { useEffect } from 'react';
import { tracker } from '../lib/tracker';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    tracker.captureException(error, {
      digest: error.digest,
      source: 'admin-global-error-boundary',
    });
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif' }}>
        <main
          style={{
            minHeight: '100vh',
            background: '#F8FAFC',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '32px',
          }}
        >
          <div
            style={{
              maxWidth: 480,
              background: 'white',
              border: '1px solid #E2E8F0',
              borderRadius: 12,
              padding: 32,
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                background: '#FEF3C7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 28,
                marginBottom: 16,
              }}
            >
              ⚠️
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 600, color: '#0F172A', margin: 0 }}>
              Something went wrong
            </h1>
            <p style={{ color: '#475569', marginTop: 8, lineHeight: 1.5 }}>
              The admin panel hit an unexpected error. Try the action again. If it keeps
              happening, copy the digest below and send it to engineering.
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
              <button
                onClick={() => reset()}
                style={{
                  padding: '8px 16px',
                  background: '#2563EB',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Try again
              </button>
              <button
                onClick={() => window.location.assign('/kyc')}
                style={{
                  padding: '8px 16px',
                  background: '#F1F5F9',
                  color: '#0F172A',
                  border: 'none',
                  borderRadius: 6,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Go to KYC queue
              </button>
            </div>
            <div
              style={{
                marginTop: 24,
                padding: 12,
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: 8,
                fontFamily: 'ui-monospace, monospace',
                fontSize: 12,
                color: '#475569',
                wordBreak: 'break-word',
              }}
            >
              {error.message || 'Unknown error'}
              {error.digest ? (
                <>
                  <br />
                  <span style={{ opacity: 0.6 }}>digest: {error.digest}</span>
                </>
              ) : null}
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
