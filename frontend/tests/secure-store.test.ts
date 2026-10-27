import * as SecureStore from 'expo-secure-store';
import { credentialStore } from '../src/services/credential-store';
test('credential operations use only SecureStore with a device-only accessible keychain entry', async () => {
  jest.clearAllMocks();
  await credentialStore.get();
  await credentialStore.set('test-only-credential');
  await credentialStore.clear();
  const options = {
    keychainService: 'ridecore-rider-session',
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  };
  expect(SecureStore.getItemAsync).toHaveBeenCalledWith(
    'ridecore.rider.credential',
    options,
  );
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
    'ridecore.rider.credential',
    'test-only-credential',
    options,
  );
  expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
    'ridecore.rider.credential',
    options,
  );
});
