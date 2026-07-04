import { describe, it, expect } from 'vitest';
import type { Paise } from './index';

/**
 * Smoke test for the test infrastructure itself.
 * Real domain tests start in Sprint 1.
 */
describe('money types — smoke test', () => {
  it('paise values are integers', () => {
    const amount: Paise = 1500000; // ₹15,000 in paise
    expect(Number.isInteger(amount)).toBe(true);
  });

  it('rejects float money in a runtime check', () => {
    const isInteger = (n: number): boolean => Number.isInteger(n);
    expect(isInteger(15000.5)).toBe(false);
    expect(isInteger(15000)).toBe(true);
  });
});
