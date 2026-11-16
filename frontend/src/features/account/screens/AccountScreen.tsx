import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon } from '../../../components/ui/Icon';
import { colors, radius } from '../../../theme/tokens';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import type { RiderStackParams } from '../../../navigation/types';
import { Screen } from '../../../components/layout/Screen';
import { Text } from '../../../components/ui/Text';
import { Button } from '../../../components/ui/Button';
import { ListRow } from '../../../components/ui/ListRow';
import { ConfirmationDialog } from '../../../components/feedback/ConfirmationDialog';
import { useSession } from '../../session/SessionProvider';
import { maskGambianPhone } from '../../auth/phone';
export function AccountScreen() {
  const { state, session } = useSession();
  const navigation = useNavigation<NavigationProp<RiderStackParams>>();
  const [confirm, setConfirm] = useState(false);
  return (
    <Screen edges={['top', 'left', 'right']}>
      <Text variant="title" accessibilityRole="header">
        Account
      </Text>
      {state.stage === 'ready' && (
        <>
          <View style={styles.profile}>
            <View style={{ flex: 1, gap: 8 }}>
              <Text variant="title">
                {state.user.firstName + ' ' + state.user.lastName}
              </Text>
              <Text tone="secondary">Your RideCore account</Text>
            </View>
            <View style={styles.avatar}>
              <Icon name="account" size={40} />
            </View>
          </View>
          <View style={styles.security}>
            <Icon name="shield" size={32} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text variant="label">Your account, at a glance</Text>
              <Text variant="caption" tone="secondary">
                Keep your details up to date for a smoother ride.
              </Text>
            </View>
          </View>
          <Text variant="heading">Account details</Text>
          <ListRow icon="mail" title="Email" subtitle={state.user.email} />
          <ListRow
            title="Phone"
            subtitle={maskGambianPhone(state.user.phone)}
          />
          <ListRow
            title={
              state.user.phoneVerifiedAt
                ? 'Phone verified'
                : 'Verify phone number'
            }
            subtitle="Optional phone verification"
            onPress={() => navigation.navigate('PhoneVerification')}
          />
          <Button
            label="Sign out on this device"
            variant="secondary"
            onPress={() => setConfirm(true)}
          />
          <ConfirmationDialog
            visible={confirm}
            title="Sign out on this device?"
            description="Your saved sign-in and private information will be removed from this device. An active ride will continue."
            confirmLabel="Sign out"
            onConfirm={() => {
              setConfirm(false);
              void session.logout();
            }}
            onCancel={() => setConfirm(false)}
          />
        </>
      )}
    </Screen>
  );
}
const styles = StyleSheet.create({
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingBottom: 12,
  },
  avatar: {
    width: 76,
    height: 76,
    backgroundColor: colors.neutral,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  security: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
    backgroundColor: colors.neutral,
    borderRadius: radius.lg,
    padding: 20,
    marginVertical: 8,
  },
});
