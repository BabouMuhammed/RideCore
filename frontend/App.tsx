import { useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { AppProviders } from './src/application/AppProviders';
import { RootNavigator } from './src/navigation/RootNavigator';
import { colors } from './src/theme/tokens';
import { PublicEntry } from './src/application/PublicEntry';

// Keep the native launch surface until the first real application layout exists.
void SplashScreen.preventAutoHideAsync().catch(() => undefined);

const appFonts = {
  'Archivo-Regular': require('./assets/fonts/Archivo-Regular.ttf'),
  'Archivo-Medium': require('./assets/fonts/Archivo-Medium.ttf'),
  'Archivo-SemiBold': require('./assets/fonts/Archivo-SemiBold.ttf'),
  'Archivo-Bold': require('./assets/fonts/Archivo-Bold.ttf'),
  'ArchivoExpanded-ExtraBold': require('./assets/fonts/ArchivoExpanded-ExtraBold.ttf'),
  'ArchivoExpanded-Black': require('./assets/fonts/ArchivoExpanded-Black.ttf'),
};

export default function App() {
  // A font that fails to load falls back to the system face rather than
  // blocking the app, so `error` also lets the first layout render.
  const [fontsLoaded, fontError] = useFonts(appFonts);
  const onLayout = useCallback(() => {
    void SplashScreen.hideAsync().catch(() => undefined);
  }, []);

  if (!fontsLoaded && !fontError) return null;

  return (
    <View testID="application-root" style={styles.root} onLayout={onLayout}>
      <PublicEntry>
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
