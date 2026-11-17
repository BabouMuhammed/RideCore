import type { NavigatorScreenParams } from '@react-navigation/native';
export type AuthStackParams = {
  Welcome: undefined;
  AdminSignIn: undefined;
  SignIn: { created?: boolean; email?: string } | undefined;
  Register: undefined;
  ServerSettings: undefined;
};
export type RiderTabParams = {
  Home: { service?: import('../services/journey-api').Category } | undefined;
  Services: undefined;
  Activity: undefined;
  Account: undefined;
};
export type RootStackParams = {
  Admin: undefined;
  Auth: NavigatorScreenParams<AuthStackParams> | undefined;
  Rider: NavigatorScreenParams<RiderStackParams> | undefined;
  Driver: NavigatorScreenParams<DriverStackParams> | undefined;
};
export type AdminTabParams = {
  Overview: undefined;
  Drivers: undefined;
  Rides: undefined;
  Users: undefined;
  Payments: undefined;
};

export type DriverTabParams = {
  Drive: undefined;
  Trips: undefined;
  Account: undefined;
};
export type DriverStackParams = {
  DriverTabs: NavigatorScreenParams<DriverTabParams> | undefined;
  PhoneVerification: undefined;
};

export type RiderStackParams = {
  Tabs: NavigatorScreenParams<RiderTabParams> | undefined;
  PhoneVerification: undefined;
};
