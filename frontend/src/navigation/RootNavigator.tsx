import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParams, RiderStackParams } from './types';
import { AuthNavigator } from './AuthNavigator';
import { RiderNavigator } from './RiderNavigator';
import { BootstrapScreen } from '../features/session/BootstrapScreen';
import { useSession } from '../features/session/SessionProvider';
import { PhoneVerificationScreen } from '../features/auth/screens/PhoneVerificationScreen';
import { JourneyProvider } from '../features/journey/JourneyProvider';
const Stack = createNativeStackNavigator<RootStackParams>();
const RiderStack = createNativeStackNavigator<RiderStackParams>();
function AuthenticatedNavigator() {
  return (
    <JourneyProvider>
      <RiderStack.Navigator
        screenOptions={{ headerShown: false, animation: 'none' }}
      >
        <RiderStack.Screen name="Tabs" component={RiderNavigator} />
        <RiderStack.Screen
          name="PhoneVerification"
          component={PhoneVerificationScreen}
        />
      </RiderStack.Navigator>
    </JourneyProvider>
  );
}
export function RootNavigator() {
  const { state } = useSession();
  if (state.stage !== 'ready' && state.stage !== 'anonymous')
    return <BootstrapScreen />;
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'none' }}>
      {state.stage === 'ready' ? (
        <Stack.Screen name="Rider" component={AuthenticatedNavigator} />
      ) : (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      )}
    </Stack.Navigator>
  );
}
