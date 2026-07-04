import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';

/**
 * Health-endpoint integration test.
 *
 * Smoke test for the test infrastructure: real Express app booted in-process,
 * supertest fires HTTP requests against it, assertions on the JSON response.
 * Real DB-backed integration tests start in Sprint 1.
 */
describe('GET /health', () => {
  let app: Express;

  beforeAll(async () => {
    // Set required env so the env validator doesn't fail before app boots.
    process.env.MONGO_URI = process.env.MONGO_URI ?? 'mongodb://localhost:27017/trustpe-test';
    process.env.JWT_ACCESS_SECRET =
      process.env.JWT_ACCESS_SECRET ?? 'test-access-secret-must-be-at-least-32-chars-long';
    process.env.JWT_REFRESH_SECRET =
      process.env.JWT_REFRESH_SECRET ?? 'test-refresh-secret-must-be-at-least-32-chars-long';

    const { createApp } = await import('../../src/app.js');
    app = createApp();
  });

  it('returns 200 with service metadata', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.service).toBe('trustpe-backend');
  });

  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.ok).toBe(false);
    expect(res.body.error.code).toBe('route_not_found');
  });
});
