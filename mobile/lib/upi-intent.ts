/**
 * UPI Intent launcher.
 *
 * Phase 1 ships on Expo Go, so we can't ship a custom native module that
 * uses `startActivityForResult` to capture the UPI app's Intent return.
 * Instead we use `expo-linking` to fire `upi://pay?...` — Android picks
 * the best UPI app, the user pays, and they manually return to TrustPe to
 * mark the payment.
 *
 * Once we move to an EAS dev client (Phase 1.5) we can replace this with
 * a custom native module that captures the return values (Status, txnRef,
 * Amount, txnId) directly — no manual UTR entry needed.
 */
import * as Linking from 'expo-linking';

export async function openUpiIntent(upiUrl: string): Promise<{ launched: boolean; error?: string }> {
  try {
    const can = await Linking.canOpenURL(upiUrl);
    if (!can) {
      return {
        launched: false,
        error:
          'No UPI app is installed on this device. Install GPay, PhonePe, Paytm, or BHIM and try again.',
      };
    }
    await Linking.openURL(upiUrl);
    return { launched: true };
  } catch (err) {
    return { launched: false, error: err instanceof Error ? err.message : 'Failed to launch UPI app' };
  }
}
