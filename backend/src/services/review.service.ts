/**
 * Review service — submit a review after loan close + read aggregates.
 *
 * Submission flow:
 *   1. Validate the loan is closed (no reviews on in-flight loans)
 *   2. Validate the reviewer is a party (borrower or lender)
 *   3. Enforce one review per (loan, reviewer) via unique index
 *   4. Compute scoreDelta = (rating - 3) * 10
 *   5. Update the reviewee's TrustScore + recompute trustBand
 *   6. Write the review + audit + post a system message in chat
 *
 * Read surface:
 *   - getStats(userId): average rating, total reviews, rating distribution
 *   - listForReviewee(userId, query): paginated reviews
 *   - getByLoanForReviewer(loanId, reviewerId): if reviewer already
 *     submitted on this loan (so the UI can show "Edit/Already submitted")
 */
import { Types, startSession } from 'mongoose';
import {
  bandFromScore,
  clampTrustScore,
  type SubmitReviewInput,
  type ReviewQuery,
} from 'trustpe-shared';
import { Review, type ReviewDocument } from '../models/Review.js';
import { Loan } from '../models/Loan.js';
import { User } from '../models/User.js';
import { AppError } from '../middleware/error-handler.js';
import { writeAudit, type AuditContext } from '../utils/audit.js';
import { chatService } from './chat.service.js';
import { notificationService } from './notification.service.js';

export type ReviewPayload = {
  id: string;
  loanId: string;
  reviewerId: string;
  revieweeId: string;
  reviewerRole: 'borrower' | 'lender';
  rating: number;
  comment?: string;
  tags: string[];
  reviewerSnapshot: { name: string; trustScore: number; trustBand: string };
  scoreDelta: number;
  createdAt: string;
};

function toPayload(r: ReviewDocument): ReviewPayload {
  return {
    id: String(r._id),
    loanId: String(r.loanId),
    reviewerId: String(r.reviewerId),
    revieweeId: String(r.revieweeId),
    reviewerRole: r.reviewerRole,
    rating: r.rating,
    comment: r.comment ?? undefined,
    tags: r.tags ?? [],
    reviewerSnapshot: {
      name: r.reviewerSnapshot.name,
      trustScore: r.reviewerSnapshot.trustScore,
      trustBand: r.reviewerSnapshot.trustBand,
    },
    scoreDelta: r.scoreDelta,
    createdAt: r.createdAt.toISOString(),
  };
}

export type ReviewStats = {
  averageRating: number | null;
  totalReviews: number;
  distribution: { 1: number; 2: number; 3: number; 4: number; 5: number };
};

