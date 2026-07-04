/**
 * Aadhaar validation utilities.
 *
 * UIDAI uses the Verhoeff algorithm checksum on Aadhaar numbers. This lets us
 * locally verify that a 12-digit string is mathematically valid as an Aadhaar
 * number (catches typos and made-up numbers). It does NOT prove the number
 * belongs to the person; that requires UIDAI's authentication service which
 * is only available to licensed agencies (KUAs/AUAs).
 *
 * Compliance reminder: we never persist the full Aadhaar number on our
 * servers. The user types the full number for client-side validation; only
 * the last 4 digits cross our API boundary.
 */

// Verhoeff multiplication table (Dihedral group D5)
const D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];

// Verhoeff permutation table
const P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

/**
 * Returns true if `num` is a Verhoeff-valid 12-digit Aadhaar number.
 * Also rejects numbers starting with 0 or 1 (UIDAI doesn't issue those).
 */
export function isValidAadhaar(num: string): boolean {
  if (!/^\d{12}$/.test(num)) return false;
  if (num[0] === '0' || num[0] === '1') return false;
  let c = 0;
  const digits = num.split('').map(Number).reverse();
  for (let i = 0; i < digits.length; i++) {
    const di = digits[i];
    const pRow = P[i % 8];
    if (di === undefined || !pRow) return false;
    const p = pRow[di];
    if (p === undefined) return false;
    const dRow = D[c];
    if (!dRow) return false;
    const next = dRow[p];
    if (next === undefined) return false;
    c = next;
  }
  return c === 0;
}

/** "XXXX-XXXX-9012" — privacy-safe display string. */
export function maskAadhaar(num: string): string {
  const digits = num.replace(/\D/g, '');
  if (digits.length < 4) return digits;
  return `XXXX-XXXX-${digits.slice(-4)}`;
}
