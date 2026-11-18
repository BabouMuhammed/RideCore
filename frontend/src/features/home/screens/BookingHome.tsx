import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { Pressable, StyleSheet, View } from 'react-native';
import { RiderHome } from './RiderHome';
import { useDemo } from '../../../demo/DemoProvider';
import { DemoMap } from '../../../demo/DemoMap';
import { IconButton } from '../../../components/ui/IconButton';
import { Icon } from '../../../components/ui/Icon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../../../components/ui/Text';
import { Button } from '../../../components/ui/Button';
import { Loading } from '../../../components/ui/Loading';
import { Wordmark } from '../../../components/brand/Wordmark';
import { JourneySheet } from '../../../components/sheets/JourneySheet';
import { MapCanvas } from '../../map/MapCanvas';
import { AddressPicker } from '../../map/AddressPicker';
import {
  createMapService,
  initialCenter,
  makeStop,
} from '../../../services/geo';
import { useNearbyDrivers } from '../../journey/useNearbyDrivers';
import {
  categories,
  type Category,
  type Coordinate,
  type Estimate,
  type Stop,
  type ShareGrant,
  type Trip,
} from '../../../services/journey-api';
import { useJourney } from '../../journey/JourneyProvider';
import { isActive } from '../../journey/JourneyController';
import { headline, money, noDriverFound } from '../../journey/presentation';
import { Cancellation } from '../../journey/Cancellation';
import { TripProgress } from '../../journey/TripProgress';
import { PlateBadge } from '../../journey/PlateBadge';
import { TripAddresses, splitAddress } from '../../journey/parts/TripAddresses';
import { SummaryRow } from '../../journey/parts/SummaryRow';
import { VehicleOption } from '../../journey/parts/VehicleOption';
import { SearchingPanel } from '../../journey/parts/SearchingPanel';
import { SharePanel } from '../../sharing/SharePanel';
import { Receipt } from '../../receipt/Receipt';
import { safeError } from '../../../services/errors';
import {
  colors,
  elevation,
  fonts,
  radius,
  size,
  space,
} from '../../../theme/tokens';

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
    distance?: number | null;
    duration?: number | null;
    error?: string;
  }>({ key: '', points: [] });
  const mounted = useRef(true),
    operation = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [maps] = useState(() => runtime?.maps ?? createMapService());
  // Where the rider is, when the device will tell us.
  const [here, setHere] = useState<Coordinate | null>(null);
  // Choosing a place by moving the map under a fixed centre pin.
  const [mapPick, setMapPick] = useState<{ start: Coordinate } | null>(null);
  const [sheetHeight, setSheetHeight] = useState(0);
  const [seedQuery, setSeedQuery] = useState('');
  const located = useRef<'no' | 'silent' | 'asked'>('no');
  /**
   * Finds the rider and, if no pickup is chosen yet, uses that spot as the
   * pickup (like Uber). `ask` allows the permission prompt; without it we
   * only use a permission that was already granted. Failure is silent: the
   * rider can always search or use the map.
   */
  const locate = useCallback(
    async (ask: boolean) => {
      if (runtime || located.current === 'asked') return;
      if (!ask && located.current === 'silent') return;
      located.current = ask ? 'asked' : 'silent';
      try {
        const permission = ask
          ? await Location.requestForegroundPermissionsAsync()
          : await Location.getForegroundPermissionsAsync?.();
        if (!permission?.granted) return;
        const result = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!result?.coords || !mounted.current) return;
        const point: Coordinate = [
          result.coords.longitude,
          result.coords.latitude,
        ];
        setHere(point);
        const found = await maps.reverse(point).catch(() => null);
        if (!mounted.current) return;
        const stop = found
          ? makeStop(found.address, point)
          : makeStop('My current location', point);
        setPickup((current) => current ?? stop);
        // A pickup picker opened only because we had no pickup can close.
        setSelecting((current) => {
          if (current !== 'pickup') return current;
          setMapPick(null);
          setPin(null);
          return null;
        });
      } catch {
        // Location is optional.
      }
    },
    [maps, runtime],
  );
  useEffect(() => {
    // After mount, use the rider's position if they already allowed it.
    const timer = setTimeout(() => void locate(false), 0);
    return () => clearTimeout(timer);
  }, [locate]);
  useEffect(() => {
    if (service) {
      onServiceUsed?.();
    }
  }, [service, onServiceUsed]);
  const trip = state.trip;
  const from = trip?.pickup ?? pickup,
    to = trip?.destination ?? destination;
  const driverPoint = state.location?.point;
  const cars = useNearbyDrivers(
    trip
      ? null
      : (pickup?.location.coordinates ??
          here ??
          state.history[0]?.pickup.location.coordinates ??
          initialCenter),
  );
  // Planned pickup-to-destination road route. Tracking pins are actual samples;
  // driver approach ETA/navigation is deliberately not inferred from this route.
  const routeKey = JSON.stringify([
    from?.location.coordinates ?? null,
    to?.location.coordinates ?? null,
  ]);
  const route = routeResult.key === routeKey ? routeResult.points : [];
  const routeDistance =
    routeResult.key === routeKey ? (routeResult.distance ?? null) : null;
  const routeDuration =
    routeResult.key === routeKey ? (routeResult.duration ?? null) : null;
  const recentStops = useMemo(() => {
    const seen = new Set<string>();
    return state.history
      .map((item) => item.destination)
      .filter((stop) => {
        const key = stop.address.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 3);
  }, [state.history]);
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
      void (
        'routeInfo' in maps && maps.routeInfo
          ? maps.routeInfo(start, end, abort.signal)
          : maps
              .route(start, end, abort.signal)
              .then((points) => ({ points, distance: null, duration: null }))
      )
        .then((info) => {
          if (!abort.signal.aborted) setRouteResult({ key: routeKey, ...info });
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
      ...(pin && selecting && !trip && !state.loading && !mapPick
        ? [{ id: 'selected', point: pin, label: 'Selected' }]
        : []),
      ...(trip ? [] : cars),
    ],
    [from, to, driverPoint, trip, pin, selecting, state.loading, mapPick, cars],
  );
  const mapCenter =
    mapPick?.start ??
    pin ??
    from?.location.coordinates ??
    here ??
    initialCenter;
  const picking = !!selecting && !trip && !state.loading;
  // Pickup starts on the map, pin first: the rider moves the map under the
  // pin and taps "Pick me up here". No reading or typing needed; searching
  // by name is one tap away.
  function startPickup(at?: Coordinate) {
    setSelecting('pickup');
    if (runtime) return;
    const start = at ?? here ?? initialCenter;
    setMapPick({ start });
    setPin(start);
  }
  function plan(recentDestination?: Stop, search?: string) {
    setPlanning(true);
    setConfirm(false);
    setSeedQuery(search ?? '');
    if (recentDestination) {
      setDestination(recentDestination);
      setEstimates({});
      if (pickup) setSelecting(null);
      else startPickup();
    } else setSelecting('destination');
    void locate(true);
  }
  function stopPicking() {
    setSelecting(null);
    setPin(null);
    setMapPick(null);
    setSeedQuery('');
  }
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
  // Re-send the same trip after a search closed without a driver.
  async function requestAgain(previous: Trip) {
    if (operation.current) return;
    operation.current = true;
    setError(undefined);
    try {
      await controller.request({
        pickup: previous.pickup,
        destination: previous.destination,
        vehicleType: previous.vehicleType,
      });
    } catch (error) {
      if (mounted.current) setError(safeError(error).message);
    } finally {
      operation.current = false;
    }
  }
  function choose(kind: 'pickup' | 'destination') {
    setPin(null);
    setMapPick(null);
    if (kind === 'pickup') startPickup(pickup?.location.coordinates);
    else setSelecting(kind);
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
        center={
          here ?? state.history[0]?.pickup.location.coordinates ?? initialCenter
        }
        located={!!here}
        cars={cars}
        onPlan={(service, recentDestination, search) => {
          if (service) setCategory(service);
          plan(recentDestination, search);
        }}
      />
    );
  }
  return (
    <View style={styles.root}>
      {runtime ? (
        <DemoMap
          center={mapCenter}
          pins={pins}
          route={route}
          onSelect={picking && !mapPick ? setPin : undefined}
        />
      ) : (
        <MapCanvas
          center={mapCenter}
          pins={pins}
          route={route}
          onSelect={picking && !mapPick ? setPin : undefined}
          onCenterChange={picking && mapPick ? setPin : undefined}
          bottomInset={picking && mapPick ? sheetHeight : 0}
        />
      )}
      {picking && mapPick && (
        // Fixed pin over the middle of the visible map; the map moves under it.
        <View
          pointerEvents="none"
          style={[styles.centerPin, { bottom: sheetHeight }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <View style={styles.centerPinHead}>
            <Icon name="pin" size={20} color={colors.onBrand} />
          </View>
          <View style={styles.centerPinStem} />
        </View>
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
            icon="back"
            label="Back to home"
            onPress={() => {
              if (mapPick) {
                // Back from the map goes to the search list first.
                setMapPick(null);
                setPin(null);
                return;
              }
              setPlanning(false);
              stopPicking();
            }}
          />
        ) : (
          <Wordmark size={16} />
        )}
      </View>
      <JourneySheet onHeight={setSheetHeight}>
        {state.loading ? (
          <Loading label="Restoring your journey" />
        ) : selecting && !trip ? (
          <AddressPicker
            key={selecting}
            kind={selecting}
            pin={pin}
            onPin={setPin}
            onClose={stopPicking}
            recent={recentStops}
            initialQuery={selecting === 'destination' ? seedQuery : ''}
            panning={!!mapPick}
            onPanMap={
              runtime
                ? undefined
                : () => {
                    setMapPick({ start: mapCenter });
                    setPin(mapCenter);
                  }
            }
            onUnpin={() => {
              setMapPick(null);
              setPin(null);
            }}
            onConfirm={(stop) => {
              setEstimates({});
              setConfirm(false);
              const next =
                selecting === 'destination' && !pickup ? 'pickup' : null;
              if (selecting === 'pickup') setPickup(stop);
              else setDestination(stop);
              stopPicking();
              // Uber-style: destination first, then pickup if we don't know it.
              if (next) startPickup();
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
            <Text
              variant="title"
              accessibilityLiveRegion="polite"
              accessibilityRole="header"
            >
              {headline(trip)}
            </Text>
            {trip.status === 'requested' ? (
              <>
                <View style={styles.rule} />
                <SearchingPanel
                  requestedAt={trip.requestedAt}
                  expiresAt={trip.requestExpiresAt}
                  nearbyDrivers={state.nearbyDrivers}
                  checking={state.busy}
                  onCheck={() => void controller.refresh()}
                />
              </>
            ) : trip.status === 'cancelled' &&
              trip.cancellationReason === noDriverFound ? (
              <>
                <Text>
                  No driver accepted your request in time. You haven’t been
                  charged.
                </Text>
                <Button
                  label="Try again"
                  disabled={state.busy}
                  onPress={() => void requestAgain(trip)}
                />
              </>
            ) : (
              <TripProgress status={trip.status} />
            )}
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
            {(trip.driverDetails || trip.vehicle) && (
              <View style={styles.driverCard}>
                <View style={styles.driverRow}>
                  <View style={styles.avatar}>
                    {trip.driverDetails ? (
                      <Text style={styles.avatarText}>
                        {trip.driverDetails.firstName.charAt(0).toUpperCase()}
                      </Text>
                    ) : (
                      <Icon name="car" />
                    )}
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    {trip.driverDetails && (
                      <Text variant="label">
                        {trip.driverDetails.firstName}
                      </Text>
                    )}
                    {trip.driverDetails &&
                      // The backend reports 0 until a driver's first rating;
                      // showing "0.0" would read as a very poor score.
                      (trip.driverDetails.rating ? (
                        <View style={styles.rating}>
                          <Icon name="star" size={14} color={colors.brand} />
                          <Text variant="caption" tone="secondary">
                            {trip.driverDetails.rating.toFixed(1)}
                          </Text>
                        </View>
                      ) : (
                        <Text variant="caption" tone="secondary">
                          New driver
                        </Text>
                      ))}
                    {trip.vehicle && (
                      <Text variant="caption" tone="secondary">
                        {trip.vehicle.color} {trip.vehicle.make}{' '}
                        {trip.vehicle.model}
                      </Text>
                    )}
                  </View>
                  {trip.vehicle && (
                    <PlateBadge plate={trip.vehicle.plateNumber} />
                  )}
                </View>
                {trip.vehicle &&
                  isActive(trip) &&
                  trip.status !== 'in_progress' && (
                    <View style={styles.plateTip}>
                      <Icon name="shield" size={16} color={colors.brand} />
                      <Text
                        variant="caption"
                        tone="secondary"
                        style={{ flex: 1 }}
                      >
                        Check the plate matches before you get in.
                      </Text>
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
                style={({ pressed }) => [
                  styles.shareRow,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <View style={styles.tile}>
                  <Icon name="share" size={20} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="label">Share my ride</Text>
                  <Text variant="caption" tone="secondary">
                    Let friends or family follow your journey
                  </Text>
                </View>
                <Icon name="chevron" size={16} color={colors.secondary} />
              </Pressable>
            )}
            <View style={styles.rule} />
            <TripAddresses
              pickup={trip.pickup}
              destination={trip.destination}
            />
            <SummaryRow
              icon="banknote"
              label={
                trip.status === 'completed' ? 'Final fare' : 'Estimated fare'
              }
              value={money(trip.finalFare ?? trip.estimatedFare, trip.currency)}
              divider={false}
            />
            {isActive(trip) && (
              <Text variant="small" tone="secondary">
                {state.connected
                  ? 'Live ride updates connected'
                  : 'Checking ride status regularly. Live updates are reconnecting.'}
                {state.location
                  ? ` · Last driver update: ${new Date(state.location.timestamp).toLocaleTimeString()}`
                  : ''}
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
                variant={trip.status === 'requested' ? 'primary' : 'secondary'}
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
        ) : confirm && estimates[category] ? (
          <>
            <Text variant="title" accessibilityRole="header">
              Confirm your ride
            </Text>
            <Text variant="label" style={{ fontFamily: fonts.semibold }}>
              Booking summary
            </Text>
            <View>
              <SummaryRow
                marker={<View style={styles.ring} />}
                label="Pickup"
                value={splitAddress(pickup!.address).name}
                detail={splitAddress(pickup!.address).detail}
              />
              <SummaryRow
                marker={<Icon name="pin" size={22} color={colors.brand} />}
                label="Destination"
                value={splitAddress(destination!.address).name}
                detail={splitAddress(destination!.address).detail}
              />
              <SummaryRow
                icon="car"
                label="Ride"
                value={categoryCopy[category].title}
                onChange={() => setConfirm(false)}
              />
              <SummaryRow
                icon="banknote"
                label="Estimated fare"
                value={money(estimates[category]!.estimatedFare)}
              />
              <SummaryRow
                icon="wallet"
                label="Payment"
                value="Cash or wallet"
                detail="Chosen after your trip"
                divider={false}
              />
            </View>
            <Text variant="small" tone="secondary">
              A driver is assigned only after accepting your request.
            </Text>
            <Button
              label="Confirm ride"
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
          <>
            <Text variant="title" accessibilityRole="header">
              Choose your ride
            </Text>
            <View accessibilityRole="radiogroup" style={{ gap: space.sm }}>
              {categories.map(
                (item) =>
                  estimates[item] && (
                    <VehicleOption
                      key={item}
                      title={categoryCopy[item].title}
                      description={categoryCopy[item].description}
                      seats={categoryCopy[item].seats}
                      fare={money(estimates[item]!.estimatedFare)}
                      selected={category === item}
                      onPress={() => {
                        setCategory(item);
                        setConfirm(false);
                      }}
                    />
                  ),
              )}
            </View>
            <View style={styles.payment}>
              <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
                Payment method
              </Text>
              <Text variant="label">Cash or wallet</Text>
            </View>
            <Text variant="small" tone="secondary">
              Fares use straight-line distance; the street route is shown for
              orientation.
            </Text>
            <Button
              label="Continue"
              disabled={state.loading || !!state.error}
              onPress={() => setConfirm(true)}
            />
            <Button
              label="Change trip"
              variant="secondary"
              onPress={() => setEstimates({})}
            />
          </>
        ) : (
          <>
            <View style={styles.titleRow}>
              <Text
                variant="title"
                accessibilityRole="header"
                style={{ flex: 1 }}
              >
                {pickup && destination ? 'Your trip' : 'Where to?'}
              </Text>
              {pickup && destination && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Edit trip"
                  onPress={() => choose('destination')}
                  hitSlop={8}
                  style={styles.edit}
                >
                  <Icon name="pencil" size={14} color={colors.brand} />
                  <Text variant="caption">Edit</Text>
                </Pressable>
              )}
            </View>
            <TripAddresses
              pickup={pickup}
              destination={destination}
              onPickup={working ? undefined : () => choose('pickup')}
              onDestination={working ? undefined : () => choose('destination')}
            />
            {pickup &&
              destination &&
              (routeDistance != null || routeDuration != null) && (
                <>
                  <View style={styles.rule} />
                  <View style={styles.estimates}>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text variant="small" tone="secondary">
                        Estimated distance
                      </Text>
                      <Text variant="label">
                        {routeDistance != null
                          ? `${(routeDistance / 1000).toFixed(1)} km`
                          : 'Not available'}
                      </Text>
                    </View>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text variant="small" tone="secondary">
                        Estimated duration
                      </Text>
                      <Text variant="label">
                        {routeDuration != null
                          ? `${Math.max(1, Math.round(routeDuration / 60))} min`
                          : 'Not available'}
                      </Text>
                    </View>
                  </View>
                </>
              )}
            <Button
              label="Choose a ride"
              loading={working}
              disabled={
                !pickup || !destination || state.loading || !!state.error
              }
              onPress={() => void estimate()}
            />
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
const categoryCopy: Record<
  Category,
  { title: string; description: string; seats: string }
> = {
  economy: {
    title: 'Economy',
    description: 'Affordable everyday rides',
    seats: 'Up to 4 seats',
  },
  comfort: {
    title: 'Comfort',
    description: 'More space and comfort',
    seats: 'Up to 4 seats',
  },
  xl: { title: 'XL', description: 'For larger groups', seats: 'Up to 6 seats' },
};
const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0, backgroundColor: colors.neutral },
  brand: {
    position: 'absolute',
    left: 24,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 14,
    maxWidth: size.contentMax,
    ...elevation.floating,
  },
  // The back button is already a white bordered square.
  brandBare: {
    paddingVertical: 0,
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  // The stem's tip sits exactly on the centre of the visible map.
  centerPin: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 46,
  },
  centerPinHead: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerPinStem: { width: 3, height: 12, backgroundColor: colors.brand },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  edit: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 },
  estimates: { flexDirection: 'row', gap: space.xl },
  payment: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  ring: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 3,
    borderColor: colors.text,
  },
  driverCard: {
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: fonts.semibold,
    fontSize: 18,
    lineHeight: 24,
    color: colors.text,
  },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  plateTip: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 56,
  },
  tile: {
    width: size.tile,
    height: size.tile,
    borderRadius: radius.tile,
    backgroundColor: colors.neutral,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
