import { SessionProvider } from '../features/session/SessionProvider';
import type { PropsWithChildren } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { navigationTheme } from '../navigation/theme';
import { AppErrorBoundary } from './AppErrorBoundary';
import { DemoProvider } from '../demo/DemoProvider';
// Browser tab title on web. Screens without a title used to show "undefined".
function documentTitle(options?: { title?: string }) {
  return typeof options?.title === 'string' && options.title
    ? `${options.title} · RideCore`
    : 'RideCore';
}
export function AppProviders({ children }: PropsWithChildren) {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <AppErrorBoundary>
          <DemoProvider>
            <NavigationContainer
              theme={navigationTheme}
              documentTitle={{ formatter: documentTitle }}
            >
              <BottomSheetModalProvider>
                <StatusBar style="dark" />
                <SessionProvider>{children}</SessionProvider>
              </BottomSheetModalProvider>
            </NavigationContainer>
          </DemoProvider>
        </AppErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
const styles = StyleSheet.create({ root: { flex: 1 } });
