import { useEffect, type PropsWithChildren } from 'react';
import { useWindowDimensions } from 'react-native';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme/tokens';
export function JourneySheet({
  children,
  onHeight,
}: PropsWithChildren<{ onHeight?(height: number): void }>) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  // The sheet rests at its first snap point (55% of the window).
  useEffect(() => {
    onHeight?.(height * 0.55);
  }, [height, onHeight]);
  return (
    <BottomSheet
      index={0}
      snapPoints={['55%', '90%']}
      enableDynamicSizing={false}
      enablePanDownToClose={false}
      topInset={insets.top + 50}
      keyboardBehavior="interactive"
      android_keyboardInputMode="adjustResize"
      backgroundStyle={{
        backgroundColor: colors.surface,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
      }}
      handleIndicatorStyle={{ backgroundColor: colors.border, width: 40 }}
    >
      <BottomSheetScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: 24,
          gap: 16,
          paddingBottom: Math.max(insets.bottom, 24),
        }}
      >
        {children}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}
