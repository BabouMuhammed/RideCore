import {
  createContext,
  useContext,
  useState,
  type PropsWithChildren,
} from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../components/ui/Text';
import { createDemoRuntime, type DemoRuntime } from './runtime';

const DemoContext = createContext<{
  runtime: DemoRuntime | null;
  enter(): void;
  exit(): void;
}>({ runtime: null, enter: () => undefined, exit: () => undefined });
export const useDemo = () => useContext(DemoContext);
export function DemoProvider({ children }: PropsWithChildren) {
  const insets = useSafeAreaInsets();
  const [runtime, setRuntime] = useState<DemoRuntime | null>(() =>
    process.env.EXPO_PUBLIC_DEMO_MODE === 'true' ? createDemoRuntime() : null,
  );
  return (
    <DemoContext.Provider
      value={{
        runtime,
        enter: () => setRuntime(createDemoRuntime()),
        exit: () => setRuntime(null),
      }}
    >
      {runtime && (
        <View
          style={{
            backgroundColor: '#D5E5E3',
            paddingHorizontal: 16,
            paddingVertical: 10,
            paddingTop: insets.top + 10,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <Text variant="caption" style={{ flex: 1 }}>
            Demo mode · Sample rides, no charges
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Exit demo"
            onPress={() => setRuntime(null)}
            style={{ padding: 8 }}
          >
            <Text variant="label">Exit demo</Text>
          </Pressable>
        </View>
      )}
      <View
        key={runtime ? `demo-${runtime.instanceId}` : 'live'}
        style={{ flex: 1, minHeight: 0 }}
      >
        {children}
      </View>
    </DemoContext.Provider>
  );
}
