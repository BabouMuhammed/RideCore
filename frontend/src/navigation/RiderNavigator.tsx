import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '../components/ui/Icon';
import { colors, size, space, type } from '../theme/tokens';
import { HomeScreen } from '../features/home/screens/HomeScreen';
import { ServicesScreen } from '../features/home/screens/ServicesScreen';
import { ActivityScreen } from '../features/activity/screens/ActivityScreen';
import { AccountScreen } from '../features/account/screens/AccountScreen';
import type { RiderTabParams } from './types';
const Tab = createBottomTabNavigator<RiderTabParams>();
const icons: Record<keyof RiderTabParams, IconName> = {
  Home: 'home',
  Services: 'services',
  Activity: 'activity',
  Account: 'account',
};
export function RiderNavigator() {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.secondary,
        tabBarLabelStyle: { ...type.caption, fontWeight: '600' },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: size.touch + space.md + insets.bottom,
          paddingTop: space.sm,
          paddingBottom: Math.max(insets.bottom, space.xs),
        },
        tabBarIcon: ({ color }) => (
          <Icon name={icons[route.name]} color={color} />
        ),
        tabBarHideOnKeyboard: true,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Services" component={ServicesScreen} />
      <Tab.Screen name="Activity" component={ActivityScreen} />
      <Tab.Screen name="Account" component={AccountScreen} />
    </Tab.Navigator>
  );
}
