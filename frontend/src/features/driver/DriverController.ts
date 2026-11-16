import { activeStatuses } from '../../services/contracts';
import type {
  DriverAccount,
  DriverApi,
  RideRequest,
  TripAction,
  VehicleInput,
} from '../../services/driver-api';
import type { Coordinate, Trip } from '../../services/journey-api';
import { AppError, safeError } from '../../services/errors';
import type { DriverLink } from '../../services/realtime';

type Runner = <T>(
  work: (token: string, signal: AbortSignal) => Promise<T>,
) => Promise<T>;
type Connect = (
  token: string,
  rideId: string,
  handlers: { changed(): void; connection(connected: boolean): void },
) => DriverLink;

export type LocationSource = 'gps' | 'map';
export type DriverState = {
  loading: boolean;
  account: DriverAccount | null;
  requests: RideRequest[];
  /** The active ride, or a just-completed one the driver hasn't closed yet. */
  ride: Trip | null;
  busy: boolean;
  connected: boolean;
  location: Coordinate | null;
  locationSource: LocationSource | null;
  error?: string;
};

export const isActiveRide = (ride: Trip | null) =>
  !!ride && (activeStatuses as readonly string[]).includes(ride.status);

/** The one next step the driver takes for each ride status. */
export function nextAction(
  status: Trip['status'],
): { action: TripAction; label: string } | null {
  switch (status) {
    case 'accepted':
      return { action: 'arriving', label: 'Head to pickup' };
    case 'driver_arriving':
      return { action: 'arrived', label: "I've arrived" };
    case 'driver_arrived':
      return { action: 'start', label: 'Start trip' };
    case 'in_progress':
      return { action: 'complete', label: 'Complete trip' };
    default:
      return null;
  }
}

// The backend stores at most one position per few seconds; sending faster
// only spends the rider's data and the driver's battery.
const LIVE_INTERVAL_MS = 4000;
const IDLE_INTERVAL_MS = 20000;

export class DriverController {
  private state: DriverState = {
    loading: true,
    account: null,
    requests: [],
    ride: null,
    busy: false,
    connected: false,
    location: null,
    locationSource: null,
  };
  private listeners = new Set<() => void>();
  private disposed = false;
  private link: { rideId: string; link: DriverLink } | null = null;
  private lastLive = 0;
  private lastIdle = 0;
  private refreshing: Promise<void> | null = null;

  constructor(
    readonly api: DriverApi,
    readonly run: Runner,
    private connect: Connect,
  ) {}

  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private set(patch: Partial<DriverState>) {
    if (this.disposed) return;
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((notify) => notify());
  }
  dispose() {
    this.disposed = true;
    this.link?.link.close();
    this.link = null;
  }

  get online() {
    return this.state.account?.profile?.availabilityStatus === 'online';
  }

  /** Reconcile everything with the backend. Concurrent calls share one run. */
  refresh = (): Promise<void> => {
    this.refreshing ??= this.load().finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  };
  private async load() {
    try {
      const account = await this.run((t, s) => this.api.account(t, s));
      const rides = await this.run((t, s) => this.api.rides(t, s));
      const active = rides.find((ride) =>
        (activeStatuses as readonly string[]).includes(ride.status),
      );
      let ride: Trip | null = null;
      if (active) ride = await this.run((t, s) => this.api.ride(t, active._id, s));
      else if (this.state.ride && !isActiveRide(this.state.ride)) {
        // Keep a just-finished ride on screen until the driver closes it.
        ride = this.state.ride;
      } else if (this.state.ride) {
        // The ride we were showing has ended (e.g. the rider cancelled).
        ride = await this.run((t, s) =>
          this.api.ride(t, this.state.ride!._id, s),
        );
      }
      const online = account.profile?.availabilityStatus === 'online';
      const requests =
        online && !isActiveRide(ride)
          ? await this.run((t, s) => this.api.requests(t, s)).catch(() => [])
          : [];
      this.set({ loading: false, account, ride, requests, error: undefined });
      this.syncLink();
    } catch (error) {
      const failure = safeError(error);
      if (failure.kind === 'cancelled') return;
      this.set({ loading: false, error: failure.message });
    }
  }

