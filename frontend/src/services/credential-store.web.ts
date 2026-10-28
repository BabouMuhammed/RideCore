import type { CredentialStore } from './credential-store';

const key = 'ridecore.rider.credential';

// Browser storage is for development/UI review only, not production web auth.
// It is readable by same-origin JavaScript and has no SecureStore guarantees.
// Expo resolves this file only on web; Android/iOS retain the native adapter.
// Access lazily so module loading/export does not require browser globals.
// Storage failures must reject so the existing session recovery still applies.
export const credentialStore: CredentialStore = {
  get: async () => localStorage.getItem(key),
  set: async (token) => localStorage.setItem(key, token),
  clear: async () => localStorage.removeItem(key),
};
