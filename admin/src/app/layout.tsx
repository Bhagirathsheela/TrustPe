import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AdminAuthProvider } from '../lib/auth-context';
import './globals.css';

export const metadata: Metadata = {
  title: 'TrustPe Admin',
  description: 'Internal administration console for TrustPe',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AdminAuthProvider>{children}</AdminAuthProvider>
      </body>
    </html>
  );
}
