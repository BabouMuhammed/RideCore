import { useState } from 'react';
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
      <Text variant="heading">Your RideCore account</Text>
      {state.stage === 'ready' && (
        <>
          <ListRow title={state.user.firstName + ' ' + state.user.lastName} />
          <ListRow title="Email" subtitle={state.user.email} />
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
