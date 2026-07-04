/**
 * PushToken — one record per device per user.
 *
 * A user can have multiple devices (Android phone, future iOS, future
 * tablet) — we send to all of their active tokens. Unique on the token
 * value so re-registering the same device just refreshes `lastSeenAt`.
 */
import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

const pushTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    token: { type: String, required: true, unique: true },
    platform: { type: String, enum: ['android', 'ios'], required: true },
    lastSeenAt: { type: Date, required: true, default: () => new Date() },
    invalidatedAt: Date,
  },
  { timestamps: true },
);

pushTokenSchema.index({ userId: 1, invalidatedAt: 1 });

export type PushTokenDocument = InferSchemaType<typeof pushTokenSchema> & {
  _id: Schema.Types.ObjectId;
};
export const PushToken: Model<PushTokenDocument> = model<PushTokenDocument>(
  'PushToken',
  pushTokenSchema,
);
