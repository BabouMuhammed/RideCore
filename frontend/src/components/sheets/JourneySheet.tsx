import type { PropsWithChildren } from 'react';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme/tokens';
export function JourneySheet({ children }: PropsWithChildren) {
  const insets = useSafeAreaInsets();
  return (
    <BottomSheet
      index={0}
      snapPoints={['42%', '85%']}
      enableDynamicSizing={false}
      enablePanDownToClose={false}
      topInset={insets.top + 50}
      keyboardBehavior="interactive"
      android_keyboardInputMode="adjustResize"
      backgroundStyle={{ backgroundColor: colors.surface }}
      handleIndicatorStyle={{ backgroundColor: colors.border }}
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
