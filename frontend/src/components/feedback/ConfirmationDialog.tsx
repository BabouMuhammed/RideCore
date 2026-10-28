import { useEffect, useRef, type ComponentRef } from 'react';
import {
  AccessibilityInfo,
  findNodeHandle,
  Modal,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { colors, radius, size, space } from '../../theme/tokens';
import { Button } from '../ui/Button';
import { Text } from '../ui/Text';
export function ConfirmationDialog({
  visible,
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
  destructive = false,
  pending = false,
}: {
  visible: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
  pending?: boolean;
}) {
  const heading = useRef<ComponentRef<typeof View>>(null);
  const submitted = useRef(false);
  useEffect(() => {
    if (!visible) submitted.current = false;
  }, [visible]);
  const confirm = () => {
    if (pending || submitted.current) return;
    submitted.current = true;
    onConfirm();
  };
  // The owner dismisses on success; releasing pending on failure permits retry.
  useEffect(() => {
    if (!pending) submitted.current = false;
  }, [pending]);
  return (
    <Modal
      testID="confirmation-dialog"
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={() => {
        if (!pending) onCancel();
      }}
      onShow={() => {
        if (Platform.OS === 'web') {
          heading.current?.focus();
          return;
        }
        const node = findNodeHandle(heading.current);
        if (node) AccessibilityInfo.setAccessibilityFocus(node);
      }}
    >
      <View style={styles.scrim}>
        <View accessibilityViewIsModal style={styles.dialog}>
          <View
            ref={heading}
            {...(Platform.OS === 'web' ? { tabIndex: -1 as const } : {})}
            accessible
            accessibilityRole="header"
            accessibilityLabel={title}
          >
            <Text variant="heading">{title}</Text>
          </View>
          <Text tone="secondary">{description}</Text>
          <Button
            label={confirmLabel}
            variant={destructive ? 'destructive' : 'primary'}
            loading={pending}
            onPress={confirm}
          />
          <Button
            label="Go back"
            variant="secondary"
            disabled={pending}
            onPress={onCancel}
          />
        </View>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: colors.scrim,
    justifyContent: 'center',
    padding: space.xl,
  },
  dialog: {
    width: '100%',
    maxWidth: size.contentMax,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    padding: space.xl,
    gap: space.lg,
    borderRadius: radius.sheet,
  },
});