export const reviewService = {
  /** Submit a review on a closed loan. */
  async submit(
    loanId: string,
    reviewerId: string,
    input: SubmitReviewInput,
    ctx: AuditContext,
  ): Promise<ReviewPayload> {
    if (!Types.ObjectId.isValid(loanId)) {
      throw new AppError('invalid_id', 'Loan id is not a valid ObjectId', 400);
    }

    const loan = await Loan.findById(loanId);
    if (!loan) throw new AppError('loan_not_found', 'No loan with that id', 404);
    if (loan.status !== 'closed' && loan.status !== 'defaulted') {
      throw new AppError(
        'loan_not_complete',
        'You can only review a loan after it closes or defaults.',
        409,
      );
    }

    let reviewerRole: 'borrower' | 'lender';
    let revieweeId: string;
    if (String(loan.borrowerId) === reviewerId) {
      reviewerRole = 'borrower';
      revieweeId = String(loan.lenderId);
    } else if (String(loan.lenderId) === reviewerId) {
      reviewerRole = 'lender';
      revieweeId = String(loan.borrowerId);
    } else {
      throw new AppError('not_party', 'You are not a party to this loan.', 403);
    }

    // Catch double-submission early so we return a friendly error rather than
    // a unique-index violation.
    const existing = await Review.findOne({ loanId, reviewerId });
    if (existing) {
      throw new AppError(
        'review_already_submitted',
        "You've already left a review on this loan.",
        409,
      );
    }

    const [reviewer, reviewee] = await Promise.all([
      User.findById(reviewerId),
      User.findById(revieweeId),
    ]);
    if (!reviewer) throw new AppError('user_not_found', 'Reviewer not found', 404);
    if (!reviewee) throw new AppError('user_not_found', 'Reviewee not found', 404);

    const scoreDelta = (input.rating - 3) * 10;

    const session = await startSession();
    try {
      let created!: ReviewDocument;
      await session.withTransaction(async () => {
        const [r] = await Review.create(
          [
            {
              loanId: loan._id,
              reviewerId,
              revieweeId,
              reviewerRole,
              rating: input.rating,
              comment: input.comment,
              tags: input.tags ?? [],
              reviewerSnapshot: {
                name: reviewer.name,
                trustScore: reviewer.trustScore ?? 300,
                trustBand: reviewer.trustBand ?? 'building',
              },
              scoreDelta,
            },
          ],
          { session },
        );
        if (!r) throw new AppError('create_failed', 'Failed to create review', 500);
        created = r;

        // Apply TrustScore delta + reband ATOMICALLY on the server. The
        // `reviewee` doc was read outside this session — saving it would
        // last-write-wins clobber a concurrent review's delta.
        const before = {
          trustScore: reviewee.trustScore,
          trustBand: reviewee.trustBand,
        };
        const updatedReviewee = await User.findOneAndUpdate(
          { _id: reviewee._id },
          [
            {
              $set: {
                trustScore: {
                  $max: [
                    300,
                    { $min: [900, { $add: [{ $ifNull: ['$trustScore', 300] }, scoreDelta] }] },
                  ],
                },
              },
            },
          ],
          { new: true, session },
        );
        if (!updatedReviewee) throw new AppError('user_not_found', 'Reviewee vanished', 404);
        const newScore = clampTrustScore(updatedReviewee.trustScore ?? 300);
        updatedReviewee.trustBand = bandFromScore(newScore);
        await updatedReviewee.save({ session });
        // Keep the outer doc consistent for any post-transaction reads.
        reviewee.trustScore = newScore;
        reviewee.trustBand = updatedReviewee.trustBand;

        await writeAudit(
          ctx,
          {
            action: 'review.submitted',
            entityType: 'review',
            entityId: String(r._id),
            after: {
              rating: r.rating,
              scoreDelta,
              reviewerRole,
              revieweeId,
            },
          },
          session,
        );
        await writeAudit(
          ctx,
          {
            action: 'user.trust_score.changed',
            entityType: 'user',
            entityId: String(reviewee._id),
            before,
            after: {
              trustScore: reviewee.trustScore,
              trustBand: reviewee.trustBand,
            },
            metadata: { trigger: 'review', reviewId: String(r._id) },
          },
          session,
        );
      });

      // Best-effort system chat message so the other party sees the review
      // landed without waiting for them to refresh.
      try {
        const stars = '★'.repeat(created.rating) + '☆'.repeat(5 - created.rating);
        await chatService.postSystem(
          String(loan._id),
          'system_loan_closed',
          `${reviewer.name} left a review: ${stars} (${created.rating}/5)${
            input.comment ? ` — "${input.comment}"` : ''
          }`,
          { reviewId: String(created._id), rating: created.rating, scoreDelta },
        );
      } catch {
        /* */
      }

      // Notify the reviewee
      const stars = '★'.repeat(created.rating) + '☆'.repeat(5 - created.rating);
      const deltaStr = scoreDelta >= 0 ? `+${scoreDelta}` : `${scoreDelta}`;
      notificationService.enqueue(
        revieweeId,
        'review_received',
        `${reviewer.name} left you a review`,
        `${stars} ${created.rating}/5 · TrustScore ${deltaStr}`,
        { deepLink: `/users/${revieweeId}`, metadata: { reviewId: String(created._id) } },
      );

      return toPayload(created);
    } finally {
      await session.endSession();
    }
  },

  async getByLoanForReviewer(
    loanId: string,
    reviewerId: string,
  ): Promise<ReviewPayload | null> {
    if (!Types.ObjectId.isValid(loanId)) return null;
    const review = await Review.findOne({ loanId, reviewerId });
    return review ? toPayload(review) : null;
  },

  /** All reviews ABOUT a user, paginated newest-first. Excludes hidden. */
  async listForReviewee(
    revieweeId: string,
    query: ReviewQuery,
  ): Promise<{ items: ReviewPayload[]; nextCursor: string | null }> {
    if (!Types.ObjectId.isValid(revieweeId)) {
      throw new AppError('invalid_id', 'User id is not a valid ObjectId', 400);
    }
    const filter: Record<string, unknown> = {
      revieweeId: new Types.ObjectId(revieweeId),
      hidden: { $ne: true },
    };
    if (query.before) {
      if (!/^[0-9a-fA-F]{24}$/.test(query.before)) {
        throw new AppError('invalid_cursor', 'Cursor is not a valid id', 400);
      }
      filter._id = { $lt: new Types.ObjectId(query.before) };
    }
    const reviews = await Review.find(filter)
      .sort({ _id: -1 })
      .limit(query.limit + 1);
    const hasMore = reviews.length > query.limit;
    const pageItems = hasMore ? reviews.slice(0, query.limit) : reviews;
    const nextCursor =
      hasMore && pageItems.length > 0 ? String(pageItems[pageItems.length - 1]!._id) : null;
    return { items: pageItems.map(toPayload), nextCursor };
  },

  /** Aggregate stats for a user's public profile. */
  async getStats(revieweeId: string): Promise<ReviewStats> {
    if (!Types.ObjectId.isValid(revieweeId)) {
      throw new AppError('invalid_id', 'User id is not a valid ObjectId', 400);
    }
    const result = await Review.aggregate<{
      _id: number;
      count: number;
    }>([
      { $match: { revieweeId: new Types.ObjectId(revieweeId), hidden: { $ne: true } } },
      { $group: { _id: '$rating', count: { $sum: 1 } } },
    ]);
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let total = 0;
    let sum = 0;
    for (const row of result) {
      const r = row._id as 1 | 2 | 3 | 4 | 5;
      distribution[r] = row.count;
      total += row.count;
      sum += row.count * r;
    }
    return {
      averageRating: total > 0 ? Math.round((sum / total) * 10) / 10 : null,
      totalReviews: total,
      distribution,
    };
  },
};
