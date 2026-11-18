import { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapCanvas } from '../../map/MapCanvas';
import type { MapPin } from '../../map/MapCanvas.types';
import { JourneySheet } from '../../../components/sheets/JourneySheet';
import { Text } from '../../../components/ui/Text';
import { Button } from '../../../components/ui/Button';
import { Icon } from '../../../components/ui/Icon';
import { ListRow } from '../../../components/ui/ListRow';
import { Loading } from '../../../components/ui/Loading';
import { TripProgress } from '../../journey/TripProgress';
import {
  money,
  requestTypesServedBy,
  statusLabels,
} from '../../journey/presentation';
import { createMapService, initialCenter } from '../../../services/geo';
import { riderName } from '../../../services/driver-api';
import type { Coordinate } from '../../../services/journey-api';
import { colors, elevation, fonts, radius, space } from '../../../theme/tokens';
import { useDriver } from '../DriverProvider';
import { isActiveRide, nextAction } from '../DriverController';
import { DriverOnboarding } from './DriverOnboarding';
import { RequestCard } from '../components/RequestCard';
import { RateRider } from '../components/RateRider';
import { DriverCancel } from '../components/DriverCancel';
import { NotificationsCard } from '../../notifications/NotificationsCard';
import { alertRider } from '../../notifications/alertSound';

const driverStatusLabels: Partial<Record<string, string>> = {
  accepted: 'Ride accepted',
  driver_arriving: 'Heading to pickup',
  driver_arrived: 'Waiting for your rider',
  in_progress: 'On trip',
  completed: 'Trip complete',
  cancelled: 'Ride cancelled',
};

/** Hand off turn-by-turn directions to the phone's maps app. */
function openDirections(point: Coordinate) {
  const [lng, lat] = point;
  void Linking.openURL(
    `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`,
  );
}

// Why "Go online" is waiting, and what the driver can do about it.
export function gpsHint(gps: string) {
  if (gps === 'starting' || gps === 'watching')
    return 'Finding your location… You can also tap the map where you are.';
  if (gps === 'denied')
    return 'Location access is off for RideCore. Tap the map where you are, or allow location and tap Use my location. On iPhone: Settings › Privacy & Security › Location Services › Safari Websites.';
  return 'Your location isn’t available. Tap the map where you are to set your position, then go online.';
}

const typeNames = { economy: 'Economy', comfort: 'Comfort', xl: 'XL' } as const;
// Tells the driver which requests reach them, so a mismatch is obvious.
export function servedCopy(car: keyof typeof typeNames) {
  const names = requestTypesServedBy[car].map((type) => typeNames[type]);
  return `You receive ${names.join(' and ')} requests`;
}

