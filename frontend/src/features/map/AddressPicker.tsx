import { useEffect, useRef, useState } from 'react';
import { Linking, Platform } from 'react-native';
import * as Location from 'expo-location';
import { Input } from '../../components/ui/Input';
import { Text } from '../../components/ui/Text';
import { Button } from '../../components/ui/Button';
import { ListRow } from '../../components/ui/ListRow';
import { createMapService, makeStop } from '../../services/mapbox';
import type { Coordinate, Stop } from '../../services/journey-api';
import { safeError } from '../../services/errors';
export function AddressPicker({
  kind,
  pin,
  onPin,
  onConfirm,
  onClose,
}: {
  kind: 'pickup' | 'destination';
  pin: Coordinate | null;
  onPin(point: Coordinate): void;
  onConfirm(stop: Stop): void;
  onClose(): void;
}) {
  const [query, setQuery] = useState('');
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
  const [maps] = useState(createMapService);
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
                'Address lookup is unavailable. Enter a pickup point or landmark for this pin.',
            });
        });
    return () => abort.abort();
  }, [pinKey, maps]);
  useEffect(() => () => pending.current?.abort(), []);
  async function search() {
    pending.current?.abort();
    const abort = new AbortController();
    pending.current = abort;
    setBusy(true);
    setError(undefined);
    setSearched(false);
    try {
      const results = await maps.search(query, abort.signal);
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
  return (
    <>
      <Text variant="heading">
        {kind === 'pickup' ? 'Choose your pickup' : 'Where are you going?'}
      </Text>
      <Input
        label="Search address or landmark"
        value={query}
        onChangeText={setQuery}
        returnKeyType="search"
        onSubmitEditing={() => void search()}
        maxLength={120}
      />
      <Button
        label="Search places"
        loading={busy}
        disabled={query.trim().length < 3}
        onPress={() => void search()}
      />
      <Button
        label="Use my current location"
        variant="secondary"
        disabled={busy}
        onPress={() => void locate()}
      />
      {denied && (
        <>
          <Text>
            Location permission is off. You can still search or choose a map
            pin.
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
      {searched && !results.length && (
        <Text>No places found. Try a nearby landmark or choose a map pin.</Text>
      )}
      {results.map((stop, index) => (
        <ListRow
          key={index}
          title={stop.address}
          onPress={() => onConfirm(stop)}
        />
      ))}
      <Text tone="secondary">
        Tap the street map to place a pin, then confirm its address or landmark.
      </Text>
      {pin && (
        <>
          <Input
            label="Address or landmark for this pin"
            value={address}
            onChangeText={(value) => setDraft({ key: pinKey, value })}
            maxLength={120}
          />
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
      )}
      {(error || lookupError) && (
        <Text tone="error" accessibilityLiveRegion="polite">
          {error ?? lookupError}
        </Text>
      )}
      <Button label="Go back" variant="secondary" onPress={onClose} />
    </>
  );
}
