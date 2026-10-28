import { useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { AppProviders } from './src/application/AppProviders';
import { RootNavigator } from './src/navigation/RootNavigator';
import { colors } from './src/theme/tokens';
import { PublicEntry } from './src/application/PublicEntry';

// Keep the native launch surface until the first real application layout exists.
void SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function App() {
  const onLayout = useCallback(() => {
    void SplashScreen.hideAsync().catch(() => undefined);
  }, []);

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
