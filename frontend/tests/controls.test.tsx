import { render, screen, userEvent } from '@testing-library/react-native';
import { Button } from '../src/components/ui/Button';
import { Input } from '../src/components/ui/Input';
import { StateMessage } from '../src/components/ui/StateMessage';
import { IconButton } from '../src/components/ui/IconButton';
import { ListRow } from '../src/components/ui/ListRow';

test('a labelled button invokes its action', async () => {
  const user = userEvent.setup();
  const action = jest.fn();
  await render(<Button label="Continue" onPress={action} />);
  await user.press(screen.getByRole('button', { name: 'Continue' }));
  expect(action).toHaveBeenCalledTimes(1);
});
test.each([true, false])(
  'unavailable buttons block actions (loading=%s)',
  async (loading) => {
    const user = userEvent.setup();
    const action = jest.fn();
    await render(
      <Button
        label="Continue"
        loading={loading}
        disabled={!loading}
        onPress={action}
      />,
    );
    const button = screen.getByRole('button', { name: 'Continue' });
    expect(button).toBeDisabled();
    await user.press(button);
    expect(action).not.toHaveBeenCalled();
  },
);
test('inputs expose their label and validation message and preserve editing', async () => {
  const user = userEvent.setup();
  const change = jest.fn();
  await render(
    <Input
      label="Email"
      error="Enter a valid email"
      onChangeText={change}
      autoCapitalize="none"
    />,
  );
  const input = screen.getByLabelText('Email');
  expect(input).toHaveProp('accessibilityHint', 'Enter a valid email');
  await user.type(input, 'rider@example.test');
  expect(change).toHaveBeenCalledWith('rider@example.test');
  expect(screen.getByText('Enter a valid email')).toBeOnTheScreen();
});
test('error recovery action is available without fabricating a successful state', async () => {
  const user = userEvent.setup();
  const retry = jest.fn();
  await render(
    <StateMessage
      kind="error"
      title="Unable to connect"
      description="Try again when connected."
      action={{ label: 'Retry', onPress: retry }}
    />,
  );
  await user.press(screen.getByRole('button', { name: 'Retry' }));
  expect(retry).toHaveBeenCalledTimes(1);
  expect(screen.getByText('Unable to connect')).toBeOnTheScreen();
});
test('icon-only controls expose their purpose', async () => {
  const user = userEvent.setup();
  const close = jest.fn();
  await render(<IconButton icon="close" label="Close" onPress={close} />);
  await user.press(screen.getByRole('button', { name: 'Close' }));
  expect(close).toHaveBeenCalledTimes(1);
});
test('informational rows do not claim to be actionable', async () => {
  await render(<ListRow title="Payment" subtitle="Not configured" />);
  expect(screen.queryByRole('button')).not.toBeOnTheScreen();
  expect(screen.getByText('Not configured')).toBeOnTheScreen();
});
