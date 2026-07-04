import { z } from 'zod';

/** Folders the mobile app is allowed to request signatures for. */
export const uploadFolderSchema = z.enum([
  'trustpe-kyc-aadhaar',
  'trustpe-kyc-pan',
  'trustpe-kyc-selfie',
  'trustpe-upi-screenshot',
  'trustpe-profile-photo',
]);
export type UploadFolder = z.infer<typeof uploadFolderSchema>;

/** Mobile requests a Cloudinary upload signature for a specific folder. */
export const requestUploadSignatureSchema = z.object({
  folder: uploadFolderSchema,
});
export type RequestUploadSignatureInput = z.infer<typeof requestUploadSignatureSchema>;

/** Response shape — everything the mobile needs to POST to Cloudinary directly. */
export const uploadSignatureResponseSchema = z.object({
  signature: z.string(),
  timestamp: z.number(),
  apiKey: z.string(),
  cloudName: z.string(),
  folder: z.string(),
});
export type UploadSignatureResponse = z.infer<typeof uploadSignatureResponseSchema>;
