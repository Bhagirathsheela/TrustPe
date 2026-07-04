/**
 * Profile model — rich user data separated from the User collection.
 *
 * Why separate: `users` is hot (queried on every auth call). Profile data
 * (photo, bio, occupation) is read less often and would bloat the User
 * documents. One Profile per User, linked by userId.
 *
 * See ARCHITECTURE.md §11.1.
 */
import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

const profileSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },

    // Denormalized from User for fast public-profile reads
    name: { type: String, required: true, trim: true },

    photoCloudinaryId: { type: String },

    city: { type: String, trim: true, index: true },
    bio: { type: String, trim: true, maxlength: 500 },

    occupationCategory: {
      type: String,
      enum: [
        'salaried_private',
        'salaried_government',
        'self_employed_business',
        'self_employed_professional',
        'gig_worker',
        'farmer',
        'student',
        'homemaker',
        'retired',
        'other',
      ],
    },
    occupationDetail: { type: String, trim: true, maxlength: 120 },

    declaredMonthlyIncome: {
      type: String,
      enum: ['under_10k', '10k_25k', '25k_50k', '50k_1L', '1L_2L', 'over_2L'],
    },

    // Lender-specific: max value of open offers at any time
    monthlyLendingCapacityPaise: { type: Number, min: 0 },
  },
  { timestamps: true },
);

profileSchema.index({ city: 1, createdAt: -1 });

export type ProfileDocument = InferSchemaType<typeof profileSchema> & {
  _id: Schema.Types.ObjectId;
};
export const Profile: Model<ProfileDocument> = model<ProfileDocument>('Profile', profileSchema);
