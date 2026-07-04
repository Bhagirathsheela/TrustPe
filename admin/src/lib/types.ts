/**
 * Admin-side response types that mirror `backend/src/services/admin-kyc.service.ts`.
 *
 * Lives in admin/ (not shared/) because the shapes are admin-Next.js-specific
 * views over the backend; keeping them here avoids polluting the shared
 * package with admin-only DTOs.
 */
export type AdminKycListItem = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  pan: string;
  status: 'submitted' | 'approved' | 'rejected' | 'needs_clarification';
  submittedAt: string;
  reviewedAt?: string;
};

export type AdminKycDetail = AdminKycListItem & {
  aadhaarFrontCloudinaryId: string;
  aadhaarBackCloudinaryId: string;
  panFrontCloudinaryId: string;
  selfieVideoCloudinaryId: string;
  vpa: string;
  vpaVerificationMethod: string;
  reviewerNotes?: string;
  reviewedBy?: string;
  user: {
    id: string;
    name: string;
    email: string;
    phone: string;
    status: string;
    kycStatus: string;
    trustScore: number;
    trustBand: string;
    createdAt?: string;
  };
};

export type AdminKycQueueResponse = {
  items: AdminKycListItem[];
  nextCursor: string | null;
};

// -----------------------------------------------------------------------------
// Dispute resolution types
// -----------------------------------------------------------------------------

export type AdminDisputeListItem = {
  id: string;
  loanId: string;
  kind: 'disbursal' | 'emi' | 'preclose';
  emiNumber?: number;
  payerName: string;
  payeeName: string;
  amountPaise: number;
  status: string;
  payerEvidence?: { utr?: string; submittedAt?: string };
  receiverAttestation?: { reason?: string; submittedAt?: string };
  createdAt: string;
};

export type AdminDisputeDetail = AdminDisputeListItem & {
  payerVpa: string;
  payeeVpa: string;
  referenceId: string;
  payer: { id: string; name: string; trustScore: number; trustBand: string };
  payee: { id: string; name: string; trustScore: number; trustBand: string };
  loan: {
    id: string;
    status: string;
    amountPaise: number;
    tenureMonths: number;
    roiPercent: number;
    agreedAt: string;
    disbursedAt?: string;
  };
};

export type AdminDisputeQueueResponse = {
  items: AdminDisputeListItem[];
  nextCursor: string | null;
};

// -----------------------------------------------------------------------------
// Admin user directory + audit log types
// -----------------------------------------------------------------------------

export type AdminUserListItem = {
  id: string;
  name: string;
  email: string;
  phone: string;
  handle?: string;
  status: string;
  kycStatus: string;
  trustScore: number;
  trustBand: string;
  roles: string[];
  createdAt: string;
};

export type AdminUserListResponse = {
  items: AdminUserListItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type AdminUserLoanRow = {
  id: string;
  status: string;
  amountPaise: number;
  roiPercent: number;
  tenureMonths: number;
  counterpartyName: string;
  createdAt: string;
};

export type AdminAuditLogRow = {
  id: string;
  at: string;
  actorType: string;
  actorId?: string;
  action: string;
  entityType: string;
  entityId: string;
  ip?: string;
  userAgent?: string;
};

export type AdminUserDetail = AdminUserListItem & {
  suspendedAt?: string;
  suspendedReason?: string;
  profile?: {
    city?: string;
    occupationCategory?: string;
    occupationDetail?: string;
    declaredMonthlyIncome?: string;
    photoCloudinaryId?: string;
    bio?: string;
  };
  kyc?: {
    id: string;
    status: string;
    pan: string;
    vpa: string;
    submittedAt: string;
    reviewedAt?: string;
    reviewerNotes?: string;
  };
  loans: {
    asBorrower: AdminUserLoanRow[];
    asLender: AdminUserLoanRow[];
  };
  reviewsReceived: {
    rating: number;
    comment?: string;
    tags: string[];
    reviewerName: string;
    role: string;
    createdAt: string;
  }[];
  auditLog: AdminAuditLogRow[];
};

export type AdminAuditLogResponse = {
  items: AdminAuditLogRow[];
  total: number;
  page: number;
  pageSize: number;
};

export const CLOUDINARY_CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? '';

export function cloudinaryImageUrl(publicId: string): string {
  if (!CLOUDINARY_CLOUD_NAME) return '';
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/${publicId}`;
}

export function cloudinaryVideoUrl(publicId: string): string {
  if (!CLOUDINARY_CLOUD_NAME) return '';
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/video/upload/${publicId}`;
}
