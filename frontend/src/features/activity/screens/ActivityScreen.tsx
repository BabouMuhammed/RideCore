import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Screen } from '../../../components/layout/Screen';
import { Text } from '../../../components/ui/Text';
import { Button } from '../../../components/ui/Button';
import { ListRow } from '../../../components/ui/ListRow';
import { useJourney } from '../../journey/JourneyProvider';
import { useSession } from '../../session/SessionProvider';
import { money, statusLabels } from '../../journey/presentation';
import type { Trip } from '../../../services/journey-api';
import { safeError } from '../../../services/errors';
import { Receipt } from '../../receipt/Receipt';
export function ActivityScreen() {
  const { state } = useSession();
  return state.stage === 'ready' ? <Activity /> : null;
}
function Activity() {
  const { controller, state } = useJourney();
  const [selected, setSelected] = useState<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      void controller.refresh();
    }, [controller]),
  );
  return (
    <Screen edges={['top', 'left', 'right']}>
      <Text variant="title" accessibilityRole="header">
        Activity
      </Text>
      {selected ? (
        <RideDetail
          key={selected}
          id={selected}
          onBack={() => {
            setSelected(null);
            void controller.refresh();
          }}
        />
      ) : (
        <>
          <Text tone="secondary">
            Your recent rides, as recorded by RideCore.
          </Text>
          {state.loading && <Text>Loading rides…</Text>}
          {!state.loading && !state.history.length && !state.error && (
            <Text>
              You haven’t requested a ride yet. Start a journey from Home.
            </Text>
          )}
          {state.history.map((trip) => (
            <ListRow
              key={trip._id}
              title={trip.destination.address}
              subtitle={`${statusLabels[trip.status]} · ${money(trip.finalFare ?? trip.estimatedFare, trip.currency)} · ${new Date(trip.requestedAt).toLocaleDateString()}`}
              onPress={() => setSelected(trip._id)}
            />
          ))}
          <Text variant="caption" tone="secondary">
            Showing the latest rides available from your account, up to 50.
          </Text>
          {state.error && <Text tone="error">{state.error.message}</Text>}
          <Button
            label="Refresh history"
            variant="secondary"
            onPress={() => void controller.refresh()}
          />
        </>
      )}
    </Screen>
  );
}
function RideDetail({ id, onBack }: { id: string; onBack(): void }) {
  const { controller } = useJourney();
  const [trip, setTrip] = useState<Trip | null>(null),
    [error, setError] = useState<string>(),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let alive = true;
    void controller
      .run((token, signal) => controller.api.detail(token, id, signal))
      .then((value) => {
        if (alive) {
          setTrip(value);
          setError(undefined);
        }
      })
      .catch((error) => {
        if (alive) setError(safeError(error).message);
      });
    return () => {
      alive = false;
    };
  }, [controller, id, retry]);
  return (
    <>
      <Button label="Back to history" variant="secondary" onPress={onBack} />
      {!trip && !error && <Text>Loading trip…</Text>}
      {trip && (
        <>
          <Text variant="heading">{statusLabels[trip.status]}</Text>
          <ListRow title="Pickup" subtitle={trip.pickup.address} />
          <ListRow title="Destination" subtitle={trip.destination.address} />
          <Text>
            {trip.vehicleType.toUpperCase()} ·{' '}
            {money(trip.finalFare ?? trip.estimatedFare, trip.currency)}
          </Text>
          {trip.driverDetails && (
            <Text>Driver · {trip.driverDetails.firstName}</Text>
          )}
          {trip.vehicle && (
            <Text>
              {trip.vehicle.make} {trip.vehicle.model} ·{' '}
              {trip.vehicle.plateNumber}
            </Text>
          )}
          {trip.status === 'completed' && (
            <Receipt
              key={trip._id}
              trip={trip}
              onUpdated={() => setRetry((value) => value + 1)}
            />
          )}
        </>
      )}
      {error && (
        <>
          <Text tone="error">{error}</Text>
          <Button
            label="Reload trip"
            onPress={() => setRetry((value) => value + 1)}
          />
        </>
      )}
    </>
  );
}
