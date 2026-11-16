import type { NavigatorScreenParams } from '@react-navigation/native';
export type AuthStackParams = {
  Welcome: undefined;
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
  Auth: NavigatorScreenParams<AuthStackParams> | undefined;
  Rider: NavigatorScreenParams<RiderStackParams> | undefined;
  Driver: NavigatorScreenParams<DriverStackParams> | undefined;
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
