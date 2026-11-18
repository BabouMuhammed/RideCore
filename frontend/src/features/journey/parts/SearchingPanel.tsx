import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '../../../components/ui/Button';
import { Text } from '../../../components/ui/Text';
import { colors, radius } from '../../../theme/tokens';
import { requestTimeoutSeconds } from '../presentation';

// What the rider sees while a request is open: how long the search has run,
// how much of the search window is left, and whether any drivers are nearby.
export function SearchingPanel({
  requestedAt,
  expiresAt,
  nearbyDrivers,
  onCheck,
  checking,
  now: fixedNow,
}: {
  requestedAt: string;
  expiresAt?: string;
  nearbyDrivers: number | null;
  onCheck: () => void;
  checking?: boolean;
  /** Test hook: a fixed clock instead of the ticking one. */
  now?: number;
}) {
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    if (fixedNow !== undefined) return;
    const timer = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [fixedNow]);
  const now = fixedNow ?? tick;
  const start = Date.parse(requestedAt);
  const end = expiresAt
    ? Date.parse(expiresAt)
    : start + requestTimeoutSeconds * 1000;
  const elapsed = Math.max(0, Math.floor((now - start) / 1000));
  const total = Math.max(1, Math.round((end - start) / 1000));
  const left = Math.max(0, total - elapsed);
  const finished = left === 0;
  const share = Math.min(1, elapsed / total);

  // When the window closes, ask once for the outcome instead of waiting
  // for the next scheduled check.
  const asked = useRef(false);
  useEffect(() => {
    if (finished && !asked.current) {
      asked.current = true;
      onCheck();
    }
  }, [finished, onCheck]);

  const minutes = Math.round(total / 60);
  const status =
    nearbyDrivers === null
      ? 'Checking for drivers near your pickup…'
      : nearbyDrivers === 0
        ? 'No drivers are online near your pickup right now.'
        : `${nearbyDrivers} ${nearbyDrivers === 1 ? 'driver' : 'drivers'} nearby can see your request.`;
  const hint = finished
    ? 'Closing this search…'
    : nearbyDrivers === 0
      ? `We’ll keep looking for ${clock(left)} in case a driver comes online.`
      : elapsed >= 45 && nearbyDrivers
        ? 'Nearby drivers may be finishing other trips. Hang on.'
        : `We’ll keep looking for up to ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}.`;

  return (
    <View style={styles.wrap}>
      <View
        style={styles.track}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel="Searching for a driver"
        accessibilityValue={{ min: 0, max: total, now: elapsed }}
      >
        <View style={[styles.fill, { width: `${share * 100}%` }]} />
      </View>
      <View style={styles.timeRow}>
        <Text variant="caption" tone="secondary">
          Searching
        </Text>
        <Text variant="label" style={styles.clock}>
          {clock(elapsed)}
        </Text>
      </View>
      <Text accessibilityLiveRegion="polite">{status}</Text>
      <Text variant="caption" tone="secondary">
        {hint}
      </Text>
      {nearbyDrivers === 0 && !finished && (
        <Button
          label="Check again"
          variant="secondary"
          disabled={checking}
          onPress={onCheck}
        />
      )}
    </View>
  );
}

export function clock(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  wrap: { gap: 10, paddingTop: 4 },
  track: {
    height: 6,
    borderRadius: radius.md,
    backgroundColor: colors.neutral,
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: colors.brand },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  clock: { fontVariant: ['tabular-nums'] },
});
