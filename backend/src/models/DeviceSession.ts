/**
 * Device session — one row per active login on a specific device.
 *
 * Captured at first login on the device, updated on every refresh.
 * Powers profile-health signals (device consistency = positive,
 * sudden new-country login = fraud flag) and the "active sessions"
 * settings screen where a user can revoke other devices.
 */
import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

const deviceSessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    deviceFingerprint: { type: String, required: true, index: true },
    platform: { type: String, enum: ['android', 'ios', 'web'], required: true },
    appVersion: String,
    osVersion: String,
    deviceModel: String,

    ip: String,
    geo: {
      country: String,
      region: String,
      city: String,
    },

    refreshTokenFamilyId: { type: String, index: true },

    firstSeenAt: { type: Date, required: true, default: () => new Date() },
    lastSeenAt: { type: Date, required: true, default: () => new Date(), index: true },
    revokedAt: Date,
  },
  { timestamps: true },
);

deviceSessionSchema.index({ userId: 1, deviceFingerprint: 1 }, { unique: true });

export type DeviceSessionDocument = InferSchemaType<typeof deviceSessionSchema> & {
  _id: Schema.Types.ObjectId;
};
export const DeviceSession: Model<DeviceSessionDocument> = model<DeviceSessionDocument>(
  'DeviceSession',
  deviceSessionSchema,
);
