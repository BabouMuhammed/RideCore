import { useState, type ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import { Input } from '../../../components/ui/Input';
import { Text } from '../../../components/ui/Text';
import { IconButton } from '../../../components/ui/IconButton';
import { colors, space } from '../../../theme/tokens';
type Props = ComponentProps<typeof Input>;
export function PhoneInput(props: Omit<Props, 'label'>) {
  return (
    <Input
      {...props}
      label="Phone number"
      keyboardType="phone-pad"
      autoComplete="tel-national"
      textContentType="telephoneNumber"
      autoCapitalize="none"
      autoCorrect={false}
      placeholder="Enter phone number"
      prefix={
        <View
          style={styles.prefix}
          accessible
          accessibilityLabel="The Gambia, country code plus 220"
        >
          <Text variant="label">GM +220</Text>
        </View>
      }
    />
  );
}
export function PasswordInput(props: Omit<Props, 'label'>) {
  const [visible, setVisible] = useState(false);
  return (
    <Input
      {...props}
      label="Password"
      secureTextEntry={!visible}
      autoCapitalize="none"
      autoCorrect={false}
      spellCheck={false}
      trailing={
        <IconButton
          icon={visible ? 'eyeOff' : 'eye'}
          label={visible ? 'Hide password' : 'Show password'}
          onPress={() => setVisible(!visible)}
        />
      }
    />
  );
}
const styles = StyleSheet.create({
  prefix: {
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
});
