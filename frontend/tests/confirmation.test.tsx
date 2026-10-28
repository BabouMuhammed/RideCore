import {
  render,
  screen,
  userEvent,
  fireEvent,
} from '@testing-library/react-native';
import * as ReactNative from 'react-native';
import { ConfirmationDialog } from '../src/components/feedback/ConfirmationDialog';

test('confirmation requires an explicit action and suppresses repeated confirmation', async () => {
  const user = userEvent.setup();
  const confirm = jest.fn();
  const cancel = jest.fn();
  await render(
    <ConfirmationDialog
      visible
      title="Discard changes?"
      description="Your changes will be lost."
      confirmLabel="Discard"
      onConfirm={confirm}
      onCancel={cancel}
      destructive
    />,
  );
  expect(confirm).not.toHaveBeenCalled();
  await user.press(screen.getByRole('button', { name: 'Discard' }));
  await user.press(screen.getByRole('button', { name: 'Discard' }));
  expect(confirm).toHaveBeenCalledTimes(1);
});
test('go back cancels without performing the destructive action', async () => {
  const user = userEvent.setup();
  const confirm = jest.fn();
  const cancel = jest.fn();
  await render(
    <ConfirmationDialog
      visible
      title="Discard changes?"
      description="Your changes will be lost."
      confirmLabel="Discard"
      onConfirm={confirm}
      onCancel={cancel}
    />,
  );
  await user.press(screen.getByRole('button', { name: 'Go back' }));
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(confirm).not.toHaveBeenCalled();
});
test('pending confirmation prevents dismissal and resubmission', async () => {
  const confirm = jest.fn();
  const cancel = jest.fn();
  await render(
    <ConfirmationDialog
      visible
      pending
      title="Discard changes?"
      description="Please wait."
      confirmLabel="Discard"
      onConfirm={confirm}
      onCancel={cancel}
    />,
  );
  expect(screen.getByRole('button', { name: 'Discard' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Go back' })).toBeDisabled();
});
test('web modal focus never calls the unsupported native findNodeHandle API', async () => {
  const platform = Object.getOwnPropertyDescriptor(ReactNative.Platform, 'OS')!;
  const nativeHandle = jest
    .spyOn(ReactNative, 'findNodeHandle')
    .mockImplementation(() => {
      throw new Error('Unsupported on web');
    });
  try {
    Object.defineProperty(ReactNative.Platform, 'OS', {
      configurable: true,
      value: 'web',
    });
    await render(
      <ConfirmationDialog
        visible
        title="Sign out?"
        description="An active ride continues."
        confirmLabel="Sign out"
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    await fireEvent(screen.getByTestId('confirmation-dialog'), 'show');
    expect(nativeHandle).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeOnTheScreen();
  } finally {
    Object.defineProperty(ReactNative.Platform, 'OS', platform);
    nativeHandle.mockRestore();
  }
});
