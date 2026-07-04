/**
 * Cloudinary signature service — issues short-lived signatures so the mobile
 * app can upload directly to Cloudinary without ever seeing our API secret.
 *
 * Flow:
 *   1. Mobile asks backend for a signature ("I want to upload to folder X")
 *   2. We generate a SHA-1 signature using the API secret
 *   3. Mobile uploads to Cloudinary with the signature + timestamp + folder
 *   4. Cloudinary validates and returns the public_id
 *   5. Mobile submits the public_id back to our KYC endpoint
 *
 * The API secret never leaves the backend. The signature is valid for ~1 hour.
 *
 * Required env: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.
 */
import { createHash } from 'node:crypto';
import { env } from '../config/env.js';
import { AppError } from '../middleware/error-handler.js';

export type CloudinarySignature = {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
};

const ALLOWED_FOLDERS = new Set([
  'trustpe-kyc-aadhaar',
  'trustpe-kyc-pan',
  'trustpe-kyc-selfie',
  'trustpe-upi-screenshot',
  'trustpe-profile-photo',
]);

/**
 * Cloudinary's signature spec: SHA-1 of a sorted querystring of the params
 * being signed, concatenated with the api_secret.
 *
 * Example string to sign:
 *   folder=trustpe-kyc-aadhaar&timestamp=1700000000
 * Then append api_secret and SHA-1 hash it.
 */
function signParams(params: Record<string, string | number>, apiSecret: string): string {
  const sorted = Object.entries(params)
    .map(([k, v]) => [k, String(v)] as const)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  return createHash('sha1').update(sorted + apiSecret).digest('hex');
}

/**
 * Public delivery URL for a Cloudinary asset.
 *
 * resourceType:
 *   - 'image' for jpg/png (Aadhaar / PAN / profile photos / UPI screenshots)
 *   - 'video' for mp4 (selfie video)
 *
 * Public URLs are unguessable in practice (random public_id under a known
 * folder) but not authenticated. Phase 2 will switch KYC uploads to
 * `type=authenticated` + signed view URLs for stronger access control.
 */
function publicUrl(publicId: string, resourceType: 'image' | 'video'): string {
  if (!env.CLOUDINARY_CLOUD_NAME) {
    throw new AppError('cloudinary_not_configured', 'Cloudinary cloud name not set', 503);
  }
  return `https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/${resourceType}/upload/${publicId}`;
}

export const cloudinaryService = {
  sign(folder: string): CloudinarySignature {
    if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
      throw new AppError(
        'cloudinary_not_configured',
        'Cloudinary credentials are not set on the backend. See backend/.env.example.',
        503,
      );
    }
    if (!ALLOWED_FOLDERS.has(folder)) {
      throw new AppError('invalid_folder', `Folder "${folder}" is not allowed`, 400);
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const signature = signParams({ folder, timestamp }, env.CLOUDINARY_API_SECRET);

    return {
      signature,
      timestamp,
      apiKey: env.CLOUDINARY_API_KEY,
      cloudName: env.CLOUDINARY_CLOUD_NAME,
      folder,
    };
  },

  imageUrl(publicId: string): string {
    return publicUrl(publicId, 'image');
  },

  videoUrl(publicId: string): string {
    return publicUrl(publicId, 'video');
  },
};
