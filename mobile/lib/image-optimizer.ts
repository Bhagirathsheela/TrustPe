/**
 * Image optimizer — resize + compress KYC captures before upload.
 *
 * Raw camera captures on modern Android phones are 3–8 MB each. With four
 * uploads in the KYC flow that's 20+ MB on a slow connection. Aadhaar and
 * PAN cards are ~85×55mm so a 1600px-wide JPEG at 70% quality is plenty for
 * OCR readability and admin review while shrinking each file to ~200–400 KB
 * — a ~95% reduction.
 *
 * Quality vs size trade-off: 0.70 was chosen empirically. UIDAI's portal
 * accepts much smaller scans than this for verification, and admins reading
 * PAN/Aadhaar numbers off a 1600px JPEG see them crisp. Don't drop below
 * 0.60 — text edges start to fuzz on lower-end displays.
 *
 * Used only for still images. Videos go up uncompressed — re-encoding video
 * on-device is expensive and `recordAsync({ maxDuration: 5 })` already
 * caps the size.
 */
import * as ImageManipulator from 'expo-image-manipulator';

const TARGET_WIDTH = 1600;
const QUALITY = 0.7;

export type OptimizedImage = {
  uri: string;
  mimeType: string;
};

/**
 * Resize and compress a still image. Safe to call on the original URI —
 * the manipulator writes a new file in the cache directory.
 *
 * Falls back to the original URI if optimization throws (e.g. unsupported
 * format) so the user can still complete KYC; we'd rather upload a big file
 * than block the flow.
 */
export async function optimizeImageForUpload(uri: string): Promise<OptimizedImage> {
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: TARGET_WIDTH } }],
      { compress: QUALITY, format: ImageManipulator.SaveFormat.JPEG },
    );
    return { uri: result.uri, mimeType: 'image/jpeg' };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[image-optimizer] falling back to original', err);
    return { uri, mimeType: 'image/jpeg' };
  }
}
