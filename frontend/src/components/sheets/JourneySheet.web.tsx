import type { PropsWithChildren } from 'react';
import { ScrollView, View } from 'react-native';
import { colors, radius, size } from '../../theme/tokens';
export function JourneySheet({
  children,
  onHeight,
}: PropsWithChildren<{ onHeight?(height: number): void }>) {
  return (
    <View
      onLayout={(event) => onHeight?.(event.nativeEvent.layout.height)}
      style={{
        position: 'absolute',
        bottom: 0,
        width: '100%',
        maxHeight: '65%',
        maxWidth: size.contentMax,
        alignSelf: 'center',
        borderTopLeftRadius: radius.sheet,
        borderTopRightRadius: radius.sheet,
        backgroundColor: colors.surface,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          width: 40,
          height: 4,
          borderRadius: 3,
          backgroundColor: colors.border,
          alignSelf: 'center',
          marginTop: 10,
        }}
      />
      <ScrollView
        style={{ minHeight: 0 }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 24, gap: 16 }}
      >
        {children}
      </ScrollView>
    </View>
  );
}
