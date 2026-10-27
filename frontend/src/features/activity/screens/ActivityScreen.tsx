import { Screen } from '../../../components/layout/Screen';
import { Text } from '../../../components/ui/Text';
import { StateMessage } from '../../../components/ui/StateMessage';
export function ActivityScreen() {
  return (
    <Screen edges={['top', 'left', 'right']}>
      <Text variant="title" accessibilityRole="header">
        Activity
      </Text>
      <StateMessage
        icon="activity"
        title="Your rides, in one place"
        description="Ride history is not available yet."
      />
    </Screen>
  );
}
