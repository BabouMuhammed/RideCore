import 'react-native-gesture-handler/jestSetup';
import { setUpTests } from 'react-native-reanimated';
// Native maps and sheet gestures need a development build; UI tests exercise
// their owners with inert rendering, never pretend to verify the native SDK.
jest.mock('../src/features/map/MapCanvas', () => ({ MapCanvas: () => null }));
jest.mock('../src/components/sheets/JourneySheet', () => ({
  JourneySheet: ({ children }: { children: import('react').ReactNode }) =>
    children,
}));
jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));
// Native worklet threads are replaced only in the Jest environment.
jest.mock('react-native-worklets', () =>
  jest.requireActual('react-native-worklets/src/mock'),
);

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn().mockResolvedValue(undefined),
  hideAsync: jest.fn().mockResolvedValue(undefined),
}));

setUpTests();

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 6,
}));
