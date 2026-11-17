import { useRef, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParams } from '../../../navigation/types';
import { Screen } from '../../../components/layout/Screen';
import { BrandHeader } from '../../../components/layout/BrandHeader';
import { Input } from '../../../components/ui/Input';
import { Text } from '../../../components/ui/Text';
import { Button } from '../../../components/ui/Button';
import { PasswordInput } from '../components/AuthFields';
import { FormError, loginPayload } from '../validation';
import { safeError } from '../../../services/errors';
import { useSession } from '../../session/SessionProvider';

export function AdminSignInScreen({
  navigation,
}: NativeStackScreenProps<AuthStackParams, 'AdminSignIn'>) {
  const { session } = useSession();
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState('');
  const [error, setError] = useState<string>(),
    [busy, setBusy] = useState(false);
  const lock = useRef(false);
  async function submit() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await session.signIn(loginPayload('email', email, password), 'admin');
      setPassword('');
    } catch (failure) {
      if (failure instanceof FormError) setError(failure.message);
      else if (safeError(failure).kind !== 'cancelled')
        setError(safeError(failure).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <Screen
      header={
        <BrandHeader
          title="Administrator sign in"
          subtitle="Manage applications, accounts and trips."
          onBack={() => navigation.goBack()}
          backDisabled={busy}
        />
      }
    >
      <Input
        label="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoComplete="email"
        autoCapitalize="none"
        autoCorrect={false}
        editable={!busy}
      />
      <PasswordInput
        value={password}
        onChangeText={setPassword}
        editable={!busy}
        autoComplete="current-password"
        returnKeyType="go"
        onSubmitEditing={() => void submit()}
      />
      {error && (
        <Text tone="error" accessibilityLiveRegion="polite">
          {error}
        </Text>
      )}
      <Button
        label="Sign in as administrator"
        loading={busy}
        onPress={() => void submit()}
      />
      <Text variant="caption" tone="secondary">
        Administrator access is provided by RideCore. Public registration is for
        riders and drivers.
      </Text>
    </Screen>
  );
}
