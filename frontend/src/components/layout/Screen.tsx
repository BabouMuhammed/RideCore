import type { PropsWithChildren, ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { colors, size, space } from '../../theme/tokens';
export function Screen({
  children,
  scroll = true,
  edges = ['top', 'right', 'bottom', 'left'],
  header,
}: PropsWithChildren<{ scroll?: boolean; edges?: Edge[]; header?: ReactNode }>) {
  // A header draws behind the status bar itself, so the top inset is its job.
  const safeEdges = header ? edges.filter((edge) => edge !== 'top') : edges;
  const body = <View style={styles.content}>{children}</View>;
  return (
    <SafeAreaView style={styles.safe} edges={safeEdges}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {scroll ? (
          <ScrollView
            style={styles.flex}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={header ? styles.grow : styles.content}
          >
            {header ? (
              <>
                {header}
                {body}
              </>
            ) : (
              children
            )}
          </ScrollView>
        ) : (
          <>
            {header}
            {body}
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1, minHeight: 0 },
  grow: { flexGrow: 1 },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: size.contentMax,
    alignSelf: 'center',
    padding: space.xl,
    gap: space.xl,
  },
});
