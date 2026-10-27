import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  type PropsWithChildren,
} from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, space } from '../../theme/tokens';
import { Text } from '../ui/Text';
import { IconButton } from '../ui/IconButton';

type Props = PropsWithChildren<{ title: string; onDismiss?: () => void }>;
export const AppSheet = forwardRef<BottomSheetModal, Props>(function AppSheet(
  { title, children, onDismiss },
  ref,
) {
  const insets = useSafeAreaInsets();
  const modal = useRef<BottomSheetModal>(null);
  const backSubscription = useRef<ReturnType<
    typeof BackHandler.addEventListener
  > | null>(null);
  useEffect(() => () => backSubscription.current?.remove(), []);
  const backdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.45}
        pressBehavior="close"
      />
    ),
    [],
  );
  return (
    <BottomSheetModal
      ref={(instance) => {
        modal.current = instance;
        if (typeof ref === 'function') ref(instance);
        else if (ref) ref.current = instance;
      }}
      topInset={insets.top}
      enableDynamicSizing
      enablePanDownToClose
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      backdropComponent={backdrop}
      backgroundStyle={styles.surface}
      handleIndicatorStyle={styles.handle}
      onChange={(index) => {
        backSubscription.current?.remove();
        if (index >= 0)
          backSubscription.current = BackHandler.addEventListener(
            'hardwareBackPress',
            () => {
              modal.current?.dismiss();
              return true;
            },
          );
      }}
      onDismiss={() => {
        backSubscription.current?.remove();
        onDismiss?.();
      }}
    >
      <BottomSheetScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, space.xl) },
        ]}
      >
        <View style={styles.header}>
          <Text variant="heading" accessibilityRole="header">
            {title}
          </Text>
          <IconButton
            icon="close"
            label="Close"
            onPress={() => modal.current?.dismiss()}
          />
        </View>
        {children}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
});
const styles = StyleSheet.create({
  surface: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
  },
  handle: { backgroundColor: colors.border, width: 40 },
  content: { paddingHorizontal: space.xl, gap: space.lg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.lg,
  },
});
