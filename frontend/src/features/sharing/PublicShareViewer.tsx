import { useEffect, useMemo, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { io } from 'socket.io-client';
import {
  createJourneyApi,
  coordinate,
  type PublicSnapshot,
} from '../../services/journey-api';
import { socketOrigin } from '../../services/realtime';
import { safeError, AppError } from '../../services/errors';
import { MapCanvas } from '../map/MapCanvas';
import { initialCenter } from '../../services/geo';
import { JourneySheet } from '../../components/sheets/JourneySheet';
import { Text } from '../../components/ui/Text';
import { Button } from '../../components/ui/Button';
import { statusLabels } from '../journey/presentation';
import { TripProgress } from '../journey/TripProgress';
import { PlateBadge } from '../journey/PlateBadge';
import { TripAddresses } from '../journey/parts/TripAddresses';
import { Wordmark } from '../../components/brand/Wordmark';
import { colors, fonts, radius, space } from '../../theme/tokens';
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
            setSnapshot((previous) => {
              const current = previous?.location;
              return current &&
                (!result.location ||
                  Date.parse(current.updatedAt) >
                    Date.parse(result.location.updatedAt))
                ? { ...result, location: current }
                : result;
            });
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
  const rider = snapshot?.rider?.firstName ?? null;
  return (
    <View style={{ flex: 1, minHeight: 0 }}>
      <MapCanvas center={pins.at(-1)?.point ?? initialCenter} pins={pins} />
      <View style={styles.top} pointerEvents="none">
        <View style={styles.brand}>
          <Wordmark size={16} />
        </View>
        {snapshot && !ended && (
          <View style={styles.live}>
            <View style={styles.liveDot} />
            <Text variant="small">Live</Text>
          </View>
        )}
      </View>
      <JourneySheet>
        {ended ? (
          <>
            <Text variant="title" accessibilityRole="header">
              Sharing has ended
            </Text>
            <Text tone="secondary">
              The trip has finished, the rider stopped sharing, or the link
              expired. Ask the rider for a new link if you still need it.
            </Text>
          </>
        ) : snapshot ? (
          <>
            <Text variant="caption" tone="secondary">
              {rider ? `${rider}’s trip` : 'Shared trip'}
            </Text>
            <Text
              variant="title"
              accessibilityRole="header"
              accessibilityLiveRegion="polite"
            >
              {viewerHeadline(snapshot, rider)}
            </Text>
            <TripProgress status={snapshot.rideStatus} />
            <Freshness updatedAt={snapshot.location?.updatedAt ?? null} />
            {(snapshot.driver || snapshot.vehicle) && (
              <View style={styles.driverCard}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {snapshot.driver?.firstName.charAt(0).toUpperCase() ?? '?'}
                  </Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  {snapshot.driver && (
                    <Text variant="label">
                      Driver: {snapshot.driver.firstName}
                    </Text>
                  )}
                  {snapshot.vehicle && (
                    <Text variant="caption" tone="secondary">
                      {snapshot.vehicle.color} {snapshot.vehicle.make}{' '}
                      {snapshot.vehicle.model}
                    </Text>
                  )}
                </View>
                {snapshot.vehicle && (
                  <PlateBadge plate={snapshot.vehicle.plateNumber} />
                )}
              </View>
            )}
            <TripAddresses
              pickup={toStop(snapshot.trip.pickup)}
              destination={toStop(snapshot.trip.destination)}
            />
            <View style={styles.safety}>
              <Text variant="label">Worried about this trip?</Text>
              <Text variant="caption" tone="secondary">
                Call the rider first if you can. In an emergency in The Gambia,
                call the police or an ambulance.
              </Text>
              <View style={styles.calls}>
                <View style={{ flex: 1 }}>
                  <Button
                    label="Police · 117"
                    variant="secondary"
                    onPress={() => void Linking.openURL('tel:117')}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    label="Ambulance · 116"
                    variant="secondary"
                    onPress={() => void Linking.openURL('tel:116')}
                  />
                </View>
              </View>
            </View>
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
          Read-only. This page can’t change the ride or contact the driver.
        </Text>
      </JourneySheet>
    </View>
  );
}

const toStop = (point: {
  address: string;
  longitude: number;
  latitude: number;
}) => ({
  address: point.address,
  location: {
    type: 'Point' as const,
    coordinates: [point.longitude, point.latitude] as [number, number],
  },
});

/** Written for the person watching, not the rider. */
export function viewerHeadline(
  snapshot: Pick<PublicSnapshot, 'rideStatus' | 'trip'>,
  rider: string | null,
) {
  const who = rider ?? 'the rider';
  const place = snapshot.trip.destination.address.split(',')[0]!.trim();
  switch (snapshot.rideStatus) {
    case 'accepted':
    case 'driver_arriving':
      return `Driver is on the way to pick up ${who}`;
    case 'driver_arrived':
      return `Driver has arrived to pick up ${who}`;
    case 'in_progress':
      return `${rider ?? 'The rider'} is on the way to ${place}`;
    default:
      return statusLabels[snapshot.rideStatus];
  }
}

/** "Updated 12 s ago", warning when the driver's phone stops reporting. */
function Freshness({ updatedAt }: { updatedAt: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  if (!updatedAt)
    return (
      <Text variant="caption" tone="secondary">
        The driver’s location will appear once their phone reports it.
      </Text>
    );
  return (
    <Text variant="caption" tone="secondary">
      {freshness(now - Date.parse(updatedAt), updatedAt)}
    </Text>
  );
}
export function freshness(ageMs: number, updatedAt: string) {
  const seconds = Math.max(0, Math.round(ageMs / 1000));
  if (seconds < 60) return `Location updated ${seconds} s ago`;
  return `Last location at ${new Date(updatedAt).toLocaleTimeString()}. The driver’s phone may have lost signal.`;
}

const styles = StyleSheet.create({
  top: {
    position: 'absolute',
    top: space.lg,
    left: space.lg,
    right: space.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brand: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  live: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  driverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandSoft,
  },
  avatarText: { fontFamily: fonts.bold, fontSize: 18, color: colors.brand },
  safety: {
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.neutral,
  },
  calls: { flexDirection: 'row', gap: space.sm },
});
