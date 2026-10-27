import { Screen } from '../../components/layout/Screen';
import { BrandMark } from '../../components/brand/BrandMark';
import { Loading } from '../../components/ui/Loading';
import { StateMessage } from '../../components/ui/StateMessage';
import { Button } from '../../components/ui/Button';
import { useSession } from './SessionProvider';
export function BootstrapScreen() {
  const { state, session } = useSession();
  if (state.stage === 'rejected')
    return (
      <Screen>
        <BrandMark />
        <StateMessage
          kind="error"
          title="Rider account required"
          description={state.error.message}
          action={{
            label: 'Return to sign in',
            onPress: () => void session.logout(),
          }}
        />
      </Screen>
    );
  if (state.stage === 'recovery')
    return (
      <Screen>
        <BrandMark />
        <StateMessage
          kind="error"
          title={
            state.step === 'rides'
              ? 'Unable to restore your ride information'
              : state.step === 'logout'
                ? 'Sign-out needs another attempt'
                : 'Unable to restore your sign-in'
          }
          description={state.error.message}
          action={{ label: 'Try again', onPress: () => void session.retry() }}
        />
        {state.step !== 'logout' && (
          <Button
            label="Sign out on this device"
            variant="secondary"
            onPress={() => void session.logout()}
          />
        )}
      </Screen>
    );
  return (
    <Screen>
      <BrandMark />
      <Loading label="Getting RideCore ready" />
    </Screen>
  );
}
