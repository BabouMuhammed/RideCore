import type { NavigatorScreenParams } from '@react-navigation/native';
export type AuthStackParams = {
  Welcome: undefined;
  SignIn: { created?: boolean; email?: string } | undefined;
  Register: undefined;
};
export type RiderTabParams = {
  Home: undefined;
  Activity: undefined;
  Account: undefined;
};
export type RootStackParams = {
  Auth: NavigatorScreenParams<AuthStackParams> | undefined;
  Rider: NavigatorScreenParams<RiderStackParams> | undefined;
};

export type RiderStackParams = {
  Tabs: NavigatorScreenParams<RiderTabParams> | undefined;
  PhoneVerification: undefined;
};
