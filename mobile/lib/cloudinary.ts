/**
 * Cloudinary uploader — direct from the mobile app, using a short-lived
 * signature from our backend so the API secret never touches the device.
 *
 * Flow:
 *   1. Ask backend `POST /v1/uploads/signature` for { signature, timestamp, ... }
 *   2. POST multipart/form-data straight to Cloudinary
 *   3. Get back { public_id, secure_url, ... }
 *   4. Hand the public_id to the KYC submit / UPI register / profile update endpoint
 *
 * See ARCHITECTURE.md §6.2 — adapter discipline. Mobile knows about Cloudinary
 * directly here because there's no native KYC UX without it; backend remains
 * adapter-disciplined and only sees public_ids.
 */
import type { UploadFolder, UploadSignatureResponse } from 'trustpe-shared';

type AuthedFetch = <T>(opts: {
  path: string;
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: Record<string, unknown> | unknown[] | null;
}) => Promise<T>;

export type CloudinaryUploadResult = {
  publicId: string;
  secureUrl: string;
  resourceType: 'image' | 'video' | 'raw';
  bytes: number;
};

type CloudinaryApiResponse = {
  public_id: string;
  secure_url: string;
  resource_type: 'image' | 'video' | 'raw';
  bytes: number;
  error?: { message: string };
};

/**
 * Upload a local file URI to Cloudinary in the given folder.
 *
 * @param localUri  file:// URI returned by Expo Camera / ImagePicker
 * @param mimeType  e.g. 'image/jpeg' or 'video/mp4'
 * @param folder    one of the allowed UploadFolder enum values
 * @param apiCall   the auth-context apiCall fn so this can hit our backend
 */
export async function uploadToCloudinary(
  localUri: string,
  mimeType: string,
  folder: UploadFolder,
  apiCall: AuthedFetch,
): Promise<CloudinaryUploadResult> {
  // 1. Get a signature from our backend.
  const sig = await apiCall<UploadSignatureResponse>({
    path: '/uploads/signature',
    method: 'POST',
    body: { folder },
  });

  // 2. Build multipart form.
  const form = new FormData();
  // RN's FormData wants this exact shape for file uploads.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form.append('file', { uri: localUri, type: mimeType, name: 'upload' } as any);
  form.append('api_key', sig.apiKey);
  form.append('timestamp', String(sig.timestamp));
  form.append('signature', sig.signature);
  form.append('folder', sig.folder);

  // 3. POST to Cloudinary. `auto` resource type handles images + videos.
  const url = `https://api.cloudinary.com/v1_1/${sig.cloudName}/auto/upload`;
  const res = await fetch(url, { method: 'POST', body: form });
  const data = (await res.json()) as CloudinaryApiResponse;

  if (!res.ok || data.error) {
    throw new Error(data.error?.message ?? `Cloudinary upload failed (${res.status})`);
  }
  return {
    publicId: data.public_id,
    secureUrl: data.secure_url,
    resourceType: data.resource_type,
    bytes: data.bytes,
  };
}
