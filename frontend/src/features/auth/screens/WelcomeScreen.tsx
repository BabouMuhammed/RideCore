import { useSession } from '../../session/SessionProvider';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParams } from '../../../navigation/types';
import { Screen } from '../../../components/layout/Screen';
import { VehicleArt } from '../../../components/brand/VehicleArt';
import { Icon } from '../../../components/ui/Icon';
import { Text } from '../../../components/ui/Text';
import { Button } from '../../../components/ui/Button';
import { colors, space } from '../../../theme/tokens';
import { useDemo } from '../../../demo/DemoProvider';
export function WelcomeScreen({
  navigation,
}: NativeStackScreenProps<AuthStackParams, 'Welcome'>) {
  const { state } = useSession();
  const demo = useDemo();
  return (
    <Screen>
      <View style={styles.brand}>
        <Text variant="display" style={styles.wordmark}>
          RideCore
        </Text>
      </View>
      <View style={styles.hero}>
        <View style={styles.art}>
          <VehicleArt width={280} />
          <View style={styles.destination}>
            <Icon name="pin" />
            <Text variant="label">Your next stop</Text>
          </View>
        </View>
        <Text variant="display" accessibilityRole="header">
          Go anywhere.{'\n'}Get there with us.
        </Text>
        <Text tone="secondary">A simpler way to get where you need to be.</Text>
      </View>
      <View style={styles.actions}>
        {state.stage === 'anonymous' && state.expired && (
          <Text accessibilityLiveRegion="polite">
            Your sign-in is no longer valid. Please sign in again.
          </Text>
        )}
        <Button label="Sign in" onPress={() => navigation.navigate('SignIn')} />
        <Button label="Try demo" variant="secondary" onPress={demo.enter} />
        <Button
          label="Create an account"
          variant="secondary"
          onPress={() => navigation.navigate('Register')}
        />
      </View>
    </Screen>
  );
}
const styles = StyleSheet.create({
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    paddingTop: space.xl,
  },
  wordmark: { color: colors.brand, fontWeight: '500', letterSpacing: -2 },
  art: {
    backgroundColor: '#D5E5E3',
    borderRadius: 20,
    minHeight: 240,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  destination: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: 24,
  },
  hero: {
    flex: 1,
    justifyContent: 'center',
    gap: space.lg,
    paddingVertical: space.xl,
  },
  actions: { gap: space.md, paddingBottom: space.lg },
});
