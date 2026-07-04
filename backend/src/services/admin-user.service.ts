/**
 * Admin user service — pilot operator dashboard.
 *
 * Read-only views into a user's identity, KYC, profile, loans, reviews, and
 * audit-log slice. Write operations (KYC approve, dispute resolve) go through
 * their own dedicated services so the audit trail stays clean.
 *
 * Designed for the friends-and-family pilot: tiny list of users, simple
 * pagination, full-text-ish search via case-insensitive prefix matching on
 * name/email/phone/handle.
 *
 * See ARCHITECTURE.md §21 (audit) and CLAUDE.md "Audit logging — never
 * bypass" for why we expose audit trails directly.
 */
import { Types } from 'mongoose';
import { User } from '../models/User.js';
import { Profile } from '../models/Profile.js';
import { KycRecord } from '../models/KycRecord.js';
import { Loan } from '../models/Loan.js';
import { LoanRequest } from '../models/LoanRequest.js';
import { Review } from '../models/Review.js';
import { AuditLog } from '../models/AuditLog.js';
import { AppError } from '../middleware/error-handler.js';

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

export type AdminUserListQuery = {
  q?: string;
  status?: string;
  kycStatus?: string;
  limit?: number;
  page?: number;
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

export type AdminAuditQuery = {
  actorId?: string;
  entityType?: string;
  entityId?: string;
  action?: string;
  from?: string;
  to?: string;
  limit?: number;
  page?: number;
};

function toListItem(u: Record<string, unknown>): AdminUserListItem {
  return {
    id: String(u._id),
    name: u.name as string,
    email: u.email as string,
    phone: u.phone as string,
    handle: u.handle as string | undefined,
    status: u.status as string,
    kycStatus: u.kycStatus as string,
    trustScore: (u.trustScore as number) ?? 300,
    trustBand: (u.trustBand as string) ?? 'building',
    roles: (u.roles as string[]) ?? ['user'],
    createdAt: new Date(u.createdAt as Date).toISOString(),
  };
}

function loanToRow(loan: Record<string, unknown>, viewerId: string): AdminUserLoanRow {
  const isBorrower = String(loan.borrowerId) === viewerId;
  const counterparty = isBorrower
    ? ((loan.lenderSnapshot as { name?: string })?.name ?? '—')
    : ((loan.borrowerSnapshot as { name?: string })?.name ?? '—');
  return {
    id: String(loan._id),
    status: loan.status as string,
    amountPaise: loan.amountPaise as number,
    roiPercent: loan.roiPercent as number,
    tenureMonths: loan.tenureMonths as number,
    counterpartyName: counterparty,
    createdAt: new Date(loan.createdAt as Date).toISOString(),
  };
}

export const adminUserService = {
  async list(query: AdminUserListQuery): Promise<{
    items: AdminUserListItem[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const pageSize = Math.min(query.limit ?? 25, 100);
    const page = Math.max(query.page ?? 1, 1);
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = {};
    if (query.status) where.status = query.status;
    if (query.kycStatus) where.kycStatus = query.kycStatus;
    if (query.q && query.q.trim().length > 0) {
      // Case-insensitive prefix-ish match across the obvious lookup fields.
      const rx = new RegExp(query.q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      where.$or = [{ name: rx }, { email: rx }, { phone: rx }, { handle: rx }];
    }

    const [users, total] = await Promise.all([
      User.find(where).sort({ createdAt: -1 }).skip(skip).limit(pageSize).lean(),
      User.countDocuments(where),
    ]);

    return {
      items: users.map((u) => toListItem(u as unknown as Record<string, unknown>)),
      total,
      page,
      pageSize,
    };
  },

  async detail(userId: string): Promise<AdminUserDetail> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new AppError('invalid_id', 'User id is required', 400);
    }
    const user = await User.findById(userId).lean();
    if (!user) throw new AppError('user_not_found', 'No user with that id', 404);

    const [profile, kyc, asBorrower, asLender, reviews, audit] = await Promise.all([
      Profile.findOne({ userId }).lean(),
      KycRecord.findOne({ userId }).sort({ submittedAt: -1 }).lean(),
      Loan.find({ borrowerId: userId }).sort({ createdAt: -1 }).limit(25).lean(),
      Loan.find({ lenderId: userId }).sort({ createdAt: -1 }).limit(25).lean(),
      Review.find({ revieweeId: userId })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate({ path: 'reviewerId', select: 'name' })
        .lean(),
      AuditLog.find({
        $or: [
          { actorId: userId },
          { entityType: 'user', entityId: userId },
          { entityType: 'profile', entityId: userId },
        ],
      })
        .sort({ at: -1 })
        .limit(50)
        .lean(),
    ]);

    const base = toListItem(user as unknown as Record<string, unknown>);
    return {
      ...base,
      suspendedAt: user.suspendedAt ? new Date(user.suspendedAt).toISOString() : undefined,
      suspendedReason: (user.suspendedReason as string | undefined) ?? undefined,
      profile: profile
        ? {
            city: (profile.city as string | undefined) ?? undefined,
            occupationCategory:
              (profile.occupationCategory as string | undefined) ?? undefined,
            occupationDetail:
              (profile.occupationDetail as string | undefined) ?? undefined,
            declaredMonthlyIncome:
              (profile.declaredMonthlyIncome as string | undefined) ?? undefined,
            photoCloudinaryId:
              (profile.photoCloudinaryId as string | undefined) ?? undefined,
            bio: (profile.bio as string | undefined) ?? undefined,
          }
        : undefined,
      kyc: kyc
        ? {
            id: String(kyc._id),
            status: kyc.status as string,
            pan: kyc.pan as string,
            vpa: kyc.vpa as string,
            submittedAt: new Date((kyc.submittedAt as Date) ?? kyc.createdAt).toISOString(),
            reviewedAt: kyc.reviewedAt
              ? new Date(kyc.reviewedAt as Date).toISOString()
              : undefined,
            reviewerNotes: kyc.reviewerNotes as string | undefined,
          }
        : undefined,
      loans: {
        asBorrower: asBorrower.map((l) =>
          loanToRow(l as unknown as Record<string, unknown>, userId),
        ),
        asLender: asLender.map((l) =>
          loanToRow(l as unknown as Record<string, unknown>, userId),
        ),
      },
      reviewsReceived: reviews.map((r) => {
        const reviewer = r.reviewerId as unknown as { name?: string } | undefined;
        return {
          rating: r.rating as number,
          comment: r.comment as string | undefined,
          tags: ((r.tags as string[]) ?? []).slice(),
          reviewerName: reviewer?.name ?? 'Unknown',
          role: r.reviewerRole as string,
          createdAt: new Date(r.createdAt as Date).toISOString(),
        };
      }),
      auditLog: audit.map(
        (a) =>
          ({
            id: String(a._id),
            at: new Date(a.at as Date).toISOString(),
            actorType: a.actorType as string,
            actorId: a.actorId as string | undefined,
            action: a.action as string,
            entityType: a.entityType as string,
            entityId: a.entityId as string,
            ip: a.ip as string | undefined,
            userAgent: a.userAgent as string | undefined,
          }) satisfies AdminAuditLogRow,
      ),
    };
  },

  async auditLog(query: AdminAuditQuery): Promise<{
    items: AdminAuditLogRow[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const pageSize = Math.min(query.limit ?? 50, 200);
    const page = Math.max(query.page ?? 1, 1);
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = {};
    if (query.actorId) where.actorId = query.actorId;
    if (query.entityType) where.entityType = query.entityType;
    if (query.entityId) where.entityId = query.entityId;
    if (query.action) where.action = new RegExp(`^${query.action}`, 'i');
    if (query.from || query.to) {
      const range: Record<string, Date> = {};
      if (query.from) range.$gte = new Date(query.from);
      if (query.to) range.$lte = new Date(query.to);
      where.at = range;
    }

    const [rows, total] = await Promise.all([
      AuditLog.find(where).sort({ at: -1 }).skip(skip).limit(pageSize).lean(),
      AuditLog.countDocuments(where),
    ]);

    return {
      items: rows.map((a) => ({
        id: String(a._id),
        at: new Date(a.at as Date).toISOString(),
        actorType: a.actorType as string,
        actorId: a.actorId as string | undefined,
        action: a.action as string,
        entityType: a.entityType as string,
        entityId: a.entityId as string,
        ip: a.ip as string | undefined,
        userAgent: a.userAgent as string | undefined,
      })),
      total,
      page,
      pageSize,
    };
  },
};
