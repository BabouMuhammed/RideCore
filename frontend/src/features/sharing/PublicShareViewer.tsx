import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { io } from 'socket.io-client';
import {
  createJourneyApi,
  coordinate,
  type PublicSnapshot,
} from '../../services/journey-api';
import { socketOrigin } from '../../services/realtime';
import { safeError, AppError } from '../../services/errors';
import { MapCanvas } from '../map/MapCanvas';
import { initialCenter } from '../../services/mapbox';
import { JourneySheet } from '../../components/sheets/JourneySheet';
import { Text } from '../../components/ui/Text';
import { Button } from '../../components/ui/Button';
import { statusLabels } from '../journey/presentation';
export function PublicShareViewer({ token }: { token: string }) {
  const [snapshot, setSnapshot] = useState<PublicSnapshot | null>(null),
    [error, setError] = useState<string>(),
    [ended, setEnded] = useState(false),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const abort = new AbortController(),
      api = createJourneyApi();
    let dead = false,
      fetching = false,
      expiresAt = 0;
    const socket = io(socketOrigin() + '/shared-rides', {
      autoConnect: false,
      forceNew: true,
    });
    function end() {
      dead = true;
      setEnded(true);
      setSnapshot(null);
      setError(undefined);
      socket.disconnect();
    }
    async function refresh() {
      if (dead || fetching || abort.signal.aborted) return;
      fetching = true;
      try {
        const result = await api.snapshot(token, abort.signal);
        if (!dead && !abort.signal.aborted) {
          if (Date.parse(result.sharing.expiresAt) <= Date.now()) end();
          else {
            expiresAt = Date.parse(result.sharing.expiresAt);
            setSnapshot(result);
            setError(undefined);
          }
        }
      } catch (error) {
        if (!abort.signal.aborted) {
          if (error instanceof AppError && error.kind === 'unavailable') end();
          else {
            setSnapshot(null);
            setError(safeError(error).message);
          }
        }
      } finally {
        fetching = false;
      }
    }
    socket.on('connect', () => {
      socket.timeout(10000).emit('share:join', { token }, () => {
        void refresh();
      });
      void refresh();
    });
    socket.on('share:ended', end);
    // Lifecycle hints reconcile through REST. Validated, server-authorized public
    // location broadcasts update locally without an HTTP request for every GPS tick.
    socket.on('share:ride-status', () => {
      void refresh();
    });
    socket.on(
      'share:location',
      (sample: {
        longitude?: number;
        latitude?: number;
        updatedAt?: string;
      }) => {
        if (
          dead ||
          abort.signal.aborted ||
          !expiresAt ||
          expiresAt <= Date.now() ||
          typeof sample?.updatedAt !== 'string' ||
          !Number.isFinite(Date.parse(sample.updatedAt))
        )
          return;
        try {
          const [longitude, latitude] = coordinate([
            sample.longitude,
            sample.latitude,
          ]);
          const updatedAt = sample.updatedAt;
          setSnapshot((value) =>
            value &&
            (!value.location ||
              Date.parse(updatedAt) > Date.parse(value.location.updatedAt))
              ? { ...value, location: { longitude, latitude, updatedAt } }
              : value,
          );
        } catch {
          /* Ignore malformed samples; REST polling remains authoritative. */
        }
      },
    );
    socket.on('connect_error', () => {
      void refresh();
    });
    socket.connect();
    void refresh();
    const poll = setInterval(() => {
      void refresh();
    }, 10000);
    const expiry = setInterval(() => {
      if (!dead && expiresAt && expiresAt <= Date.now()) end();
    }, 1000);
    return () => {
      dead = true;
      abort.abort();
      clearInterval(poll);
      clearInterval(expiry);
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [token, retry]);
  const pins = useMemo(
    () =>
      snapshot
        ? [
            {
              id: 'pickup',
              label: 'Pickup',
              point: [
                snapshot.trip.pickup.longitude,
                snapshot.trip.pickup.latitude,
              ] as [number, number],
            },
            {
              id: 'destination',
              label: 'Destination',
              point: [
                snapshot.trip.destination.longitude,
                snapshot.trip.destination.latitude,
              ] as [number, number],
            },
            ...(snapshot.location
              ? [
                  {
                    id: 'driver',
                    label: 'Driver',
                    point: [
                      snapshot.location.longitude,
                      snapshot.location.latitude,
                    ] as [number, number],
                  },
                ]
              : []),
          ]
        : [],
    [snapshot],
  );
  return (
    <View style={{ flex: 1, minHeight: 0 }}>
      <MapCanvas center={pins[0]?.point ?? initialCenter} pins={pins} />
      <JourneySheet>
        <Text variant="heading">RideCore · shared trip</Text>
        {ended ? (
          <>
            <Text>Sharing has ended or this link is unavailable.</Text>
            <Text>
              The link may have expired, been stopped, or the trip may have
              ended. Ask the rider for a new link if needed.
            </Text>
          </>
        ) : snapshot ? (
          <>
            <Text variant="heading">{statusLabels[snapshot.rideStatus]}</Text>
            {snapshot.driver && (
              <Text>Driver · {snapshot.driver.firstName}</Text>
            )}
            {snapshot.vehicle && (
              <Text>
                {snapshot.vehicle.color} {snapshot.vehicle.make}{' '}
                {snapshot.vehicle.model} · {snapshot.vehicle.plateNumber}
              </Text>
            )}
            <Text>Pickup · {snapshot.trip.pickup.address}</Text>
            <Text>Destination · {snapshot.trip.destination.address}</Text>
            <Text tone="secondary">
              {snapshot.location
                ? 'Last driver update: ' +
                  new Date(snapshot.location.updatedAt).toLocaleTimeString() +
                  '. Updates may be delayed.'
                : 'Driver location is not available yet.'}
            </Text>
          </>
        ) : (
          <Text>{error ?? 'Checking this shared trip…'}</Text>
        )}
        {error && (
          <Button
            label="Try again"
            onPress={() => setRetry((value) => value + 1)}
          />
        )}
        <Text variant="caption" tone="secondary">
          Read-only trip information. This page cannot change the ride or
          dispatch emergency help.
        </Text>
      </JourneySheet>
    </View>
  );
}
