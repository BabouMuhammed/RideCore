import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '../../../components/ui/Text';
import { Button } from '../../../components/ui/Button';
import { colors, radius, size, space } from '../../../theme/tokens';

const reasons = [
  'Rider not at pickup',
  'Rider asked me to cancel',
  'Vehicle problem',
  'Pickup location is unsafe',
  'Other',
];

export function DriverCancel({
  busy,
  onCancel,
  onClose,
}: {
  busy: boolean;
  onCancel(reason: string): void;
  onClose(): void;
}) {
  const [reason, setReason] = useState<string | null>(null);
  return (
    <>
      <Text variant="heading" accessibilityRole="header">
        Cancel this ride?
      </Text>
      <Text tone="secondary">
        The rider is told straight away. Choose a reason.
      </Text>
      <View accessibilityRole="radiogroup" style={{ gap: space.sm }}>
        {reasons.map((option) => {
          const checked = reason === option;
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityState={{ checked, disabled: busy }}
              disabled={busy}
              onPress={() => setReason(option)}
              style={{
                minHeight: size.touch,
                justifyContent: 'center',
                paddingHorizontal: space.lg,
                borderRadius: radius.md,
                borderWidth: 2,
                borderColor: checked ? colors.brand : colors.border,
                backgroundColor: checked ? colors.brandSoft : colors.surface,
              }}
            >
              <Text variant="label">{option}</Text>
            </Pressable>
          );
        })}
      </View>
      <Button
        label="Cancel ride"
        variant="destructive"
        disabled={!reason || busy}
        onPress={() => reason && onCancel(reason)}
      />
      <Button label="Keep the ride" variant="secondary" onPress={onClose} />
    </>
  );
}
