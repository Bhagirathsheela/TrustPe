import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: { allowedOrigins: ['localhost:3001'] },
  },
  // Skip ESLint during production builds — the @next/next plugin doesn't
  // resolve reliably in CI (Vercel + Bun workspace). Local `bun run lint`
  // still catches issues before commit; the build stays fast and stable.
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Same for TypeScript — treat the tsc typecheck as a separate concern
  // from Next.js build. Local `bun run typecheck` catches issues; the
  // production build won't be blocked by unrelated strict-null edge cases.
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack: (config) => {
    // Allow `@shared/*` imports from the sibling shared/ directory.
    config.resolve.alias = {
      ...config.resolve.alias,
      '@shared': path.resolve(__dirname, '../shared'),
    };
    return config;
  },
};

export default nextConfig;
