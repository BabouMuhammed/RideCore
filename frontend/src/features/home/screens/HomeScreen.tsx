import { useSession } from '../../session/SessionProvider';
import { Screen } from '../../../components/layout/Screen';
import { Text } from '../../../components/ui/Text';
import { StateMessage } from '../../../components/ui/StateMessage';
export function HomeScreen() {
  const { state } = useSession();
  return (
    <Screen edges={['top', 'left', 'right']}>
      <Text variant="title" accessibilityRole="header">
        RideCore
      </Text>
      {state.stage === 'ready' && state.activeRide && (
        <Text accessibilityLiveRegion="polite">
          Your active ride has been restored. Live trip screens will be
          available in a later update.
        </Text>
      )}
      <StateMessage
        title="Your journey starts here"
        description="Ride booking will be available in a future update."
      />
    </Screen>
  );
}
