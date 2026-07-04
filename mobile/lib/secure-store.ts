/**
 * SecureStore wrappers — encrypted persistent storage backed by Android Keystore.
 *
 * Used for the refresh token (and only the refresh token; access token stays
 * in memory). Returns null when the key is missing rather than throwing.
 */
import * as SecureStore from 'expo-secure-store';

const KEY_REFRESH_TOKEN = 'trustpe.refresh_token';

export const secureStore = {
  async getRefreshToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(KEY_REFRESH_TOKEN);
    } catch {
      return null;
    }
  },

  async setRefreshToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(KEY_REFRESH_TOKEN, token, {
      // Keychain access — we never need this in background, only when app is in use.
      keychainAccessible: SecureStore.WHEN_UNLOCKED,
    });
  },

  async clearRefreshToken(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(KEY_REFRESH_TOKEN);
    } catch {
      // ignore — already gone
    }
  },
};
