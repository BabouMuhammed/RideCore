import { io } from 'socket.io-client';
import { coordinate, type Coordinate } from './journey-api';
import { apiUrl } from './server-config';
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
export function socketOrigin(base = apiUrl()) {
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
  socket.on(
    'connect_error',
    (error: Error & { data?: { status?: number } }) => {
      handlers.connection(false);
      // Network reconnect attempts must not multiply REST polling/rate usage.
      // A rejected identity still requires immediate authoritative session recovery.
      if (error.data?.status === 401) handlers.changed();
    },
  );
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

export type DriverLink = {
  /** Publish the driver's position to the rider and any trusted viewer. */
  sendLocation(point: Coordinate, heading?: number, speed?: number): void;
  close(): void;
};
/**
 * The assigned driver's connection to one ride: joins the ride room to hear
 * rider cancellations, and publishes GPS samples. The backend validates that
 * this driver is assigned and throttles what it stores.
 */
export function connectDriverRide(
  token: string,
  rideId: string,
  handlers: { changed(): void; connection(connected: boolean): void },
): DriverLink {
  const socket = io(socketOrigin(), {
    auth: { token },
    forceNew: true,
    autoConnect: false,
    timeout: 10000,
  });
  let closed = false;
  let joined = false;
  socket.on('connect', () => {
    socket
      .timeout(10000)
      .emit(
        'ride:join',
        { rideId },
        (error: Error | null, reply: { success?: boolean } | undefined) => {
          if (closed) return;
          joined = !error && reply?.success === true;
          handlers.connection(joined);
          handlers.changed();
        },
      );
  });
  socket.on('disconnect', () => {
    joined = false;
    handlers.connection(false);
  });
  socket.on('connect_error', () => handlers.connection(false));
  for (const event of rideEvents)
    socket.on(event, (data: { rideId?: string }) => {
      if (data?.rideId === rideId) handlers.changed();
    });
  socket.connect();
  return {
    sendLocation(point, heading, speed) {
      if (closed || !joined) return;
      const [longitude, latitude] = coordinate(point);
      socket.emit('driver:location:update', {
        rideId,
        latitude,
        longitude,
        ...(heading != null && heading >= 0 && heading < 360
          ? { heading }
          : {}),
        ...(speed != null && speed >= 0 && speed <= 100 ? { speed } : {}),
      });
    },
    close() {
      closed = true;
      socket.removeAllListeners();
      socket.disconnect();
    },
  };
}

export type RequestWatcher = (token: string, changed: () => void) => () => void;
/**
 * While a driver is online, the server pushes "requests:changed" the moment
 * a ride is requested, taken, cancelled or expires, so the request list is
 * refetched at once instead of waiting for the next poll. The push carries
 * no ride data; the REST list stays the source of truth.
 */
export const watchDriverRequests: RequestWatcher = (token, changed) => {
  const socket = io(socketOrigin(), {
    auth: { token },
    forceNew: true,
    autoConnect: false,
    timeout: 10000,
  });
  socket.on('requests:changed', () => changed());
  // Anything missed while disconnected is picked up on reconnect.
  socket.on('connect', () => changed());
  socket.connect();
  return () => {
    socket.removeAllListeners();
    socket.disconnect();
  };
};
