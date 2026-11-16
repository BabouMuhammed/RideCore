import type { PropsWithChildren } from 'react';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme/tokens';
export function JourneySheet({ children }: PropsWithChildren) {
  const insets = useSafeAreaInsets();
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
      handleIndicatorStyle={{ backgroundColor: '#CBCBCB', width: 36 }}
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
