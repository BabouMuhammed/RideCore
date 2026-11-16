import { useState } from 'react';
import { View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParams } from '../../../navigation/types';
import { Screen } from '../../../components/layout/Screen';
import { BrandHeader } from '../../../components/layout/BrandHeader';
import { Text } from '../../../components/ui/Text';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import {
  acceptableApiUrl,
  apiUrl,
  checkServer,
  expandServerInput,
  serverOverride,
  setServerOverride,
} from '../../../services/server-config';
import { colors, radius, space } from '../../../theme/tokens';

// Demo builds only: point the phone at the laptop running the backend.
export function ServerSettingsScreen({
  navigation,
}: NativeStackScreenProps<AuthStackParams, 'ServerSettings'>) {
  const [value, setValue] = useState(
    (serverOverride() ?? apiUrl() ?? '').replace(/^http:\/\//, ''),
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();

  async function save() {
    const url = acceptableApiUrl(expandServerInput(value));
    if (!url) {
      setMessage({
        ok: false,
        text: 'Enter the laptop’s local address, like 192.168.1.20. Public addresses need https://.',
      });
      return;
    }
    setBusy(true);
    setMessage(undefined);
    const reachable = await checkServer(url);
    if (!reachable) {
      setBusy(false);
      setMessage({
        ok: false,
        text: `Couldn’t reach RideCore at ${url}. Check the phone and laptop are on the same Wi-Fi, the backend is running, and the firewall allows port 5050.`,
      });
      return;
    }
    // Saving restarts the app's services on the new server.
    await setServerOverride(url);
  }

  return (
    <Screen
      header={
        <BrandHeader
          title="Server *address*"
          subtitle="Connect this phone to the laptop running the RideCore backend."
          onBack={() => navigation.goBack()}
          backDisabled={busy}
        />
      }
    >
      <Input
        label="Laptop address"
        value={value}
        onChangeText={setValue}
        placeholder="192.168.1.20"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        editable={!busy}
        hint="Find it on the laptop with ipconfig (IPv4 Address). Port 5050 and /api are added for you."
        onSubmitEditing={() => void save()}
      />
      {message && (
        <View
          style={{
            padding: space.lg,
            borderRadius: radius.md,
            backgroundColor: message.ok ? colors.brandSoft : colors.errorSoft,
          }}
        >
          <Text tone={message.ok ? 'primary' : 'error'} accessibilityLiveRegion="polite">
            {message.text}
          </Text>
        </View>
      )}
      <Button label="Check and save" loading={busy} onPress={() => void save()} />
      {serverOverride() && (
        <Button
          label="Use the built-in server"
          variant="secondary"
          disabled={busy}
          onPress={() => void setServerOverride(null)}
        />
      )}
      <Text variant="caption" tone="secondary">
        Using now: {apiUrl() ?? 'not set'}
      </Text>
    </Screen>
  );
}
