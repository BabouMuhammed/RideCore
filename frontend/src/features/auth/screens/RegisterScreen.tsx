import { useRef, useState, type ComponentRef } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParams } from '../../../navigation/types';
import { Screen } from '../../../components/layout/Screen';
import { Text } from '../../../components/ui/Text';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { BrandHeader } from '../../../components/layout/BrandHeader';
import { PhoneInput, PasswordInput } from '../components/AuthFields';
import { useSession } from '../../session/SessionProvider';
import { FormError, registrationPayload } from '../validation';
import { safeError } from '../../../services/errors';
import { colors, radius, space } from '../../../theme/tokens';
export function RegisterScreen({
  navigation,
}: NativeStackScreenProps<AuthStackParams, 'Register'>) {
  const { session } = useSession();
  const [role, setRole] = useState<'rider' | 'driver'>('rider');
  const [fields, setFields] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
  });
  const [failure, setFailure] = useState<{ field?: string; message: string }>();
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(false);
  const submitting = useRef(false);
  const lastRef = useRef<ComponentRef<typeof TextInput>>(null);
  const emailRef = useRef<ComponentRef<typeof TextInput>>(null);
  const phoneRef = useRef<ComponentRef<typeof TextInput>>(null);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);
  function change(key: keyof typeof fields) {
    return (value: string) =>
      setFields((current) => ({ ...current, [key]: value }));
  }
  function error(key: string) {
    return failure?.field === key ? failure.message : undefined;
  }
  async function submit() {
    if (submitting.current) return;
    setFailure(undefined);
    try {
      const payload = registrationPayload({ ...fields, role });
      submitting.current = true;
      setBusy(true);
      await session.api.register(payload);
      setFields((current) => ({ ...current, password: '' }));
      setCreated(true);
    } catch (error) {
      setFailure(
        error instanceof FormError
          ? { field: error.field, message: error.message }
          : { message: safeError(error).message },
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  if (created)
    return (
      <Screen>
        <Text variant="title" accessibilityRole="header">
          Account created
        </Text>
        <Text>
          Your Rider account is ready. Sign in with your email or phone number
          and password.
        </Text>
        <Button
          label="Continue to sign in"
          onPress={() =>
            navigation.replace('SignIn', {
              created: true,
              email: fields.email.trim().toLowerCase(),
            })
          }
        />
      </Screen>
    );
  return (
    <Screen
      header={
        <BrandHeader
          title="Create an account"
          subtitle="Your next journey starts with RideCore."
          onBack={() => navigation.goBack()}
          backDisabled={busy}
        />
      }
    >
      <View
        style={styles.roles}
        accessibilityRole="radiogroup"
        accessibilityLabel="I want to"
      >
        {(
          [
            ['rider', 'Ride', 'Book trips around town'],
            ['driver', 'Drive', 'Earn by giving rides'],
          ] as const
        ).map(([value, label, detail]) => {
          const checked = role === value;
          return (
            <Pressable
              key={value}
              accessibilityRole="radio"
              accessibilityLabel={`${label}: ${detail}`}
              accessibilityState={{ checked, disabled: busy }}
              disabled={busy}
              onPress={() => setRole(value)}
              style={[styles.role, checked && styles.roleOn]}
            >
              <Text variant="heading" style={checked && { color: colors.brand }}>
                {label}
              </Text>
              <Text variant="caption" tone="secondary">
                {detail}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Input
        label="First name"
        value={fields.firstName}
        onChangeText={change('firstName')}
        autoComplete="given-name"
        textContentType="givenName"
        autoCapitalize="words"
        editable={!busy}
        returnKeyType="next"
        onSubmitEditing={() => lastRef.current?.focus()}
        error={error('firstName')}
      />
      <Input
        label="Last name"
        value={fields.lastName}
        onChangeText={change('lastName')}
        inputRef={lastRef}
        autoComplete="family-name"
        textContentType="familyName"
        autoCapitalize="words"
        editable={!busy}
        returnKeyType="next"
        onSubmitEditing={() => emailRef.current?.focus()}
        error={error('lastName')}
      />
      <Input
        label="Email"
        value={fields.email}
        onChangeText={change('email')}
        inputRef={emailRef}
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
        autoCapitalize="none"
        autoCorrect={false}
        editable={!busy}
        returnKeyType="next"
        onSubmitEditing={() => phoneRef.current?.focus()}
        error={error('email')}
      />
      <PhoneInput
        value={fields.phone}
        onChangeText={change('phone')}
        inputRef={phoneRef}
        editable={!busy}
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        error={error('phone')}
      />
      <PasswordInput
        value={fields.password}
        onChangeText={change('password')}
        inputRef={passwordRef}
        autoComplete="new-password"
        textContentType="newPassword"
        editable={!busy}
        returnKeyType="done"
        onSubmitEditing={() => void submit()}
        hint="Use at least 8 characters."
        error={error('password')}
      />
      {failure && !failure.field && (
        <Text tone="error" accessibilityLiveRegion="polite">
          {failure.message}
        </Text>
      )}
      <Button
        label="Create account"
        loading={busy}
        onPress={() => void submit()}
      />
    </Screen>
  );
}
const styles = StyleSheet.create({
  roles: { flexDirection: 'row', gap: space.md },
  role: {
    flex: 1,
    gap: 2,
    padding: space.lg,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
  },
  roleOn: { borderColor: colors.brand, backgroundColor: colors.brandSoft },
});
