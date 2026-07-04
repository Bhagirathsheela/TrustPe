/**
 * In-app notification record.
 *
 * Persisted so users can scroll a history even if they missed the push or
 * had the app closed. Each record has an optional `deepLink` that the
 * mobile router uses to jump straight to the relevant screen on tap.
 */
import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

const notificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    kind: { type: String, required: true, index: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    deepLink: String,
    metadata: { type: Schema.Types.Mixed },
    read: { type: Boolean, default: false, index: true },
    readAt: Date,
    createdAt: { type: Date, required: true, default: () => new Date(), index: true },
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);

notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

export type NotificationDocument = InferSchemaType<typeof notificationSchema> & {
  _id: Schema.Types.ObjectId;
};
export const Notification: Model<NotificationDocument> = model<NotificationDocument>(
  'Notification',
  notificationSchema,
);
