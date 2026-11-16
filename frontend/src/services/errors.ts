export type ErrorKind =
  | 'unavailable'
  | 'changed'
  | 'conflict'
  | 'credentials'
  | 'validation'
  | 'unauthenticated'
  | 'network'
  | 'server'
  | 'role'
  | 'otp'
  | 'cooldown'
  | 'rate'
  | 'storage'
  | 'contract'
  | 'configuration'
  | 'approval'
  | 'forbidden'
  | 'location'
  | 'taken'
  | 'cancelled';
const messages: Record<ErrorKind, string> = {
  unavailable:
    'This information is no longer available. Refresh to see the latest status.',
  changed:
    'This action is no longer available or was already processed. Refresh to see the latest status.',
  conflict: 'An account with these details may already exist. Try signing in.',
  credentials: 'The email or phone number and password do not match.',
  validation: 'Check your details and try again.',
  unauthenticated: 'Your sign-in is no longer valid. Please sign in again.',
  network: 'Unable to connect. Check your connection and try again.',
  server: 'RideCore is temporarily unavailable. Please try again.',
  role: 'This app is for rider and driver accounts. Administrators use the admin tools.',
  otp: 'The code is incorrect, expired or no longer available. Request a new code when available.',
  cooldown: 'Please wait before requesting another verification code.',
  rate: 'Too many attempts. Please wait and try again later.',
  storage: 'We could not access secure sign-in storage. Please try again.',
  contract: 'We could not restore your information. Please try again.',
  configuration: 'RideCore is unavailable right now. Please try again later.',
  approval:
    'Your driver profile and vehicle need admin approval before you can drive.',
  forbidden:
    'You can’t do that on this ride. Refresh to see the latest status.',
  location:
    'Turn on location, or tap the map to set where you are, before going online.',
  taken: 'Another driver accepted this ride, or the rider cancelled it.',
  cancelled: 'The request was cancelled.',
};
export class AppError extends Error {
  readonly kind: ErrorKind;
  constructor(
    kind: ErrorKind,
    readonly retryAfterSeconds?: number,
  ) {
    super(messages[kind]);
    this.kind = kind;
  }
}
export function safeError(error: unknown): AppError {
  return error instanceof AppError ? error : new AppError('server');
}
