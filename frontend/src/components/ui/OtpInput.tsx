import { useRef, useState, type ComponentRef } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { colors, fonts, radius, space } from '../../theme/tokens';
import { Text } from './Text';

/**
 * The Figma "OTP input": one box per digit; the next box to fill is
 * highlighted. Underneath is a single real TextInput, so typing, pasting
 * a whole code, SMS autofill and screen readers all behave normally.
 */
export function OtpInput({
  value,
  onChange,
  length = 6,
  editable = true,
  onSubmit,
  label = 'Verification code',
}: {
  value: string;
  onChange(value: string): void;
  length?: number;
  editable?: boolean;
  onSubmit?(): void;
  label?: string;
}) {
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const [focused, setFocused] = useState(false);
  const digits = value.split('').slice(0, length);
  const active = Math.min(digits.length, length - 1);
  return (
    <Pressable
      onPress={() => input.current?.focus()}
      accessible={false}
      style={styles.row}
    >
      {Array.from({ length }, (_, index) => {
        const isActive = focused && index === active;
        return (
          <View
            key={index}
            style={[
              styles.box,
              isActive && styles.boxActive,
              !editable && { opacity: 0.6 },
            ]}
          >
            {digits[index] ? (
              <Text style={styles.digit}>{digits[index]}</Text>
            ) : isActive ? (
              <View style={styles.caret} />
            ) : null}
          </View>
        );
      })}
      <TextInput
        ref={input}
        value={value}
        onChangeText={(text) => onChange(text.replace(/\D/g, '').slice(0, length))}
        accessibilityLabel={label}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={length}
        editable={editable}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        returnKeyType="done"
        onSubmitEditing={onSubmit}
        caretHidden
        style={styles.hidden}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm },
  box: {
    flex: 1,
    height: 60,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.neutral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxActive: { borderColor: colors.brand, backgroundColor: colors.brandSoft },
  digit: { fontFamily: fonts.medium, fontSize: 24, lineHeight: 30, color: colors.text },
  caret: { width: 1.5, height: 24, backgroundColor: colors.brand },
  // Covers the boxes so a tap anywhere focuses it; visually hidden.
  hidden: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
    color: 'transparent',
  },
});
