import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { RiderHome } from './RiderHome';
import { useDemo } from '../../../demo/DemoProvider';
import { DemoMap } from '../../../demo/DemoMap';
import { VehicleArt } from '../../../components/brand/VehicleArt';
import { IconButton } from '../../../components/ui/IconButton';
import { Icon } from '../../../components/ui/Icon';
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
  type ShareGrant,
} from '../../../services/journey-api';
import { useJourney } from '../../journey/JourneyProvider';
import { isActive } from '../../journey/JourneyController';
import { money, statusLabels } from '../../journey/presentation';
import { Cancellation } from '../../journey/Cancellation';
import { TripProgress } from '../../journey/TripProgress';
import { PlateBadge } from '../../journey/PlateBadge';
import { SharePanel } from '../../sharing/SharePanel';
import { Receipt } from '../../receipt/Receipt';
import { safeError } from '../../../services/errors';
import { colors, elevation, fonts, radius, size } from '../../../theme/tokens';

export function BookingHome({
  service,
  onServiceUsed,
}: { service?: Category; onServiceUsed?(): void } = {}) {
  const [planning, setPlanning] = useState(!!service);
  const [retainedShare, setRetainedShare] = useState<{
    tripId: string;
    grant: ShareGrant | null;
  } | null>(null);
  const { runtime } = useDemo();
  const [lastService, setLastService] = useState(service);
  const { controller, state } = useJourney(),
    insets = useSafeAreaInsets();
  const [pickup, setPickup] = useState<Stop | null>(null),
    [destination, setDestination] = useState<Stop | null>(null);
  const [selecting, setSelecting] = useState<'pickup' | 'destination' | null>(
      null,
    ),
    [pin, setPin] = useState<Coordinate | null>(null);
  const [category, setCategory] = useState<Category>(service ?? 'economy'),
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
  const [maps] = useState(() => runtime?.maps ?? createMapService());
  useEffect(() => {
    if (service) {
      onServiceUsed?.();
    }
  }, [service, onServiceUsed]);
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
  if (service !== lastService) {
    setLastService(service);
    if (service) {
      setCategory(service);
      setConfirm(false);
      setPlanning(true);
    }
  }
  if (!planning && !trip && !state.loading && !state.error) {
    return (
      <RiderHome
        history={state.history}
        onPlan={(service, recentDestination) => {
          if (service) setCategory(service);
          if (recentDestination) {
            setDestination(recentDestination);
            setEstimates({});
            setConfirm(false);
          }
          setPlanning(true);
        }}
      />
    );
  }
  return (
    <View style={styles.root}>
      {runtime ? (
        <DemoMap
          center={pin ?? from?.location.coordinates ?? initialCenter}
          pins={pins}
          route={route}
          onSelect={selecting && !trip && !state.loading ? setPin : undefined}
        />
      ) : (
        <MapCanvas
          center={pin ?? from?.location.coordinates ?? initialCenter}
          pins={pins}
          route={route}
          onSelect={selecting && !trip && !state.loading ? setPin : undefined}
        />
      )}
      <View
        style={[
          styles.brand,
          !trip && !state.loading && styles.brandBare,
          { top: insets.top + 12 },
        ]}
      >
        {!trip && !state.loading ? (
          <IconButton
            tone="onTaxi"
            icon="back"
            label="Back to home"
            onPress={() => {
              setPlanning(false);
              setSelecting(null);
            }}
          />
        ) : (
          <Text variant="label">RideCore</Text>
        )}
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
          <SharePanel
            key={trip._id}
            trip={trip}
            initialGrant={
              retainedShare?.tripId === trip._id ? retainedShare.grant : null
            }
            onGrantChange={(grant) =>
              setRetainedShare({ tripId: trip._id, grant })
            }
            onClose={() => setContext(null)}
          />
        ) : trip ? (
          <>
            <Text variant="heading" accessibilityLiveRegion="polite">
              {statusLabels[trip.status]}
            </Text>
            <TripProgress status={trip.status} />
            {runtime && isActive(trip) && (
              <Button
                label={
                  trip.status === 'requested'
                    ? 'Demo: match a driver'
                    : trip.status === 'driver_arrived'
                      ? 'Demo: start ride'
                      : trip.status === 'in_progress'
                        ? 'Demo: complete ride'
                        : 'Demo: advance ride'
                }
                variant="secondary"
                disabled={state.busy}
                onPress={() => {
                  runtime.advance(trip._id);
                  void controller.refresh();
                }}
              />
            )}
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
            {(trip.driverDetails || trip.vehicle) && (
              <View style={styles.driverCard}>
                <View style={styles.driverRow}>
                  {trip.driverDetails ? (
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {trip.driverDetails.firstName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  ) : (
                    <VehicleArt
                      width={72}
                      premium={trip.vehicleType === 'comfort'}
                    />
                  )}
                  <View style={{ flex: 1, gap: 2 }}>
                    {trip.driverDetails && (
                      <Text variant="heading">
                        {trip.driverDetails.firstName}
                      </Text>
                    )}
                    {trip.driverDetails?.rating != null && (
                      <View style={styles.rating}>
                        <Icon name="star" size={15} color={colors.secondary} />
                        <Text variant="caption" tone="secondary">
                          {trip.driverDetails.rating.toFixed(1)}
                        </Text>
                      </View>
                    )}
                    {trip.vehicle && (
                      <Text variant="caption" tone="secondary">
                        {trip.vehicle.color} {trip.vehicle.make}{' '}
                        {trip.vehicle.model}
                      </Text>
                    )}
                  </View>
                </View>
                {trip.vehicle && (
                  <View style={styles.plateRow}>
                    <PlateBadge plate={trip.vehicle.plateNumber} />
                    {isActive(trip) && trip.status !== 'in_progress' && (
                      <View style={styles.plateTip}>
                        <Icon name="shield" size={18} color={colors.brand} />
                        <Text variant="caption" style={{ flex: 1 }}>
                          Check the plate before you get in.
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}
            {trip.status === 'driver_arrived' && (
              <Text>
                Meet your driver at the pickup point. The driver will start the
                trip.
              </Text>
            )}
            {isActive(trip) && trip.status !== 'requested' && !!trip.driver && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Share my ride"
                onPress={() => setContext('share')}
                style={styles.shareCard}
              >
                <Icon name="share" size={28} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text variant="label">Share my ride</Text>
                  <Text variant="caption" tone="secondary">
                    Let friends or family follow your journey
                  </Text>
                </View>
                <Icon name="chevron" size={20} />
              </Pressable>
            )}
            <ListRow icon="pin" title="Pickup" subtitle={trip.pickup.address} />
            <ListRow
              icon="pin"
              title="Destination"
              subtitle={trip.destination.address}
            />
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
                  setRetainedShare(null);
                  setPlanning(false);
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
            <Text variant="heading">
              {estimates[category] ? 'Choose a ride' : 'Plan your ride'}
            </Text>
            <View style={styles.routeFields}>
              <ListRow
                icon="pin"
                title="Pickup"
                subtitle={pickup?.address ?? 'Choose a pickup point'}
                onPress={() => choose('pickup')}
                disabled={working}
              />
              <ListRow
                icon="search"
                title="Destination"
                subtitle={destination?.address ?? 'Search for a place'}
                onPress={() => choose('destination')}
                disabled={working}
              />
            </View>
            {categories.map(
              (item) =>
                estimates[item] && (
                  <Pressable
                    key={item}
                    accessibilityRole="button"
                    accessibilityLabel={
                      (category === item ? '✓ ' : '') +
                      item.toUpperCase() +
                      ', ' +
                      money(estimates[item]!.estimatedFare)
                    }
                    accessibilityState={{ selected: category === item }}
                    style={[
                      styles.vehicle,
                      category === item && styles.vehicleSelected,
                    ]}
                    onPress={() => {
                      setCategory(item);
                      setConfirm(false);
                    }}
                  >
                    <VehicleArt width={86} premium={item === 'comfort'} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text variant="heading">
                        {item === 'economy'
                          ? 'RideCore'
                          : item === 'comfort'
                            ? 'Comfort'
                            : 'RideCore XL'}
                      </Text>
                      <Text variant="caption" tone="secondary">
                        {item === 'economy'
                          ? 'Affordable, everyday rides'
                          : item === 'comfort'
                            ? 'A little more comfort'
                            : 'Extra room for your group'}
                      </Text>
                    </View>
                    <Text variant="label">
                      {money(estimates[item]!.estimatedFare)}
                    </Text>
                  </Pressable>
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
  shareCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: colors.neutral,
    borderRadius: radius.lg,
    padding: 20,
    minHeight: 80,
  },
  driverCard: {
    gap: 14,
    padding: 16,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: fonts.wideBold,
    fontSize: 22,
    lineHeight: 28,
    color: colors.brand,
  },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  plateRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
  },
  plateTip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 160,
  },
  routeFields: {
    backgroundColor: colors.neutral,
    borderRadius: radius.md,
    paddingHorizontal: 16,
  },
  vehicle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: radius.lg,
  },
  vehicleSelected: {
    borderColor: colors.brand,
    backgroundColor: colors.neutral,
  },
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
  // The back button is already a round surface; no pill around it.
  brandBare: { paddingVertical: 0, paddingHorizontal: 0 },
});
