import { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { AppProviders } from './src/application/AppProviders';
import { RootNavigator } from './src/navigation/RootNavigator';
import { colors } from './src/theme/tokens';
import { PublicEntry } from './src/application/PublicEntry';
import {
  loadServerOverride,
  onServerChange,
} from './src/services/server-config';

// Keep the native launch surface until the first real application layout exists.
void SplashScreen.preventAutoHideAsync().catch(() => undefined);

const appFonts = {
  'Inter-Regular': require('./assets/fonts/Inter_400Regular.ttf'),
  'Inter-Medium': require('./assets/fonts/Inter_500Medium.ttf'),
  'Inter-SemiBold': require('./assets/fonts/Inter_600SemiBold.ttf'),
  'Inter-Bold': require('./assets/fonts/Inter_700Bold.ttf'),
  'Inter-MediumItalic': require('./assets/fonts/Inter_500Medium_Italic.ttf'),
  'Inter-BoldItalic': require('./assets/fonts/Inter_700Bold_Italic.ttf'),
};

export default function App() {
  // A font that fails to load falls back to the system face rather than
  // blocking the app, so `error` also lets the first layout render.
  const [fontsLoaded, fontError] = useFonts(appFonts);
  // A saved demo server address must be known before any service starts.
  const [serverReady, setServerReady] = useState(false);
  // Changing the server remounts every provider so nothing keeps the old one.
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    void loadServerOverride().finally(() => setServerReady(true));
    return onServerChange(() => setGeneration((value) => value + 1));
  }, []);
  const onLayout = useCallback(() => {
    void SplashScreen.hideAsync().catch(() => undefined);
  }, []);

  if ((!fontsLoaded && !fontError) || !serverReady) return null;

  return (
    <View testID="application-root" style={styles.root} onLayout={onLayout}>
      <PublicEntry key={generation}>
        <AppProviders>
          <RootNavigator />
        </AppProviders>
      </PublicEntry>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
});
