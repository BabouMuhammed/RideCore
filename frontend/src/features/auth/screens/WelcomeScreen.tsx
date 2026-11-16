import { useSession } from '../../session/SessionProvider';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParams } from '../../../navigation/types';
import { VehicleArt } from '../../../components/brand/VehicleArt';
import { Text } from '../../../components/ui/Text';
import { Button } from '../../../components/ui/Button';
import { colors, fonts, size, space } from '../../../theme/tokens';
import { useDemo } from '../../../demo/DemoProvider';
import { apiUrl, serverSettingAllowed } from '../../../services/server-config';

export function WelcomeScreen({
  navigation,
}: NativeStackScreenProps<AuthStackParams, 'Welcome'>) {
  const { state } = useSession();
  const demo = useDemo();
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        bounces={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroInner}>
            <Text style={styles.wordmark}>RideCore</Text>
            <Text variant="display" accessibilityRole="header">
              Your town trip, a tap away.
            </Text>
            <Text style={styles.lede}>
              Banjul to Brikama. Fares in dalasi, agreed before you ride.
            </Text>
            <View style={styles.car}>
              <VehicleArt width={240} />
            </View>
          </View>
        </View>
        {/* The green band of a Gambian town-trip taxi. Decorative only. */}
        <View
          style={styles.band}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
        <View style={styles.bandTrim} />
        <SafeAreaView edges={['bottom']} style={styles.actions}>
          {state.stage === 'anonymous' && state.expired && (
            <Text accessibilityLiveRegion="polite">
              Your sign-in is no longer valid. Please sign in again.
            </Text>
          )}
          <Button label="Sign in" onPress={() => navigation.navigate('SignIn')} />
          <Button
            label="Create an account"
            variant="secondary"
            onPress={() => navigation.navigate('Register')}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Try demo"
            onPress={demo.enter}
            hitSlop={8}
            style={({ pressed }) => [styles.demo, pressed && { opacity: 0.6 }]}
          >
            <Text variant="label" style={styles.demoLabel}>
              Try demo
            </Text>
          </Pressable>
          {serverSettingAllowed && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Server address settings"
              onPress={() => navigation.navigate('ServerSettings')}
              hitSlop={8}
              style={({ pressed }) => [styles.demo, pressed && { opacity: 0.6 }]}
            >
              <Text variant="caption" tone="secondary">
                Server: {(apiUrl() ?? 'not set').replace(/^https?:\/\//, '').replace(/\/api$/, '')}
              </Text>
            </Pressable>
          )}
        </SafeAreaView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.taxi },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, backgroundColor: colors.canvas },
  hero: {
    flexGrow: 1,
    backgroundColor: colors.taxi,
    paddingHorizontal: space.xl,
    paddingTop: space.xl,
    paddingBottom: space.lg,
  },
  heroInner: {
    flexGrow: 1,
    width: '100%',
    maxWidth: size.contentMax,
    alignSelf: 'center',
    gap: space.lg,
  },
  wordmark: {
    fontFamily: fonts.wideBold,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.5,
    marginBottom: space.xl,
  },
  lede: { fontSize: 17, lineHeight: 25, maxWidth: 320 },
  // The car sits on the green band, like a taxi on the road.
  car: {
    alignItems: 'flex-end',
    marginTop: 'auto',
    paddingTop: space.md,
    marginRight: -space.md,
    marginBottom: -space.lg,
  },
  band: { height: 30, backgroundColor: colors.brand },
  bandTrim: { height: 10, backgroundColor: colors.taxi },
  actions: {
    width: '100%',
    maxWidth: size.contentMax,
    alignSelf: 'center',
    gap: space.md,
    paddingHorizontal: space.xl,
    paddingTop: space.xl,
    paddingBottom: space.lg,
    backgroundColor: colors.canvas,
  },
  demo: {
    alignSelf: 'center',
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
  },
  demoLabel: { textDecorationLine: 'underline' },
});
