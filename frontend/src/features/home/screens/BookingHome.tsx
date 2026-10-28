import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../../../components/ui/Text';
import { Button } from '../../../components/ui/Button';
import { ListRow } from '../../../components/ui/ListRow';
import { Loading } from '../../../components/ui/Loading';
import { JourneySheet } from '../../../components/sheets/JourneySheet';
import { MapCanvas } from '../../map/MapCanvas';
import { AddressPicker } from '../../map/AddressPicker';
import { createMapService, initialCenter } from '../../../services/mapbox';
import {
  categories,
  type Category,
  type Coordinate,
  type Estimate,
  type Stop,
} from '../../../services/journey-api';
import { useJourney } from '../../journey/JourneyProvider';
import { isActive } from '../../journey/JourneyController';
import { money, statusLabels } from '../../journey/presentation';
import { Cancellation } from '../../journey/Cancellation';
import { SharePanel } from '../../sharing/SharePanel';
import { Receipt } from '../../receipt/Receipt';
import { safeError } from '../../../services/errors';
import { colors, elevation, radius, size } from '../../../theme/tokens';

export function BookingHome() {
  const { controller, state } = useJourney(),
    insets = useSafeAreaInsets();
  const [pickup, setPickup] = useState<Stop | null>(null),
    [destination, setDestination] = useState<Stop | null>(null);
  const [selecting, setSelecting] = useState<'pickup' | 'destination' | null>(
      null,
    ),
    [pin, setPin] = useState<Coordinate | null>(null);
  const [category, setCategory] = useState<Category>('economy'),
    [estimates, setEstimates] = useState<Partial<Record<Category, Estimate>>>(
      {},
    );
  const [confirm, setConfirm] = useState(false),
    [context, setContext] = useState<'cancel' | 'share' | null>(null);
  const [working, setWorking] = useState(false),
    [error, setError] = useState<string>();
  const [routeResult, setRouteResult] = useState<{
    key: string;
    points: Coordinate[];
    error?: string;
  }>({ key: '', points: [] });
  const [maps] = useState(createMapService);
  const mounted = useRef(true),
    operation = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const trip = state.trip;
  const from = trip?.pickup ?? pickup,
    to = trip?.destination ?? destination;
  const driverPoint = state.location?.point;
  // Planned pickup-to-destination road route. Tracking pins are actual samples;
  // driver approach ETA/navigation is deliberately not inferred from this route.
  const routeKey = JSON.stringify([
    from?.location.coordinates ?? null,
    to?.location.coordinates ?? null,
  ]);
  const route = routeResult.key === routeKey ? routeResult.points : [];
  const routeError =
    routeResult.key === routeKey ? routeResult.error : undefined;
  const visibleContext =
    trip &&
    isActive(trip) &&
    context === 'cancel' &&
    trip.status !== 'in_progress'
      ? 'cancel'
      : trip &&
          isActive(trip) &&
          context === 'share' &&
          trip.status !== 'requested'
        ? 'share'
        : null;
  useEffect(() => {
    const abort = new AbortController();
    const [start, end] = JSON.parse(routeKey) as [
      Coordinate | null,
      Coordinate | null,
    ];
    if (start && end)
      void maps
        .route(start, end, abort.signal)
        .then((points) => {
          if (!abort.signal.aborted) setRouteResult({ key: routeKey, points });
        })
        .catch(() => {
          if (!abort.signal.aborted)
            setRouteResult({
              key: routeKey,
              points: [],
              error:
                'Road route is unavailable. Your selected places are unchanged.',
            });
        });
    return () => abort.abort();
  }, [maps, routeKey]);
  const pins = useMemo(
    () => [
      ...(from
        ? [{ id: 'pickup', point: from.location.coordinates, label: 'Pickup' }]
        : []),
      ...(to
        ? [
            {
              id: 'destination',
              point: to.location.coordinates,
              label: 'Destination',
            },
          ]
        : []),
      ...(driverPoint && trip && isActive(trip)
        ? [{ id: 'driver', point: driverPoint, label: 'Driver' }]
        : []),
      ...(pin && selecting && !trip && !state.loading
        ? [{ id: 'selected', point: pin, label: 'Selected' }]
        : []),
    ],
    [from, to, driverPoint, trip, pin, selecting, state.loading],
  );
  async function estimate() {
    if (!pickup || !destination || operation.current) return;
    operation.current = true;
    setWorking(true);
    setError(undefined);
    try {
      const results = await Promise.all(
        categories.map(
          async (vehicleType) =>
            [
              vehicleType,
              await controller.run((token, signal) =>
                controller.api.estimate(
                  token,
                  { pickup, destination, vehicleType },
                  signal,
                ),
              ),
            ] as const,
        ),
      );
      if (mounted.current) setEstimates(Object.fromEntries(results));
    } catch (error) {
      if (mounted.current) setError(safeError(error).message);
    } finally {
      operation.current = false;
      if (mounted.current) setWorking(false);
    }
  }
  async function request() {
    if (!pickup || !destination || operation.current) return;
    operation.current = true;
    setError(undefined);
    try {
      await controller.request({ pickup, destination, vehicleType: category });
      if (mounted.current) {
        setConfirm(false);
        setEstimates({});
      }
    } catch (error) {
      if (mounted.current) setError(safeError(error).message);
    } finally {
      operation.current = false;
    }
  }
  function choose(kind: 'pickup' | 'destination') {
    setPin(null);
    setSelecting(kind);
    setConfirm(false);
    setError(undefined);
  }
  return (
    <View style={styles.root}>
      <MapCanvas
        center={pin ?? from?.location.coordinates ?? initialCenter}
        pins={pins}
        route={route}
        onSelect={selecting && !trip && !state.loading ? setPin : undefined}
      />
      <View style={[styles.brand, { top: insets.top + 12 }]}>
        <Text variant="heading" style={{ color: colors.brand }}>
          RideCore
        </Text>
      </View>
      <JourneySheet>
        {state.loading ? (
          <Loading label="Restoring your journey" />
        ) : selecting && !trip ? (
          <AddressPicker
            key={selecting}
            kind={selecting}
            pin={pin}
            onPin={setPin}
            onClose={() => setSelecting(null)}
            onConfirm={(stop) => {
              setEstimates({});
              setConfirm(false);
              if (selecting === 'pickup') setPickup(stop);
              else setDestination(stop);
              setSelecting(null);
              setPin(null);
            }}
          />
        ) : visibleContext === 'cancel' ? (
          <Cancellation onClose={() => setContext(null)} />
        ) : visibleContext === 'share' && trip ? (
          <SharePanel trip={trip} onClose={() => setContext(null)} />
        ) : trip ? (
          <>
            <Text variant="heading" accessibilityLiveRegion="polite">
              {statusLabels[trip.status]}
            </Text>
            {isActive(trip) && (
              <Text tone="secondary">
                {state.connected
                  ? 'Live ride updates connected'
                  : 'Checking ride status regularly. Live updates are reconnecting.'}
              </Text>
            )}
            {trip.status === 'requested' && (
              <Text>
                Your request is open to eligible nearby drivers. No driver has
                accepted yet. If nobody accepts, you can keep waiting or cancel.
              </Text>
            )}
            {trip.status === 'requested' && state.nearbyDrivers === 0 && (
              <>
                <Text>
                  No available drivers for this category were found nearby at
                  the last check. Your request remains open.
                </Text>
                <Button
                  label="Check for drivers"
                  variant="secondary"
                  onPress={() => void controller.refresh()}
                />
              </>
            )}
            {trip.driverDetails && (
              <Text variant="label">
                {trip.driverDetails.firstName}
                {trip.driverDetails.rating != null
                  ? ` · ${trip.driverDetails.rating.toFixed(1)} ★`
                  : ''}
              </Text>
            )}
            {trip.vehicle && (
              <>
                <Text>
                  {trip.vehicle.color} · {trip.vehicle.make}{' '}
                  {trip.vehicle.model}
                </Text>
                <Text variant="label">{trip.vehicle.plateNumber}</Text>
              </>
            )}
            {trip.status === 'driver_arrived' && (
              <Text>
                Meet your driver at the pickup point. The driver will start the
                trip.
              </Text>
            )}
            <ListRow title="Pickup" subtitle={trip.pickup.address} />
            <ListRow title="Destination" subtitle={trip.destination.address} />
            <Text>
              {trip.status === 'completed' ? 'Final fare' : 'Estimated fare'} ·{' '}
              {money(trip.finalFare ?? trip.estimatedFare, trip.currency)}
            </Text>
            {state.location && isActive(trip) && (
              <Text variant="caption" tone="secondary">
                Last driver location:{' '}
                {new Date(state.location.timestamp).toLocaleTimeString()}.
                Location may be delayed.
              </Text>
            )}
            {trip.status === 'completed' && (
              <Receipt
                key={trip._id}
                trip={trip}
                onUpdated={() => void controller.refresh()}
              />
            )}
            {isActive(trip) && trip.status !== 'requested' && (
              <Button
                label="Safety and sharing"
                variant="secondary"
                onPress={() => setContext('share')}
              />
            )}
            {isActive(trip) && trip.status !== 'in_progress' && (
              <Button
                label="Cancel ride"
                variant="secondary"
                disabled={state.busy}
                onPress={() => setContext('cancel')}
              />
            )}
            {!isActive(trip) && (
              <Button
                label="Plan another ride"
                onPress={() => {
                  controller.dismiss();
                  setPickup(null);
                  setDestination(null);
                  setEstimates({});
                  setContext(null);
                  setSelecting(null);
                  setPin(null);
                }}
              />
            )}
          </>
        ) : (
          <>
            <Text variant="heading">Where to?</Text>
            <Text tone="secondary">
              Choose your pickup and destination to find your fare.
            </Text>
            <ListRow
              title="Pickup"
              subtitle={pickup?.address ?? 'Choose a pickup point'}
              onPress={() => choose('pickup')}
              disabled={working}
            />
            <ListRow
              title="Destination"
              subtitle={destination?.address ?? 'Search for a place'}
              onPress={() => choose('destination')}
              disabled={working}
            />
            {categories.map(
              (item) =>
                estimates[item] && (
                  <ListRow
                    key={item}
                    title={(category === item ? '✓ ' : '') + item.toUpperCase()}
                    subtitle={money(estimates[item]!.estimatedFare)}
                    onPress={() => {
                      setCategory(item);
                      setConfirm(false);
                    }}
                  />
                ),
            )}
            {!!estimates[category] && (
              <Text variant="caption" tone="secondary">
                Fare estimates use straight-line distance. The street route is
                shown for orientation.
              </Text>
            )}
            {confirm ? (
              <>
                <Text variant="heading">Confirm your request</Text>
                <Text>
                  {category.toUpperCase()} ·{' '}
                  {money(estimates[category]!.estimatedFare)}
                </Text>
                <Text>
                  A driver is assigned only after accepting your request.
                </Text>
                <Button
                  label="Request ride"
                  loading={state.busy}
                  onPress={() => void request()}
                />
                <Button
                  label="Go back"
                  variant="secondary"
                  disabled={state.busy}
                  onPress={() => setConfirm(false)}
                />
              </>
            ) : estimates[category] ? (
              <Button
                label="Continue with this ride"
                disabled={state.loading || !!state.error}
                onPress={() => setConfirm(true)}
              />
            ) : (
              <Button
                label="See fares"
                loading={working}
                disabled={
                  !pickup || !destination || state.loading || !!state.error
                }
                onPress={() => void estimate()}
              />
            )}
          </>
        )}
        {routeError && (
          <Text variant="caption" tone="secondary">
            {routeError}
          </Text>
        )}
        {(error || state.error) && (
          <>
            <Text tone="error" accessibilityLiveRegion="polite">
              {error ?? state.error?.message}
            </Text>
            <Button
              label="Refresh ride status"
              variant="secondary"
              onPress={() => {
                setError(undefined);
                void controller.refresh();
              }}
            />
          </>
        )}
      </JourneySheet>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0, backgroundColor: colors.neutral },
  brand: {
    position: 'absolute',
    left: 16,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingVertical: 8,
    paddingHorizontal: 16,
    maxWidth: size.contentMax,
    ...elevation.floating,
  },
});
