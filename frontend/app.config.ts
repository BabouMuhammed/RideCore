import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'RideCore',
  slug: 'ridecore-rider',
  extra: {
    eas: { projectId: '43d9e106-4932-4553-9d79-aaf1a6b5c242' },
  },
  version: '0.1.0',
  orientation: 'portrait',
  scheme: 'ridecore',
  userInterfaceStyle: 'light',
  icon: './assets/icon.png',
  ios: { supportsTablet: true, bundleIdentifier: 'com.ridecore.rider' },
  android: {
    package: 'com.ridecore.rider',
    softwareKeyboardLayoutMode: 'resize',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#125C46',
    },
    // Native libraries must not implicitly request unsupported MVP capabilities.
    blockedPermissions: [
      'android.permission.RECORD_AUDIO',
      'android.permission.SYSTEM_ALERT_WINDOW',
    ],
  },
  plugins: [
    [
      'expo-secure-store',
      { configureAndroidBackup: true, faceIDPermission: false },
    ],
    ['expo-status-bar', { style: 'light' }],
    ['expo-dev-client', { launchMode: 'most-recent' }],
    [
      'expo-splash-screen',
      {
        backgroundColor: '#125C46',
        image: './assets/splash.png',
        imageWidth: 120,
      },
    ],
    '@maplibre/maplibre-react-native',
    // Lets demo builds reach a laptop backend over plain http on the local
    // network. The app itself refuses plain http to any public address.
    ['expo-build-properties', { android: { usesCleartextTraffic: true } }],
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'RideCore uses your location to help you choose your pickup point.',
        isAndroidBackgroundLocationEnabled: false,
        isAndroidForegroundServiceEnabled: false,
      },
    ],
  ],
};

export default config;
