import * as SecureStore from 'expo-secure-store';
export interface CredentialStore {
  get(): Promise<string | null>;
  set(token: string): Promise<void>;
  clear(): Promise<void>;
}
const key = 'ridecore.rider.credential';
const options = {
  keychainService: 'ridecore-rider-session',
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};
export const credentialStore: CredentialStore = {
  get: () => SecureStore.getItemAsync(key, options),
  set: (token) => SecureStore.setItemAsync(key, token, options),
  clear: () => SecureStore.deleteItemAsync(key, options),
};