export function DriveScreen() {
  const { controller, gps, retryGps, state } = useDriver();
  // A chime (and vibration where supported) when a new request arrives.
  const requestCount = useRef(0);
  useEffect(() => {
    if (state.requests.length > requestCount.current) alertRider('soft');
    requestCount.current = state.requests.length;
  }, [state.requests.length]);
  const insets = useSafeAreaInsets();
  const [maps] = useState(() => createMapService());
  const [planned, setPlanned] = useState<{
    rideId: string;
    points: Coordinate[];
  } | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const { account, ride, requests, location } = state;
  const approved =
    account?.profile?.verificationStatus === 'approved' &&
    account.vehicle?.verificationStatus === 'approved';
  const online = account?.profile?.availabilityStatus === 'online';
  const active = isActiveRide(ride);

  // Planned street line for the current trip, fetched once per ride.
  const rideId = active ? ride!._id : null;
  const route =
    planned && planned.rideId === rideId ? planned.points : undefined;
  useEffect(() => {
    if (!rideId || !ride) return;
    const abort = new AbortController();
    maps
      .route(
        ride.pickup.location.coordinates,
        ride.destination.location.coordinates,
        abort.signal,
      )
      .then((points) => setPlanned({ rideId, points }))
      .catch(() => undefined);
    return () => abort.abort();
    // Only a new ride needs a new route.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rideId, maps]);

  const pins = useMemo<MapPin[]>(() => {
    const list: MapPin[] = [];
    if (location) list.push({ id: 'driver', point: location, label: 'You' });
    if (active && ride) {
      list.push({
        id: 'pickup',
        point: ride.pickup.location.coordinates,
        label: 'Pickup',
      });
      list.push({
        id: 'destination',
        point: ride.destination.location.coordinates,
        label: 'Drop-off',
      });
    } else if (online)
      requests.slice(0, 5).forEach((request, index) =>
        list.push({
          id: request._id,
          point: request.pickup.location.coordinates,
          label: `${index + 1}`,
        }),
      );
    return list;
  }, [location, active, ride, online, requests]);

  if (state.loading && !account)
    return <Loading label="Loading your driver account" />;
  if (!approved) return <DriverOnboarding />;

  const next = active && ride ? nextAction(ride.status) : null;
  const target =
    ride && ride.status === 'in_progress' ? ride.destination : ride?.pickup;

  return (
    <View style={styles.root}>
      <MapCanvas
        center={location ?? initialCenter}
        pins={pins}
        route={route}
        onSelect={
          // Tapping the map always works off-trip: phones can grant location
          // but take a long time (or never) to report it, e.g. in a
          // home-screen web app.
          !active
            ? (point) => controller.updateLocation(point, 'map')
            : undefined
        }
      />
      <View style={[styles.status, { top: insets.top + 12 }]}>
        <View
          style={[styles.dot, online || active ? styles.dotOn : styles.dotOff]}
        />
        <Text variant="label">
          {active ? 'On a ride' : online ? 'Online' : 'Offline'}
        </Text>
      </View>
      <JourneySheet>
        {state.error && (
          <Text tone="error" accessibilityLiveRegion="polite">
            {state.error}
          </Text>
        )}
        {cancelling && active ? (
          <DriverCancel
            busy={state.busy}
            onCancel={(reason) => {
              setCancelling(false);
              void controller.cancel(reason);
            }}
            onClose={() => setCancelling(false)}
          />
        ) : active && ride ? (
          <>
            <Text variant="heading" accessibilityLiveRegion="polite">
              {driverStatusLabels[ride.status] ?? statusLabels[ride.status]}
            </Text>
            <TripProgress status={ride.status} />
            <View style={styles.riderCard}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(riderName(ride) ?? 'R').charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="heading">{riderName(ride) ?? 'Your rider'}</Text>
                <Text variant="caption" tone="secondary">
                  {state.connected
                    ? 'Sharing your live location with the rider'
                    : 'Reconnecting live location…'}
                </Text>
              </View>
              <Text style={styles.fare}>
                {money(ride.estimatedFare, ride.currency)}
              </Text>
            </View>
            {next && (
              <Button
                label={next.label}

                loading={state.busy}
                onPress={() => void controller.advance()}
              />
            )}
            {target && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Directions to ${ride.status === 'in_progress' ? 'drop-off' : 'pickup'}`}
                onPress={() => openDirections(target.location.coordinates)}
                style={({ pressed }) => [
                  styles.directions,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Icon name="pin" color={colors.brand} />
                <View style={{ flex: 1 }}>
                  <Text variant="label">
                    {ride.status === 'in_progress' ? 'Drop-off' : 'Pickup'}
                  </Text>
                  <Text variant="caption" tone="secondary">
                    {target.address}
                  </Text>
                </View>
                <Text variant="label" style={{ color: colors.brand }}>
                  Directions
                </Text>
              </Pressable>
            )}
            {ride.status === 'in_progress' ? (
              <ListRow
                icon="pin"
                title="Picked up at"
                subtitle={ride.pickup.address}
              />
            ) : (
              <ListRow
                icon="pin"
                title="Drop-off"
                subtitle={ride.destination.address}
              />
            )}
            {ride.status !== 'in_progress' && (
              <Button
                label="Cancel ride"
                variant="secondary"
                disabled={state.busy}
                onPress={() => setCancelling(true)}
              />
            )}
          </>
        ) : ride && ride.status === 'completed' ? (
          <>
            <Text variant="heading">Trip complete</Text>
            <View style={styles.collect}>
              <Text tone="inverse">
                Collect from {riderName(ride) ?? 'your rider'}
              </Text>
              <Text style={styles.collectAmount}>
                {money(ride.finalFare ?? ride.estimatedFare, ride.currency)}
              </Text>
            </View>
            <RateRider
              name={riderName(ride)}
              busy={state.busy}
              onRate={(rating, comment) =>
                void controller.rate(rating, comment)
              }
            />
            <Button
              label="Skip and close"
              variant="secondary"
              disabled={state.busy}
              onPress={controller.closeFinishedRide}
            />
          </>
        ) : ride && ride.status === 'cancelled' ? (
          <>
            <Text variant="heading">Ride cancelled</Text>
            <Text tone="secondary">
              This ride was cancelled. You’re free to take another request.
            </Text>
            <Button label="Close" onPress={controller.closeFinishedRide} />
          </>
        ) : online ? (
          <>
            <Text variant="heading">You’re online</Text>
            <NotificationsCard role="driver" />
            {account?.vehicle && (
              <Text variant="caption" tone="secondary">
                {servedCopy(account.vehicle.vehicleType)}
              </Text>
            )}
            <Text tone="secondary">
              {requests.length
                ? `${requests.length} ride request${requests.length === 1 ? '' : 's'} near you`
                : 'Looking for ride requests near you. Keep the app open.'}
            </Text>
            {requests.map((request, index) => (
              <RequestCard
                key={request._id}
                index={index + 1}
                request={request}
                from={location}
                busy={state.busy}
                onAccept={() => void controller.accept(request._id)}
              />
            ))}
            <Button
              label="Go offline"
              variant="secondary"
              disabled={state.busy}
              onPress={() => void controller.goOffline()}
            />
          </>
        ) : (
          <>
            <Text variant="heading">You’re offline</Text>
            <Text tone="secondary">
              Go online to receive ride requests near you.
            </Text>
            {!location && (
              <View style={styles.hint}>
                <Icon name="pin" color={colors.brand} />
                <Text variant="caption" style={{ flex: 1 }}>
                  {gpsHint(gps)}
                </Text>
              </View>
            )}
            {!location && (gps === 'denied' || gps === 'unavailable') && (
              <Button
                label="Use my location"
                variant="secondary"
                onPress={retryGps}
              />
            )}
            {location && state.locationSource === 'map' && (
              <Text variant="caption" tone="secondary">
                Position set on the map. Tap again to move it.
              </Text>
            )}
            <Button
              label="Go online"

              loading={state.busy}
              disabled={!location}
              onPress={() => void controller.goOnline()}
            />
          </>
        )}
      </JourneySheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0, backgroundColor: colors.neutral },
  status: {
    position: 'absolute',
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingVertical: 8,
    paddingHorizontal: 14,
    ...elevation.floating,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotOn: { backgroundColor: colors.brand },
  dotOff: { backgroundColor: colors.secondary },
  riderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: fonts.semibold,
    fontSize: 20,
    lineHeight: 26,
    color: colors.text,
  },
  fare: {
    fontFamily: fonts.bold,
    fontSize: 17,
    lineHeight: 22,
    color: colors.text,
  },
  directions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: radius.lg,
    backgroundColor: colors.neutral,
    minHeight: 64,
  },
  collect: {
    backgroundColor: colors.ink,
    borderRadius: radius.md,
    padding: space.xl,
    gap: space.xs,
  },
  collectAmount: {
    fontFamily: fonts.medium,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -1,
    color: colors.onInk,
  },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.brandSoft,
  },
});
