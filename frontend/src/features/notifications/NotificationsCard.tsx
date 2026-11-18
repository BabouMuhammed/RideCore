import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { Text } from '../../components/ui/Text';
import { colors, radius, space } from '../../theme/tokens';
import { useSession } from '../session/SessionProvider';
import {
  enablePush,
  pushState,
  syncPush,
  type PushState,
} from '../../services/push';

// Invites the person to turn on lock-screen notifications, once. When
// they're already on, it quietly links this device to the account.
export function NotificationsCard({ role }: { role: 'rider' | 'driver' }) {
  const { session } = useSession();
  const [state, setState] = useState<PushState>(() => pushState());
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (state === 'granted')
      void session.run((token) => syncPush(token)).catch(() => undefined);
  }, [state, session]);
  if (state === 'needs-install')
    return (
      <View style={styles.card}>
        <Icon name="bell" size={20} color={colors.brand} />
        <Text variant="caption" style={{ flex: 1 }}>
          To get alerts on your iPhone, add RideCore to your Home Screen (Share
          › Add to Home Screen) and open it from there.
        </Text>
      </View>
    );
  if (state !== 'default') return null;
  return (
    <View style={styles.card}>
      <Icon name="bell" size={20} color={colors.brand} />
      <View style={{ flex: 1, gap: space.sm }}>
        <Text variant="label">
          {role === 'rider'
            ? 'Know the moment your driver arrives'
            : 'Hear about ride requests straight away'}
        </Text>
        <Text variant="caption" tone="secondary">
          {role === 'rider'
            ? 'Get an alert when a driver accepts and when they reach you, even if RideCore isn’t open.'
            : 'Get an alert for each new request nearby, even if RideCore isn’t open.'}
        </Text>
        <Button
          label="Turn on notifications"
          variant="secondary"
          disabled={busy}
          onPress={() => {
            setBusy(true);
            void session
              .run((token) => enablePush(token))
              .then(setState)
              .catch(() => setState(pushState()))
              .finally(() => setBusy(false));
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.brandSoft,
  },
});
