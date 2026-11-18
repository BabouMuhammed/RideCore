import { useEffect, useRef, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import * as Location from 'expo-location';
import { useDemo } from '../../demo/DemoProvider';
import { demoPlaces } from '../../demo/runtime';
import { Input } from '../../components/ui/Input';
import { Text } from '../../components/ui/Text';
import { Button } from '../../components/ui/Button';
import { ListRow } from '../../components/ui/ListRow';
import { Icon } from '../../components/ui/Icon';
import { SectionLabel } from '../../components/ui/SectionLabel';
import { colors, space } from '../../theme/tokens';
import { createMapService, makeStop } from '../../services/geo';
import type { Coordinate, Stop } from '../../services/journey-api';
import { safeError } from '../../services/errors';
export function AddressPicker({
  kind,
  pin,
  onPin,
  onConfirm,
  onClose,
  recent = [],
  initialQuery = '',
  panning = false,
  onPanMap,
  onUnpin,
}: {
  kind: 'pickup' | 'destination';
  pin: Coordinate | null;
  onPin(point: Coordinate): void;
  onConfirm(stop: Stop): void;
  onClose(): void;
  /** Places from the rider's history, offered as one-tap choices. */
  recent?: Stop[];
  /** Search text to start with (and search for straight away). */
  initialQuery?: string;
  /** True while the pin follows the centre of the map as it is moved. */
  panning?: boolean;
  /** Start choosing by moving the map. Absent where the map can't pan. */
  onPanMap?(): void;
  /** Drop the pin and return to searching. */
  onUnpin?(): void;
}) {
  const [onMap, setOnMap] = useState(false);
  const { runtime } = useDemo();
  const [query, setQuery] = useState(initialQuery);
  const [draft, setDraft] = useState({ key: '', value: '' });
  const [lookup, setLookup] = useState<{
    key: string;
    address: string;
    error?: string;
  }>({ key: '', address: '' });
  const [results, setResults] = useState<Stop[]>([]),
    [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string>();
  const [denied, setDenied] = useState(false);
  const [maps] = useState(() => runtime?.maps ?? createMapService());
  const pending = useRef<AbortController | null>(null);
  const pinKey = JSON.stringify(pin);
  const address =
    draft.key === pinKey
      ? draft.value
      : lookup.key === pinKey
        ? lookup.address
        : '';
  const lookupBusy = pin !== null && lookup.key !== pinKey;
  const lookupError = lookup.key === pinKey ? lookup.error : undefined;
  useEffect(() => {
    const abort = new AbortController();
    const point = JSON.parse(pinKey) as Coordinate | null;
    // Wait for the map to settle: the public geocoder allows ~1 request/second.
    const timer = setTimeout(() => {
      if (point)
        void maps
          .reverse(point, abort.signal)
          .then((stop) => {
            if (!abort.signal.aborted)
              setLookup({ key: pinKey, address: stop?.address ?? '' });
          })
          .catch(() => {
            if (!abort.signal.aborted)
              setLookup({
                key: pinKey,
                address: '',
                error:
                  'Address lookup is unavailable. Type a landmark for this pin.',
              });
          });
    }, 500);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [pinKey, maps]);
  // A suggested place arrives as search text: look it up straight away.
  const searchedInitial = useRef(false);
  useEffect(() => {
    if (initialQuery.trim().length >= 3 && !searchedInitial.current) {
      searchedInitial.current = true;
      void search();
    }
    // Runs once for the initial text only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => () => pending.current?.abort(), []);
  // Search as you type: results appear once typing pauses, so there's no
  // separate search button to find. The pause also respects the public
  // geocoder's limit of about one request per second.
  const typing = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (typing.current) clearTimeout(typing.current);
    },
    [],
  );
  function type(text: string) {
    setQuery(text);
    if (typing.current) clearTimeout(typing.current);
    if (text.trim().length < 3) {
      pending.current?.abort();
      setResults([]);
      setSearched(false);
      setBusy(false);
      return;
    }
    typing.current = setTimeout(() => void search(text), 800);
  }
  async function search(text = query) {
    pending.current?.abort();
    const abort = new AbortController();
    pending.current = abort;
    setBusy(true);
    setError(undefined);
    setSearched(false);
    try {
      const results = await maps.search(text, abort.signal);
      if (!abort.signal.aborted) {
        setResults(results);
        setSearched(true);
      }
    } catch (error) {
      if (!abort.signal.aborted) setError(safeError(error).message);
    } finally {
      if (!abort.signal.aborted) setBusy(false);
    }
  }
  async function locate() {
    if (runtime) {
      onPin(demoPlaces[0].location.coordinates);
      return;
    }
    pending.current?.abort();
    const abort = new AbortController();
    pending.current = abort;
    setBusy(true);
    setError(undefined);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (abort.signal.aborted) return;
      if (!permission.granted) {
        setDenied(true);
        return;
      }
      setDenied(false);
      const result = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      if (!abort.signal.aborted)
        onPin([result.coords.longitude, result.coords.latitude]);
    } catch {
      if (!abort.signal.aborted)
        setError(
          'Your location is unavailable. Search for a place or choose a pin on the map.',
        );
    } finally {
      if (!abort.signal.aborted) setBusy(false);
    }
  }
  const pinned = pin !== null;
  return (
    <>
      <Text variant="title" accessibilityRole="header">
        {pinned
          ? kind === 'pickup'
            ? 'Set pickup location'
            : 'Set destination'
          : kind === 'pickup'
            ? 'Where from?'
            : 'Where to?'}
      </Text>
      {pinned ? (
        <>
          <Input
            label="Address or landmark for this pin"
            value={address}
            placeholder={
              lookupBusy ? 'Looking up this place…' : 'e.g. Westfield Junction'
            }
            prefix={<Icon name="pin" size={20} color={colors.brand} />}
            onChangeText={(value) => setDraft({ key: pinKey, value })}
            maxLength={120}
          />
          <View style={styles.hint}>
            <Icon name="move" size={16} color={colors.secondary} />
            <Text variant="caption" tone="secondary">
              {panning
                ? 'Move the map to adjust the pin.'
                : 'Tap the map to move the pin.'}
            </Text>
          </View>
          <Button
            label={kind === 'pickup' ? 'Confirm pickup' : 'Confirm destination'}
            disabled={!address.trim() || busy || lookupBusy}
            onPress={() => {
              try {
                onConfirm(makeStop(address, pin));
              } catch (error) {
                setError(safeError(error).message);
              }
            }}
          />
        </>
      ) : (
        <>
          <Input
            label={kind === 'pickup' ? 'Pickup' : 'Destination'}
            placeholder={
              kind === 'pickup'
                ? 'Search pickup point'
                : 'Search a place or landmark'
            }
            prefix={
              <Icon
                name={kind === 'pickup' ? 'pin' : 'search'}
                size={20}
                color={colors.brand}
              />
            }
            value={query}
            onChangeText={type}
            returnKeyType="search"
            onSubmitEditing={() => {
              if (typing.current) clearTimeout(typing.current);
              void search();
            }}
            maxLength={120}
          />
          {busy && query.trim().length >= 3 && (
            <Text tone="secondary" accessibilityLiveRegion="polite">
              Searching…
            </Text>
          )}
          {searched && !results.length && (
            <Text tone="secondary">
              No places found. Try a nearby landmark or choose on the map.
            </Text>
          )}
          {results.map((stop, index) => (
            <ListRow
              key={index}
              icon="pin"
              title={stop.address}
              onPress={() => onConfirm(stop)}
            />
          ))}
          <View>
            {kind === 'pickup' && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  runtime
                    ? 'Use demo pickup location'
                    : 'Use my current location'
                }
                disabled={busy}
                onPress={() => void locate()}
                style={({ pressed }) => [
                  styles.action,
                  pressed && { opacity: 0.6 },
                ]}
              >
                <Icon name="locate" size={20} />
                <Text variant="label" style={{ flex: 1 }}>
                  {runtime
                    ? 'Use demo pickup location'
                    : 'Use my current location'}
                </Text>
                <Icon name="arrowRight" size={18} />
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Choose on map"
              onPress={() => (onPanMap ? onPanMap() : setOnMap(true))}
              style={({ pressed }) => [
                styles.action,
                pressed && { opacity: 0.6 },
              ]}
            >
              <Icon name="map" size={20} color={colors.brand} />
              <Text variant="label" style={{ flex: 1 }}>
                Choose on map
              </Text>
              <Icon name="arrowRight" size={18} />
            </Pressable>
          </View>
          {onMap && (
            <View style={styles.hint}>
              <Icon name="move" size={16} color={colors.secondary} />
              <Text variant="caption" tone="secondary">
                Tap the map where you want the pin.
              </Text>
            </View>
          )}
          {runtime && !searched && (
            <>
              <SectionLabel>Demo places</SectionLabel>
              {demoPlaces.map((stop) => (
                <ListRow
                  key={stop.address}
                  icon="pin"
                  title={stop.address}
                  subtitle="Demo place"
                  onPress={() => onConfirm(stop)}
                />
              ))}
            </>
          )}
          {!runtime && !searched && recent.length > 0 && (
            <>
              <SectionLabel>Recent places</SectionLabel>
              {recent.map((stop) => {
                const [name, ...rest] = stop.address.split(',');
                return (
                  <ListRow
                    key={stop.address}
                    icon="pin"
                    title={name!.trim()}
                    subtitle={rest.join(',').trim() || undefined}
                    onPress={() => onConfirm(stop)}
                  />
                );
              })}
            </>
          )}
          {denied && (
            <>
              <Text>
                Location permission is off. You can still search or choose on
                the map.
                {Platform.OS === 'web'
                  ? ' To enable location, update this site’s browser permissions.'
                  : ' Enable location in your device settings to use GPS.'}
              </Text>
              {Platform.OS !== 'web' && (
                <Button
                  label="Open location settings"
                  variant="secondary"
                  onPress={() => void Linking.openSettings()}
                />
              )}
            </>
          )}
        </>
      )}
      {(error || lookupError) && (
        <Text tone="error" accessibilityLiveRegion="polite">
          {error ?? lookupError}
        </Text>
      )}
      <Button
        label="Go back"
        variant="secondary"
        onPress={pinned && onUnpin ? onUnpin : onClose}
      />
    </>
  );
}

const styles = StyleSheet.create({
  hint: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 48,
  },
});
