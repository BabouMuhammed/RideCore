import { useSession } from '../../session/SessionProvider';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParams } from '../../../navigation/types';
import { Screen } from '../../../components/layout/Screen';
import { BrandMark } from '../../../components/brand/BrandMark';
import { Text } from '../../../components/ui/Text';
import { Button } from '../../../components/ui/Button';
import { colors, space } from '../../../theme/tokens';
export function WelcomeScreen({
  navigation,
}: NativeStackScreenProps<AuthStackParams, 'Welcome'>) {
  const { state } = useSession();
  return (
    <Screen>
      <View style={styles.brand}>
        <BrandMark />
        <Text variant="heading" style={styles.wordmark}>
          RideCore
        </Text>
      </View>
      <View style={styles.hero}>
        <Text variant="display" accessibilityRole="header">
          Your journey.{'\n'}Your way.
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
  wordmark: { color: colors.brand },
  hero: {
    flex: 1,
    justifyContent: 'center',
    gap: space.lg,
    paddingVertical: space.hero,
  },
  actions: { gap: space.md, paddingBottom: space.lg },
});
