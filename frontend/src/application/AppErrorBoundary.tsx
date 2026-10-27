import { Component, type PropsWithChildren } from 'react';
import { Screen } from '../components/layout/Screen';
import { StateMessage } from '../components/ui/StateMessage';
export class AppErrorBoundary extends Component<
  PropsWithChildren,
  { failed: boolean }
> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    if (this.state.failed)
      return (
        <Screen>
          <StateMessage
            kind="error"
            title="Something went wrong"
            description="Please try opening RideCore again."
            action={{
              label: 'Try again',
              onPress: () => this.setState({ failed: false }),
            }}
          />
        </Screen>
      );
    return this.props.children;
  }
}
