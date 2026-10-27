import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RiderStackParams } from '../../../navigation/types';
import { Screen } from '../../../components/layout/Screen';
import { Text } from '../../../components/ui/Text';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { IconButton } from '../../../components/ui/IconButton';
import { useSession } from '../../session/SessionProvider';
import { maskGambianPhone } from '../phone';
import { safeError } from '../../../services/errors';
import type { OtpReply } from '../../../services/contracts';
// A conservative local resend guard, not a claim about configurable server settings.
// The server remains authoritative and may impose a longer cooldown/rate limit.
export const localResendGuardSeconds = 60;
export function PhoneVerificationScreen({
  navigation,
}: NativeStackScreenProps<RiderStackParams, 'PhoneVerification'>) {
  const { state, session } = useSession();
  const [challenge, setChallenge] = useState<
    OtpReply & { expiresAt: number }
  >();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const working = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    const subscription = AppState.addEventListener('change', () =>
      setNow(Date.now()),
    );
    return () => {
      mounted.current = false;
      clearInterval(timer);
      subscription.remove();
    };
  }, []);
  const verified = state.stage === 'ready' && !!state.user.phoneVerifiedAt;
  const expired = !!challenge && now >= challenge.expiresAt;
  async function requestCode() {
    if (working.current || Date.now() < resendAt) return;
    working.current = true;
    setBusy(true);
    setMessage(undefined);
    try {
      const requestedAt = Date.now();
      const result = await session.requestOtp();
      if (mounted.current) {
        const time = Date.now();
        setChallenge({
          ...result,
          expiresAt: requestedAt + result.expiresInSeconds * 1000,
        });
        setResendAt(time + localResendGuardSeconds * 1000);
        setNow(time);
        setCode('');
      }
    } catch (error) {
      if (mounted.current) {
        const failure = safeError(error);
        setMessage(failure.message);
        if (failure.kind === 'cooldown' || failure.kind === 'rate')
          setResendAt(
            Date.now() +
              (failure.retryAfterSeconds ?? localResendGuardSeconds) * 1000,
          );
      }
    } finally {
      working.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function verify() {
    if (working.current) return;
    if (!/^\d{6}$/.test(code)) {
      setMessage('Enter the six-digit verification code.');
      return;
    }
    if (!challenge || Date.now() >= challenge.expiresAt) {
      setMessage('This code has expired. Request a new code when available.');
      return;
    }
    working.current = true;
    setBusy(true);
    setMessage(undefined);
    try {
      await session.verifyOtp(code);
      if (mounted.current) {
        setCode('');
        setChallenge(undefined);
      }
    } catch (error) {
      if (mounted.current) setMessage(safeError(error).message);
    } finally {
      working.current = false;
      if (mounted.current) setBusy(false);
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
        {verified ? 'Phone verified' : 'Verify your phone'}
      </Text>
      {verified ? (
        <Text>Your registered phone number has been verified.</Text>
      ) : (
        <>
          <Text tone="secondary">
            {state.stage === 'ready'
              ? maskGambianPhone(state.user.phone)
              : 'Your registered phone number'}
          </Text>
          <Text>
            Phone verification currently uses simulated delivery. No SMS is
            sent. Verification is optional.
          </Text>
          {challenge && (
            <>
              {challenge.mockCode ? (
                <Text
                  accessibilityLabel={
                    'Simulated verification code ' + challenge.mockCode
                  }
                >
                  Use this simulated code: {challenge.mockCode}
                </Text>
              ) : (
                <Text>
                  No simulated code is available from the service. You can
                  continue using your account without verification.
                </Text>
              )}
              <Text
                tone={expired ? 'error' : 'secondary'}
                accessibilityLiveRegion="polite"
              >
                {expired
                  ? 'This code has expired.'
                  : 'Code expires in ' +
                    Math.max(0, Math.ceil((challenge.expiresAt - now) / 1000)) +
                    ' seconds.'}
              </Text>
              <Input
                label="Verification code"
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                autoComplete="off"
                editable={!busy && !expired}
                maxLength={6}
                returnKeyType="done"
                onSubmitEditing={() => void verify()}
              />
              <Button
                label="Verify phone"
                disabled={busy || expired}
                onPress={() => void verify()}
              />
            </>
          )}
          {message && (
            <Text tone="error" accessibilityLiveRegion="polite">
              {message}
            </Text>
          )}
          <Button
            label={
              challenge ? 'Request another code' : 'Request verification code'
            }
            loading={busy}
            disabled={now < resendAt}
            onPress={() => void requestCode()}
          />
          {now < resendAt && (
            <Text tone="secondary">
              Please wait before requesting another code. The service may apply
              a longer limit.
            </Text>
          )}
        </>
      )}
    </Screen>
  );
}
