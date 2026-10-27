import { useState, type ComponentRef, type ReactNode, type Ref } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { colors, radius, size, space, type } from '../../theme/tokens';
import { Text } from './Text';
type Props = TextInputProps & {
  label: string;
  error?: string;
  hint?: string;
  prefix?: ReactNode;
  trailing?: ReactNode;
  inputRef?: Ref<ComponentRef<typeof TextInput>>;
};
export function Input({
  label,
  error,
  hint,
  prefix,
  trailing,
  inputRef,
  style,
  onFocus,
  onBlur,
  ...props
}: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrapper}>
      <Text variant="label">{label}</Text>
      <View
        style={[
          styles.frame,
          {
            borderColor: error
              ? colors.error
              : focused
                ? colors.brand
                : colors.border,
          },
        ]}
      >
        {prefix}
        <TextInput
          {...props}
          ref={inputRef}
          accessibilityLabel={props.accessibilityLabel ?? label}
          accessibilityHint={error ?? hint}
          placeholderTextColor={colors.secondary}
          selectionColor={colors.brand}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={[styles.input, style]}
        />
        {trailing}
      </View>
      {!!(error || hint) && (
        <Text
          variant="caption"
          tone={error ? 'error' : 'secondary'}
          accessibilityLiveRegion={error ? 'polite' : 'none'}
        >
          {error ?? hint}
        </Text>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  wrapper: { gap: space.sm },
  frame: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: space.sm,
  },
  input: {
    ...type.body,
    flex: 1,
    minWidth: 0,
    color: colors.text,
    minHeight: size.input,
    paddingHorizontal: space.sm,
    paddingVertical: space.md,
  },
});
