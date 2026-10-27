import { useRef, useState, type ComponentRef } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParams } from '../../../navigation/types';
import { Screen } from '../../../components/layout/Screen';
import { Text } from '../../../components/ui/Text';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { IconButton } from '../../../components/ui/IconButton';
import { PhoneInput, PasswordInput } from '../components/AuthFields';
import { useSession } from '../../session/SessionProvider';
import { FormError, loginPayload } from '../validation';
import { safeError } from '../../../services/errors';
import { colors, radius, size, space } from '../../../theme/tokens';
export function SignInScreen({
  navigation,
  route,
}: NativeStackScreenProps<AuthStackParams, 'SignIn'>) {
  const { session } = useSession();
  const [mode, setMode] = useState<'email' | 'phone'>('email');
  const [identifier, setIdentifier] = useState(route.params?.email ?? '');
  const [password, setPassword] = useState('');
  const [failure, setFailure] = useState<{ field?: string; message: string }>();
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);
  async function submit() {
    if (submitting.current) return;
    setFailure(undefined);
    try {
      const payload = loginPayload(mode, identifier, password);
      submitting.current = true;
      setBusy(true);
      await session.signIn(payload);
      setPassword('');
    } catch (error) {
      if (error instanceof FormError)
        setFailure({ field: error.field, message: error.message });
      else if (safeError(error).kind !== 'cancelled')
        setFailure({ message: safeError(error).message });
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <Screen>
      <IconButton
        icon="back"
        label="Go back"
        onPress={() => navigation.goBack()}
        disabled={busy}
      />
      <Text variant="title" accessibilityRole="header">
        Sign in
      </Text>
      <Text tone="secondary">Welcome back to RideCore.</Text>
      {route.params?.created && (
        <Text accessibilityLiveRegion="polite">
          Account created. Sign in to continue.
        </Text>
      )}
      <View
        style={styles.modes}
        accessibilityRole="radiogroup"
        accessibilityLabel="Sign-in method"
      >
        {(['email', 'phone'] as const).map((option) => (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityState={{ checked: mode === option, disabled: busy }}
            accessibilityLabel={
              option === 'email' ? 'Use email' : 'Use phone number'
            }
            disabled={busy}
            onPress={() => {
              setMode(option);
              setIdentifier('');
              setFailure(undefined);
            }}
            style={[styles.mode, mode === option && styles.selected]}
          >
            <Text
              variant="label"
              style={mode === option && { color: colors.brand }}
            >
              {option === 'email' ? 'Email' : 'Phone'}
            </Text>
          </Pressable>
        ))}
      </View>
      {mode === 'email' ? (
        <Input
          label="Email"
          value={identifier}
          onChangeText={setIdentifier}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!busy}
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          error={failure?.field === 'email' ? failure.message : undefined}
        />
      ) : (
        <PhoneInput
          value={identifier}
          onChangeText={setIdentifier}
          editable={!busy}
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          error={failure?.field === 'phone' ? failure.message : undefined}
        />
      )}
      <PasswordInput
        value={password}
        onChangeText={setPassword}
        inputRef={passwordRef}
        editable={!busy}
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={() => void submit()}
        error={failure?.field === 'password' ? failure.message : undefined}
      />
      {failure && !failure.field && (
        <Text tone="error" accessibilityLiveRegion="polite">
          {failure.message}
        </Text>
      )}
      <Button label="Sign in" loading={busy} onPress={() => void submit()} />
      <Button
        label="Create an account"
        variant="secondary"
        disabled={busy}
        onPress={() => navigation.navigate('Register')}
      />
    </Screen>
  );
}
const styles = StyleSheet.create({
  modes: { flexDirection: 'row', gap: space.sm },
  mode: {
    flex: 1,
    minHeight: size.touch,
    padding: space.md,
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.neutral,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selected: { backgroundColor: colors.brandSoft, borderColor: colors.brand },
});