  /** Poll only the request list (cheap) while online and free. */
  pollRequests = async () => {
    if (!this.online || isActiveRide(this.state.ride)) return;
    try {
      const requests = await this.run((t, s) => this.api.requests(t, s));
      this.set({ requests });
    } catch (error) {
      if (safeError(error).kind !== 'cancelled') void this.refresh();
    }
  };

  private syncLink() {
    const ride = this.state.ride;
    const wanted = isActiveRide(ride) ? ride!._id : null;
    if (this.link && this.link.rideId !== wanted) {
      this.link.link.close();
      this.link = null;
      this.set({ connected: false });
    }
    if (wanted && !this.link) {
      const rideId = wanted;
      void this.run(async (token) => {
        if (this.disposed || this.link) return;
        this.link = {
          rideId,
          link: this.connect(token, rideId, {
            changed: () => void this.refresh(),
            connection: (connected) => this.set({ connected }),
          }),
        };
        // Send the latest known position straight away.
        if (this.state.location) this.publish(this.state.location, true);
      }).catch(() => undefined);
    }
  }

  private async act(work: () => Promise<unknown>) {
    if (this.state.busy) return;
    this.set({ busy: true, error: undefined });
    let message: string | undefined;
    try {
      await work();
    } catch (error) {
      const failure = safeError(error);
      if (failure.kind !== 'cancelled') message = failure.message;
    }
    this.set({ busy: false });
    await this.refresh();
    // Set after the refresh, which would otherwise clear it.
    if (message) this.set({ error: message });
  }

  goOnline = () =>
    this.act(async () => {
      const point = this.state.location;
      if (!point) throw new AppError('location');
      await this.run((t, s) => this.api.setLocation(t, point, s));
      this.lastIdle = Date.now();
      await this.run((t, s) => this.api.setAvailability(t, 'online', s));
    });
  goOffline = () =>
    this.act(() => this.run((t, s) => this.api.setAvailability(t, 'offline', s)));
  accept = (rideId: string) =>
    this.act(async () => {
      try {
        await this.run((t, s) => this.api.accept(t, rideId, s));
      } catch (error) {
        // Another driver accepted first, or the rider cancelled.
        const kind = safeError(error).kind;
        if (kind === 'changed' || kind === 'unavailable')
          throw new AppError('taken');
        throw error;
      }
    });
  advance = () =>
    this.act(async () => {
      const ride = this.state.ride;
      const next = ride && nextAction(ride.status);
      if (!ride || !next) return;
      await this.run((t, s) => this.api.progress(t, ride._id, next.action, s));
    });
  cancel = (reason: string) =>
    this.act(async () => {
      const ride = this.state.ride;
      if (ride) await this.run((t, s) => this.api.cancel(t, ride._id, reason, s));
    });
  rate = (rating: number, comment: string) =>
    this.act(async () => {
      const ride = this.state.ride;
      if (!ride) return;
      await this.run((t, s) =>
        this.api.rate(t, ride._id, rating, comment, s),
      );
      this.set({ ride: null });
    });
  closeFinishedRide = () => {
    if (!isActiveRide(this.state.ride)) this.set({ ride: null });
  };
  saveLicense = (licenseNumber: string) =>
    this.act(() =>
      this.run((t, s) => this.api.saveLicense(t, licenseNumber.trim(), s)),
    );
  saveVehicle = (input: VehicleInput) =>
    this.act(() => this.run((t, s) => this.api.saveVehicle(t, input, s)));

  /** A new position from GPS, or a point the driver picked on the map. */
  updateLocation = (point: Coordinate, source: LocationSource) => {
    this.set({ location: point, locationSource: source });
    this.publish(point, source === 'map');
  };
  private publish(point: Coordinate, immediate = false) {
    const now = Date.now();
    if (this.link && isActiveRide(this.state.ride)) {
      if (immediate || now - this.lastLive >= LIVE_INTERVAL_MS) {
        this.lastLive = now;
        this.link.link.sendLocation(point);
      }
      return;
    }
    if (this.online && (immediate || now - this.lastIdle >= IDLE_INTERVAL_MS)) {
      this.lastIdle = now;
      void this.run((t, s) => this.api.setLocation(t, point, s)).catch(
        () => undefined,
      );
    }
  }
}
