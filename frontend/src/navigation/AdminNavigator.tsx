import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AdminTabParams } from './types';
import { Icon, type IconName } from '../components/ui/Icon';
import { colors, fonts, size, space, type } from '../theme/tokens';
import { AdminProvider } from '../features/admin/AdminProvider';
import {
  AdminOverviewScreen,
  AdminDriversScreen,
  AdminRidesScreen,
  AdminUsersScreen,
  AdminPaymentsScreen,
} from '../features/admin/AdminScreens';
const Tab = createBottomTabNavigator<AdminTabParams>();
const icons: Record<keyof AdminTabParams, IconName> = {
  Overview: 'home',
  Drivers: 'car',
  Rides: 'activity',
  Users: 'account',
  Payments: 'wallet',
};
export function AdminNavigator() {
  const insets = useSafeAreaInsets();
  return (
    <AdminProvider>
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
          tabBarIcon: ({ color }) => (
            <Icon name={icons[route.name]} color={color} />
          ),
          tabBarHideOnKeyboard: true,
        })}
      >
        <Tab.Screen name="Overview" component={AdminOverviewScreen} />
        <Tab.Screen name="Drivers" component={AdminDriversScreen} />
        <Tab.Screen name="Rides" component={AdminRidesScreen} />
        <Tab.Screen name="Users" component={AdminUsersScreen} />
        <Tab.Screen name="Payments" component={AdminPaymentsScreen} />
      </Tab.Navigator>
    </AdminProvider>
  );
}
