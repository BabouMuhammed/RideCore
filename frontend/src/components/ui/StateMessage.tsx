import { StyleSheet, View } from 'react-native';
import { space } from '../../theme/tokens';
import { Text } from './Text';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';
export function StateMessage({
  title,
  description,
  kind = 'empty',
  icon,
  action,
}: {
  title: string;
  description: string;
  kind?: 'empty' | 'error';
  icon?: IconName;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View
      style={styles.container}
      accessibilityLiveRegion={kind === 'error' ? 'polite' : 'none'}
    >
      <Icon name={icon ?? (kind === 'error' ? 'error' : 'pin')} size={32} />
      <Text variant="heading" style={styles.center}>
        {title}
      </Text>
      <Text tone="secondary" style={styles.center}>
        {description}
      </Text>
      {action && <Button label={action.label} onPress={action.onPress} />}
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    gap: space.lg,
    alignItems: 'center',
    paddingVertical: space.xxl,
  },
  center: { textAlign: 'center' },
});
