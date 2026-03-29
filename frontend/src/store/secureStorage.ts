/**
 * Hybrid Zustand storage adapter.
 *
 * The session token (Bearer credential) is stored in the OS secure enclave
 * (expo-secure-store on iOS/Android, AsyncStorage fallback on web).
 * All other persisted state lives in AsyncStorage as normal.
 *
 * How it works:
 *   - setItem: extracts sessionToken from the state blob, writes it to
 *     SecureStore, and writes the rest of the blob (token nulled) to AsyncStorage.
 *   - getItem: reads the blob from AsyncStorage, retrieves the token from
 *     SecureStore, and stitches them together before returning.
 *   - removeItem: deletes from both stores.
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SECURE_TOKEN_KEY = 'viibe_session_token';

async function secureRead(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return AsyncStorage.getItem(SECURE_TOKEN_KEY);
  }
  const { getItemAsync } = await import('expo-secure-store');
  return getItemAsync(SECURE_TOKEN_KEY);
}

async function secureWrite(value: string): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(SECURE_TOKEN_KEY, value);
    return;
  }
  const { setItemAsync } = await import('expo-secure-store');
  await setItemAsync(SECURE_TOKEN_KEY, value);
}

async function secureDelete(): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.removeItem(SECURE_TOKEN_KEY);
    return;
  }
  const { deleteItemAsync } = await import('expo-secure-store');
  await deleteItemAsync(SECURE_TOKEN_KEY);
}

export const hybridStorage = {
  async getItem(name: string): Promise<string | null> {
    const stored = await AsyncStorage.getItem(name);
    if (!stored) return stored;

    const token = await secureRead();
    if (!token) return stored;

    try {
      const parsed = JSON.parse(stored);
      if (parsed?.state !== undefined) {
        parsed.state = { ...parsed.state, sessionToken: token };
      }
      return JSON.stringify(parsed);
    } catch {
      return stored;
    }
  },

  async setItem(name: string, value: string): Promise<void> {
    try {
      const parsed = JSON.parse(value);
      const token: string | null | undefined = parsed?.state?.sessionToken;

      if (token) {
        await secureWrite(token);
        // Remove token from the AsyncStorage blob
        const sanitized = {
          ...parsed,
          state: { ...parsed.state, sessionToken: null },
        };
        await AsyncStorage.setItem(name, JSON.stringify(sanitized));
        return;
      }

      if (token === null) {
        // Explicit null means the user logged out — purge from SecureStore too
        await secureDelete();
      }
    } catch {
      // Fall through to default write if JSON parsing fails
    }
    await AsyncStorage.setItem(name, value);
  },

  async removeItem(name: string): Promise<void> {
    await AsyncStorage.removeItem(name);
    await secureDelete();
  },
};
