import { render, screen, userEvent } from '@testing-library/react-native';
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
