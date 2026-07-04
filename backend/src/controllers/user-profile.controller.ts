/**
 * Public user profile controller.
 *
 * Visible to any authenticated user (closed pilot = no anonymous browsing).
 * Returns enough for a profile screen — identity, TrustScore, member-since,
 * counts of completed loans on each side, and aggregate review stats.
 */
import type { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { User } from '../models/User.js';
import { Profile } from '../models/Profile.js';
import { Loan } from '../models/Loan.js';
import { reviewService } from '../services/review.service.js';
import { AppError } from '../middleware/error-handler.js';

export const userProfileController = {
  async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('unauthorized', 'Not authenticated', 401);
      const { userId } = req.params;
      if (!userId || !Types.ObjectId.isValid(userId)) {
        throw new AppError('invalid_id', 'User id is required', 400);
      }
      const user = await User.findById(userId);
      if (!user) throw new AppError('user_not_found', 'No user with that id', 404);

      const [
        profile,
        stats,
        borrowerCount,
        lenderCount,
        defaultedAsBorrower,
        defaultedAsLender,
        recentDefaults,
      ] = await Promise.all([
        Profile.findOne({ userId }),
        reviewService.getStats(userId),
        Loan.countDocuments({ borrowerId: userId, status: { $in: ['closed', 'active'] } }),
        Loan.countDocuments({ lenderId: userId, status: { $in: ['closed', 'active'] } }),
        Loan.countDocuments({
          borrowerId: userId,
          status: 'defaulted',
          defaultedBy: 'borrower',
        }),
        Loan.countDocuments({
          lenderId: userId,
          status: 'defaulted',
          defaultedBy: 'lender',
        }),
        Loan.find({
          $or: [
            { borrowerId: userId, status: 'defaulted', defaultedBy: 'borrower' },
            { lenderId: userId, status: 'defaulted', defaultedBy: 'lender' },
          ],
        })
          .sort({ defaultedAt: -1 })
          .limit(5),
      ]);

      const userWithTs = user as typeof user & { createdAt?: Date };

      res.json({
        ok: true,
        data: {
          id: String(user._id),
          name: user.name,
          handle: user.handle ?? undefined,
          city: profile?.city ?? undefined,
          trustScore: user.trustScore ?? 300,
          trustBand: user.trustBand ?? 'building',
          memberSince: userWithTs.createdAt?.toISOString(),
          stats: {
            averageRating: stats.averageRating,
            totalReviews: stats.totalReviews,
            distribution: stats.distribution,
            loansAsBorrower: borrowerCount,
            loansAsLender: lenderCount,
            defaultedAsBorrower,
            defaultedAsLender,
          },
          recentDefaults: recentDefaults.map((l) => ({
            id: String(l._id),
            amountPaise: l.amountPaise,
            tenureMonths: l.tenureMonths,
            roiPercent: l.roiPercent,
            defaultedBy: l.defaultedBy,
            defaultedAt: l.defaultedAt?.toISOString(),
            defaultReason: l.defaultReason ?? undefined,
            counterpartyName:
              l.defaultedBy === 'borrower'
                ? l.lenderSnapshot.name
                : l.borrowerSnapshot.name,
          })),
        },
      });
    } catch (err) {
      next(err);
    }
  },
};
