import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, View } from 'react-native';
import { colors } from '../../../theme/tokens';

// Three orange dots that pulse in turn while a driver is being found.
// Motion here answers a real wait; it stops when reduced motion is on.
export function FindingDots() {
  const [values] = useState(() => [0, 1, 2].map(() => new Animated.Value(0.3)));
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduced) => {
        if (cancelled || reduced) return;
        loop = Animated.loop(
          Animated.stagger(
            180,
            values.map((value) =>
              Animated.sequence([
                Animated.timing(value, { toValue: 1, duration: 360, useNativeDriver: true }),
                Animated.timing(value, { toValue: 0.3, duration: 360, useNativeDriver: true }),
              ]),
            ),
          ),
        );
        loop.start();
      });
    return () => {
      cancelled = true;
      loop?.stop();
    };
  }, [values]);
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Searching for a driver"
    >
      {values.map((opacity, index) => (
        <Animated.View key={index} style={[styles.dot, { opacity }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, justifyContent: 'center', paddingVertical: 28 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand },
});
