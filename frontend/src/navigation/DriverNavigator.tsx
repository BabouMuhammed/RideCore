import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '../components/ui/Icon';
import { colors, fonts, size, space, type } from '../theme/tokens';
import { DriverProvider } from '../features/driver/DriverProvider';
import { DriveScreen } from '../features/driver/screens/DriveScreen';
import { DriverTripsScreen } from '../features/driver/screens/DriverTripsScreen';
import { AccountScreen } from '../features/account/screens/AccountScreen';
import { PhoneVerificationScreen } from '../features/auth/screens/PhoneVerificationScreen';
import type { DriverStackParams, DriverTabParams } from './types';

const Tab = createBottomTabNavigator<DriverTabParams>();
const Stack = createNativeStackNavigator<DriverStackParams>();
const icons: Record<keyof DriverTabParams, IconName> = {
  Drive: 'car',
  Trips: 'activity',
  Account: 'account',
};

function DriverTabs() {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.secondary,
        tabBarLabelStyle: { ...type.caption, fontFamily: fonts.semibold },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: size.touch + space.md + insets.bottom,
          paddingTop: space.sm,
          paddingBottom: Math.max(insets.bottom, space.xs),
        },
        tabBarIcon: ({ color }) => <Icon name={icons[route.name]} color={color} />,
        tabBarHideOnKeyboard: true,
      })}
    >
      <Tab.Screen name="Drive" component={DriveScreen} />
      <Tab.Screen name="Trips" component={DriverTripsScreen} />
      <Tab.Screen name="Account" component={AccountScreen} />
    </Tab.Navigator>
  );
}

export function DriverNavigator() {
  return (
    <DriverProvider>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'none' }}>
        <Stack.Screen name="DriverTabs" component={DriverTabs} />
        <Stack.Screen name="PhoneVerification" component={PhoneVerificationScreen} />
      </Stack.Navigator>
    </DriverProvider>
  );
}
