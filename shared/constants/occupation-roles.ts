/**
 * Common role / job-title suggestions for the optional "Role / Company" field
 * on the profile setup screen.
 *
 * Surfaced as autocomplete suggestions, but the field remains free-text — users
 * can ignore the suggestions and type anything (e.g., "Branch Manager at SBI",
 * "Auto driver near Koramangala"). Suggestions cover the broad set of common
 * occupations our friends-and-family pilot is likely to span.
 */

export const COMMON_ROLES: string[] = [
  // Tech
  'Software Engineer',
  'Senior Software Engineer',
  'Tech Lead',
  'Engineering Manager',
  'Product Manager',
  'UI/UX Designer',
  'Data Scientist',
  'Data Analyst',
  'DevOps Engineer',
  'QA Engineer',
  // Business / management
  'Business Analyst',
  'Sales Manager',
  'Marketing Manager',
  'HR Manager',
  'Operations Manager',
  // Finance / accounting
  'Accountant',
  'Chartered Accountant (CA)',
  'Financial Analyst',
  'Bank Manager',
  'Insurance Agent',
  // Medical
  'Doctor',
  'Nurse',
  'Dentist',
  'Physiotherapist',
  'Pharmacist',
  // Education
  'Teacher',
  'Professor',
  'Tutor',
  // Legal / professional
  'Lawyer',
  'Advocate',
  'Architect',
  // Trades & skilled
  'Civil Engineer',
  'Mechanical Engineer',
  'Electrical Engineer',
  'Chef',
  'Mechanic',
  'Plumber',
  'Electrician',
  'Carpenter',
  'Tailor',
  'Beautician',
  'Photographer',
  // Drivers
  'Driver',
  'Auto Driver',
  'Cab Driver',
  'Delivery Partner',
  // Self-employed / shop
  'Shopkeeper',
  'Small Business Owner',
  // Agriculture
  'Farmer',
  'Dairy Farmer',
  // Government / services
  'Government Officer',
  'Police Officer',
  'Defence Personnel',
  'Public Sector Employee',
];

/** Case-insensitive substring search; prefers "starts with" matches. */
export function searchRoles(query: string, limit = 6): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return COMMON_ROLES.slice(0, limit);

  const starts: string[] = [];
  const contains: string[] = [];
  for (const r of COMMON_ROLES) {
    const lc = r.toLowerCase();
    if (lc.startsWith(q)) starts.push(r);
    else if (lc.includes(q)) contains.push(r);
    if (starts.length >= limit) break;
  }
  return [...starts, ...contains].slice(0, limit);
}
