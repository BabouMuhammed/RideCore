import { useState } from 'react';
import { Text } from '../../components/ui/Text';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { ListRow } from '../../components/ui/ListRow';
import { useJourney } from './JourneyProvider';
import { cancellationReasons } from './presentation';
import { safeError } from '../../services/errors';
export function Cancellation({ onClose }: { onClose(): void }) {
  const { controller, state } = useJourney();
  const [reason, setReason] = useState(''),
    [other, setOther] = useState(''),
    [confirm, setConfirm] = useState(false),
    [error, setError] = useState<string>();
  async function cancel() {
    try {
      await controller.cancel(
        reason === 'Other'
          ? other.trim()
            ? 'Other: ' + other.trim()
            : 'Other'
          : reason,
      );
      onClose();
    } catch (error) {
      setError(safeError(error).message);
    }
  }
  return (
    <>
      <Text variant="heading">
        {confirm ? 'Cancel this ride?' : 'Why are you cancelling?'}
      </Text>
      {confirm ? (
        <>
          <Text>
            You may wait longer if you request another ride. RideCore does not
            charge cancellation fees.
          </Text>
          <Button label="Keep my ride" onPress={onClose} />
          <Button
            label="Confirm cancellation"
            variant="destructive"
            loading={state.busy}
            onPress={() => void cancel()}
          />
          <Button
            label="Change reason"
            variant="secondary"
            disabled={state.busy}
            onPress={() => setConfirm(false)}
          />
        </>
      ) : (
        <>
          {cancellationReasons.map((item) => (
            <ListRow
              key={item}
              title={(reason === item ? '✓ ' : '') + item}
              onPress={() => setReason(item)}
            />
          ))}
          {reason === 'Other' && (
            <Input
              label="Explanation (optional)"
              value={other}
              onChangeText={setOther}
              maxLength={490}
              multiline
            />
          )}
          <Button
            label="Continue"
            disabled={!reason}
            onPress={() => setConfirm(true)}
          />
          <Button label="Keep my ride" variant="secondary" onPress={onClose} />
        </>
      )}
      {error && <Text tone="error">{error}</Text>}
    </>
  );
}
