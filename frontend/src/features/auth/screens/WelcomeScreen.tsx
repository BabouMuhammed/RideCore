import { useSession } from '../../session/SessionProvider';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParams } from '../../../navigation/types';
import { Wordmark } from '../../../components/brand/Wordmark';
import { Headline } from '../../../components/ui/Headline';
import { Text } from '../../../components/ui/Text';
import { Button } from '../../../components/ui/Button';
import { colors, fonts, size, space } from '../../../theme/tokens';
import { useDemo } from '../../../demo/DemoProvider';
import { apiUrl, serverSettingAllowed } from '../../../services/server-config';

const car = require('../../../../assets/images/onboarding-car.jpg');

// Soft fade so the photo melts into the page, as in the Figma onboarding.
function Fade({ edge }: { edge: 'top' | 'bottom' }) {
  const id = `fade-${edge}`;
  return (
    <Svg
      style={[styles.fade, edge === 'top' ? { top: 0 } : { bottom: 0 }]}
      width="100%"
      height="100%"
      preserveAspectRatio="none"
      pointerEvents="none"
    >
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.canvas} stopOpacity={edge === 'top' ? 1 : 0} />
          <Stop offset="1" stopColor={colors.canvas} stopOpacity={edge === 'top' ? 0 : 1} />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

export function WelcomeScreen({
  navigation,
}: NativeStackScreenProps<AuthStackParams, 'Welcome'>) {
  const { state } = useSession();
  const demo = useDemo();
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.scroll} bounces={false}>
        <View style={styles.copy}>
          <Wordmark />
          <View style={styles.message}>
            <Headline text={'Request *Your*\nRide in *Seconds*'} />
            <Text tone="secondary" style={styles.lede}>
              Fast pickups, simple booking, and a smoother way to move around.
            </Text>
          </View>
        </View>
        <View style={styles.hero}>
          <Image
            source={car}
            style={styles.photo}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
          <View style={styles.fadeTop}>
            <Fade edge="top" />
          </View>
          <View style={styles.fadeBottom}>
            <Fade edge="bottom" />
          </View>
        </View>
        <View style={styles.actions}>
          {state.stage === 'anonymous' && state.expired && (
            <Text accessibilityLiveRegion="polite">
              Your sign-in is no longer valid. Please sign in again.
            </Text>
          )}
          <Button
            label="Get started"
            onPress={() => navigation.navigate('Register')}
          />
          <View style={styles.signInRow}>
            <Text tone="secondary">Already have an account?</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sign in"
              onPress={() => navigation.navigate('SignIn')}
              hitSlop={10}
              style={({ pressed }) => [styles.link, pressed && { opacity: 0.6 }]}
            >
              <Text variant="label" style={styles.linkText}>
                Sign in
              </Text>
            </Pressable>
          </View>
          <View style={styles.extras}>
            <Pressable accessibilityRole="button" accessibilityLabel="Admin sign in"
              onPress={() => navigation.navigate('AdminSignIn')} style={styles.link}>
              <Text variant="caption" tone="secondary">Admin sign in</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Try demo"
              onPress={demo.enter}
              hitSlop={8}
              style={({ pressed }) => [styles.link, pressed && { opacity: 0.6 }]}
            >
              <Text variant="caption" tone="secondary" style={styles.underline}>
                Try demo
              </Text>
            </Pressable>
            {serverSettingAllowed && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Server address settings"
                onPress={() => navigation.navigate('ServerSettings')}
                hitSlop={8}
                style={({ pressed }) => [styles.link, pressed && { opacity: 0.6 }]}
              >
                <Text variant="caption" tone="secondary">
                  Server: {(apiUrl() ?? 'not set').replace(/^https?:\/\//, '').replace(/\/api$/, '')}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },
  copy: {
    width: '100%',
    maxWidth: size.contentMax,
    alignSelf: 'center',
    paddingHorizontal: space.xl,
    paddingTop: space.xl,
    gap: space.xxl,
  },
  message: { gap: space.lg },
  lede: { maxWidth: 322 },
  hero: { flexGrow: 1, minHeight: 300, marginTop: space.sm },
  photo: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  fadeTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 64 },
  fadeBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 96 },
  fade: { position: 'absolute', left: 0, right: 0 },
  actions: {
    width: '100%',
    maxWidth: size.contentMax,
    alignSelf: 'center',
    paddingHorizontal: space.xl,
    paddingBottom: space.md,
    gap: space.md,
  },
  signInRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: space.xs,
    minHeight: 44,
  },
  link: { minHeight: 44, justifyContent: 'center', paddingHorizontal: space.xs },
  linkText: { fontFamily: fonts.semibold, color: colors.text },
  extras: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.lg },
  underline: { textDecorationLine: 'underline' },
});
