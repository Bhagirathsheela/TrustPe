/**
 * IdempotencyKey — stored response for money-touching endpoints.
 *
 * See CLAUDE.md "Idempotency on money-touching endpoints": clients send an
 * `Idempotency-Key` header (UUID); the server stores key + response for 24h
 * and replays the cached response on retry.
 *
 * Scoped per (userId, key, route) so one client's key can't collide with or
 * read another's response.
 */
import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

const idempotencyKeySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    key: { type: String, required: true },
    route: { type: String, required: true }, // method + path, e.g. "POST /v1/loans/:id/disburse"

    /** 'pending' while the first request is in flight; 'completed' once stored. */
    state: { type: String, enum: ['pending', 'completed'], required: true, default: 'pending' },

    statusCode: Number,
    /** JSON-serialised response body. */
    responseBody: String,

    createdAt: { type: Date, required: true, default: () => new Date() },
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);

idempotencyKeySchema.index({ userId: 1, key: 1, route: 1 }, { unique: true });
// Auto-expire after 24 hours.
idempotencyKeySchema.index({ createdAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });

export type IdempotencyKeyDocument = InferSchemaType<typeof idempotencyKeySchema> & {
  _id: Schema.Types.ObjectId;
};
export const IdempotencyKey: Model<IdempotencyKeyDocument> = model<IdempotencyKeyDocument>(
  'IdempotencyKey',
  idempotencyKeySchema,
);
