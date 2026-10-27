import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { AuthStackParams } from './types';
import { WelcomeScreen } from '../features/auth/screens/WelcomeScreen';
import { SignInScreen } from '../features/auth/screens/SignInScreen';
import { RegisterScreen } from '../features/auth/screens/RegisterScreen';
const Stack = createNativeStackNavigator<AuthStackParams>();
export function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'none' }}>
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="SignIn" component={SignInScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
  );
}
