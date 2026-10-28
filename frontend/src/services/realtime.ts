import { io } from 'socket.io-client';
import { coordinate, type Coordinate } from './journey-api';
export const rideEvents = [
  'ride:accepted',
  'ride:driver-arriving',
  'ride:driver-arrived',
  'ride:started',
  'ride:completed',
  'ride:cancelled',
] as const;
export type LocationSample = { point: Coordinate; timestamp: string };
export type RideWatcher = (
  token: string,
  rideId: string,
  handlers: {
    changed(): void;
    location(sample: LocationSample): void;
    connection(connected: boolean): void;
  },
) => () => void;
export function socketOrigin(base = process.env.EXPO_PUBLIC_API_URL) {
  if (!base) throw new Error('Missing API configuration');
  return base.trim().replace(/\/api\/?$/, '');
}
export const watchRide: RideWatcher = (token, rideId, handlers) => {
  const socket = io(socketOrigin(), {
    auth: { token },
    forceNew: true,
    autoConnect: false,
    timeout: 10000,
  });
  let closed = false;
  socket.on('connect', () => {
    // Rejoin before reconciling: REST covers anything missed while disconnected.
    socket
      .timeout(10000)
      .emit(
        'ride:join',
        { rideId },
        (error: Error | null, reply: { success?: boolean } | undefined) => {
          if (closed) return;
          handlers.connection(!error && reply?.success === true);
          handlers.changed();
        },
      );
  });
  socket.on('disconnect', () => {
    handlers.connection(false);
    if (!closed && !socket.active) handlers.changed(); // REST checks expired/revoked identity.
  });
  socket.on('connect_error', () => {
    handlers.connection(false);
    handlers.changed();
  });
  for (const event of rideEvents)
    socket.on(event, (data: { rideId?: string }) => {
      if (data?.rideId === rideId) handlers.changed();
    });
  socket.on(
    'driver:location',
    (value: {
      rideId?: string;
      longitude?: number;
      latitude?: number;
      timestamp?: string;
    }) => {
      if (
        value?.rideId !== rideId ||
        typeof value.timestamp !== 'string' ||
        !Number.isFinite(Date.parse(value.timestamp))
      )
        return;
      try {
        handlers.location({
          point: coordinate([value.longitude, value.latitude]),
          timestamp: value.timestamp,
        });
      } catch {
        /* Ignore malformed tracking samples, never synthesize movement. */
      }
    },
  );
  socket.connect();
  return () => {
    closed = true;
    socket.removeAllListeners();
    socket.disconnect();
  };
};
