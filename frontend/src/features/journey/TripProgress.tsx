import { StyleSheet, View } from 'react-native';
import { Text } from '../../components/ui/Text';
import { Icon } from '../../components/ui/Icon';
import { colors, fonts, space } from '../../theme/tokens';
import type { Trip } from '../../services/journey-api';

// The ride lifecycle as the rider experiences it. accepted and
// driver_arriving share one step: both mean a driver is on the way.
const steps = [
  { label: 'Requested', statuses: ['requested'] },
  { label: 'Driver on the way', statuses: ['accepted', 'driver_arriving'] },
  { label: 'Arrived', statuses: ['driver_arrived'] },
  { label: 'On trip', statuses: ['in_progress'] },
  { label: 'Done', statuses: ['completed'] },
] as const satisfies readonly { label: string; statuses: readonly Trip['status'][] }[];

export function TripProgress({ status }: { status: Trip['status'] }) {
  if (status === 'cancelled') return null;
  const current = steps.findIndex((step) =>
    (step.statuses as readonly Trip['status'][]).includes(status),
  );
  const active = steps[current];
  if (!active) return null;
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`Trip progress: step ${current + 1} of ${steps.length}, ${active.label}`}
    >
      {steps.map((step, index) => {
        const done = index < current || status === 'completed';
        const now = index === current && status !== 'completed';
        return (
          <View key={step.label} style={styles.step}>
            <View style={styles.track}>
              <View
                style={[
                  styles.line,
                  index === 0 && styles.hidden,
                  index <= current && styles.lineDone,
                ]}
              />
              <View
                style={[
                  styles.dot,
                  done && styles.dotDone,
                  now && styles.dotNow,
                ]}
              >
                {done && <Icon name="check" size={14} color={colors.onBrand} />}
              </View>
              <View
                style={[
                  styles.line,
                  index === steps.length - 1 && styles.hidden,
                  index < current && styles.lineDone,
                ]}
              />
            </View>
            <Text
              variant="caption"
              style={[
                styles.label,
                now && styles.labelNow,
                !done && !now && { color: colors.secondary },
              ]}
            >
              {step.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  step: { flex: 1, alignItems: 'center', gap: space.xs },
  track: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' },
  line: { flex: 1, height: 3, backgroundColor: colors.border },
  lineDone: { backgroundColor: colors.brand },
  hidden: { opacity: 0 },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: { backgroundColor: colors.brand, borderColor: colors.brand },
  dotNow: { backgroundColor: colors.brandSoft, borderColor: colors.brand, borderWidth: 3 },
  label: { fontSize: 11, lineHeight: 14, textAlign: 'center' },
  labelNow: { fontFamily: fonts.bold, color: colors.text },
});
