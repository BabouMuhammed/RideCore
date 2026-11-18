import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, View } from 'react-native';
import { Button } from '../../../components/ui/Button';
import { Icon } from '../../../components/ui/Icon';
import { Text } from '../../../components/ui/Text';
import { colors, fonts } from '../../../theme/tokens';
import { requestTimeoutSeconds } from '../presentation';

// What the rider sees while a request is open. Instead of a bare spinner,
// it narrates the real stages of matching (sent → drivers notified → a
// driver confirming) so the wait feels like progress. Every message is
// true at the moment it shows: driver counts come from the server.
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
  const elapsed = Math.max(0, (now - start) / 1000);
  const finished = now >= end;

  // When the window closes, ask once for the outcome instead of waiting
  // for the next scheduled check.
  const asked = useRef(false);
  useEffect(() => {
    if (finished && !asked.current) {
      asked.current = true;
      onCheck();
    }
  }, [finished, onCheck]);

  const message = searchMessage(elapsed, nearbyDrivers, finished);
  const notified =
    nearbyDrivers === null
      ? 'Finding drivers near you'
      : nearbyDrivers === 0
        ? 'No drivers online nearby yet'
        : `${nearbyDrivers} nearby ${nearbyDrivers === 1 ? 'driver' : 'drivers'} notified`;

  return (
    <View style={styles.wrap}>
      <View
        style={styles.headline}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel="Finding your driver"
      >
        <FindingDots />
        <FadeText text={message.title} />
        <Text tone="secondary" accessibilityLiveRegion="polite">
          {message.detail}
        </Text>
      </View>
      <View style={styles.steps}>
        <Step state="done" label="Request sent" />
        <Step
          state={
            nearbyDrivers === null
              ? 'active'
              : nearbyDrivers === 0
                ? 'waiting'
                : 'done'
          }
          label={notified}
        />
        <Step
          state={nearbyDrivers ? 'active' : 'pending'}
          label="Waiting for a driver to accept"
        />
      </View>
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

/** The changing headline: grounded in elapsed time and the driver count. */
export function searchMessage(
  elapsed: number,
  nearbyDrivers: number | null,
  finished = false,
) {
  if (finished)
    return { title: 'Wrapping up', detail: 'Checking for a last answer.' };
  if (elapsed < 3)
    return {
      title: 'Sending your request',
      detail: 'Connecting you with drivers nearby.',
    };
  if (nearbyDrivers === 0)
    return {
      title: 'Looking for drivers near you',
      detail: 'None are online nearby right now. We’ll keep looking.',
    };
  if (elapsed < 10)
    return {
      title: nearbyDrivers
        ? `Notifying ${nearbyDrivers} ${nearbyDrivers === 1 ? 'driver' : 'drivers'} near you`
        : 'Looking for drivers near you',
      detail: 'Your request is on their screens now.',
    };
  if (elapsed < 25)
    return {
      title: 'Waiting for a driver to accept',
      detail: 'Drivers nearby can see your pickup, destination and fare.',
    };
  if (elapsed < 45)
    return {
      title: 'Your request is still with nearby drivers',
      detail: 'The first driver to accept is matched with you.',
    };
  return {
    title: 'Still looking',
    detail: 'Nearby drivers may be finishing a trip. Hang on.',
  };
}

function Step({
  state,
  label,
}: {
  state: 'done' | 'active' | 'waiting' | 'pending';
  label: string;
}) {
  return (
    <View style={styles.step}>
      <View
        style={[
          styles.marker,
          state === 'done' && styles.markerDone,
          (state === 'active' || state === 'waiting') && styles.markerActive,
        ]}
      >
        {state === 'done' ? (
          <Icon name="check" size={12} color={colors.surface} />
        ) : state === 'active' ? (
          <Pulse />
        ) : null}
      </View>
      <Text
        variant="caption"
        tone={state === 'pending' ? 'muted' : 'primary'}
        style={state === 'active' ? styles.activeLabel : undefined}
      >
        {label}
      </Text>
    </View>
  );
}

/** Message changes cross-fade rather than snap. */
function FadeText({ text }: { text: string }) {
  const [opacity] = useState(() => new Animated.Value(1));
  const [shown, setShown] = useState(text);
  useEffect(() => {
    if (text === shown) return;
    Animated.timing(opacity, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      setShown(text);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }).start();
    });
  }, [text, shown, opacity]);
  return (
    <Animated.View style={{ opacity }}>
      <Text variant="heading" accessibilityRole="header">
        {shown}
      </Text>
    </Animated.View>
  );
}

/** Three pulsing dots, the familiar "working on it" signal. */
export function FindingDots() {
  const [dots] = useState(() => [0, 1, 2].map(() => new Animated.Value(0.3)));
  const [still, setStill] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled()
      .then(setStill)
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    if (still) return;
    const loop = Animated.loop(
      Animated.stagger(
        160,
        dots.map((dot) =>
          Animated.sequence([
            Animated.timing(dot, {
              toValue: 1,
              duration: 320,
              useNativeDriver: true,
            }),
            Animated.timing(dot, {
              toValue: 0.3,
              duration: 320,
              useNativeDriver: true,
            }),
          ]),
        ),
      ),
    );
    loop.start();
    return () => loop.stop();
  }, [dots, still]);
  return (
    <View style={styles.dots} importantForAccessibility="no-hide-descendants">
      {dots.map((dot, index) => (
        <Animated.View
          key={index}
          style={[styles.dot, { opacity: still ? 0.7 : dot }]}
        />
      ))}
    </View>
  );
}

function Pulse() {
  const [value] = useState(() => new Animated.Value(0.4));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(value, {
          toValue: 0.4,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [value]);
  return <Animated.View style={[styles.pulse, { opacity: value }]} />;
}

const styles = StyleSheet.create({
  wrap: { gap: 18, paddingTop: 4 },
  headline: { gap: 6 },
  dots: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.brand,
  },
  steps: { gap: 12 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  marker: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerDone: { backgroundColor: colors.brand, borderColor: colors.brand },
  markerActive: { borderColor: colors.brand },
  pulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.brand,
  },
  activeLabel: { fontFamily: fonts.semibold },
});
