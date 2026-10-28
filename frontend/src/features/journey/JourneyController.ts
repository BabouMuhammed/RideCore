import { activeStatuses } from '../../services/contracts';
import { AppError, safeError } from '../../services/errors';
import type { Booking, JourneyApi, Trip } from '../../services/journey-api';
import type { LocationSample, RideWatcher } from '../../services/realtime';
export type Runner = <T>(
  work: (token: string, signal: AbortSignal) => Promise<T>,
) => Promise<T>;
export const isActive = (trip: Pick<Trip, 'status'>) =>
  (activeStatuses as readonly string[]).includes(trip.status);
export type JourneyState = {
  trip: Trip | null;
  history: Trip[];
  loading: boolean;
  busy: boolean;
  connected: boolean;
  error: AppError | null;
  location: LocationSample | null;
  nearbyDrivers: number | null;
};
export class JourneyController {
  private state: JourneyState = {
    trip: null,
    history: [],
    loading: true,
    busy: false,
    connected: false,
    error: null,
    location: null,
    nearbyDrivers: null,
  };
  private listeners = new Set<() => void>();
  private stopped = false;
  private revision = 0;
  private focusId: string | null;
  private watchingId: string | null = null;
  private cleanup?: () => void;
  private refreshing?: Promise<void>;
  private checkingNearby = false;
  constructor(
    readonly api: JourneyApi,
    readonly run: Runner,
    private riderId: string,
    activeId: string | null,
    private watch: RideWatcher,
  ) {
    this.focusId = activeId;
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private emit(patch: Partial<JourneyState>) {
    if (this.stopped) return;
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }
  dispose() {
    this.stopped = true;
    this.revision++;
    this.cleanup?.();
    this.state = {
      ...this.state,
      trip: null,
      history: [],
      location: null,
      nearbyDrivers: null,
    };
  }
  private own(trip: Trip) {
    if (trip.rider !== this.riderId) throw new AppError('contract');
    return trip;
  }
  private async checkDrivers(trip: Trip) {
    if (this.checkingNearby || this.stopped) return;
    this.checkingNearby = true;
    const revision = this.revision;
    try {
      const categories = await this.run((token, signal) =>
        this.api.nearby(token, trip.pickup.location.coordinates, signal),
      );
      if (
        revision === this.revision &&
        this.state.trip?._id === trip._id &&
        this.state.trip.status === 'requested'
      )
        this.emit({
          nearbyDrivers: categories.filter(
            (category) => category === trip.vehicleType,
          ).length,
        });
    } catch {
      // Discovery failure is unknown availability, never a false no-driver result.
      if (revision === this.revision && this.state.trip?._id === trip._id)
        this.emit({ nearbyDrivers: null });
    } finally {
      this.checkingNearby = false;
    }
  }
  private async adopt(trip: Trip | null) {
    if (this.stopped) return;
    this.focusId = trip?._id ?? null;
    const id = trip && isActive(trip) ? trip._id : null;
    const changed = this.state.trip?._id !== trip?._id;
    this.emit({
      trip,
      nearbyDrivers:
        changed || trip?.status !== 'requested'
          ? null
          : this.state.nearbyDrivers,
      location:
        changed || !trip || !isActive(trip) ? null : this.state.location,
    });
    if (trip?.status === 'requested') void this.checkDrivers(trip);
    if (
      trip?.trackingLocation &&
      isActive(trip) &&
      (!this.state.location ||
        Date.parse(trip.trackingLocation.updatedAt) >
          Date.parse(this.state.location.timestamp))
    )
      this.emit({
        location: {
          point: trip.trackingLocation.location.coordinates,
          timestamp: trip.trackingLocation.updatedAt,
        },
      });
    if (this.watchingId === id) return;
    this.cleanup?.();
    this.cleanup = undefined;
    this.watchingId = id;
    this.emit({ connected: false });
    if (id) {
      const cleanup = await this.run(async (token, signal) => {
        const close = this.watch(token, id, {
          changed: () => {
            void this.refresh();
          },
          connection: (connected) => {
            if (this.watchingId === id) this.emit({ connected });
          },
          location: (sample) => {
            if (
              this.state.trip?._id === id &&
              this.state.trip.driver &&
              isActive(this.state.trip) &&
              (!this.state.location ||
                Date.parse(sample.timestamp) >
                  Date.parse(this.state.location.timestamp))
            )
              this.emit({ location: sample });
          },
        });
        signal.addEventListener('abort', close, { once: true });
        if (signal.aborted) close();
        return () => {
          signal.removeEventListener('abort', close);
          close();
        };
      });
      if (this.stopped || this.watchingId !== id) cleanup();
      else this.cleanup = cleanup;
    }
  }
  refresh = (): Promise<void> => {
    if (this.stopped) return Promise.resolve();
    if (this.refreshing) return this.refreshing;
    const revision = this.revision;
    this.refreshing = (async () => {
      try {
        const history = await this.run((token, signal) =>
          this.api.list(token, signal),
        );
        history.forEach((trip) => this.own(trip));
        const active = history.filter(isActive);
        if (active.length > 1) throw new AppError('contract');
        const id = active[0]?._id ?? this.focusId;
        const trip = id
          ? this.own(
              await this.run((token, signal) =>
                this.api.detail(token, id, signal),
              ),
            )
          : null;
        if (trip && trip._id !== id) throw new AppError('contract');
        if (revision !== this.revision || this.stopped) return;
        this.emit({ history, error: null });
        await this.adopt(trip);
      } catch (error) {
        if (revision === this.revision) this.emit({ error: safeError(error) });
      } finally {
        this.emit({ loading: false });
        this.refreshing = undefined;
      }
    })();
    return this.refreshing;
  };
  private async mutation<T>(work: () => Promise<T>) {
    if (this.state.busy || this.stopped) throw new AppError('changed');
    this.revision++;
    this.emit({ busy: true, error: null });
    try {
      return await work();
    } catch (error) {
      this.emit({ error: safeError(error) });
      throw error;
    } finally {
      this.emit({ busy: false });
    }
  }
  request(input: Booking) {
    return this.mutation(async () => {
      if (this.state.trip && isActive(this.state.trip))
        throw new AppError('changed');
      try {
        const trip = this.own(
          await this.run((token, signal) =>
            this.api.create(token, input, signal),
          ),
        );
        await this.adopt(trip);
        return trip;
      } catch (error) {
        await this.refreshing;
        await this.refresh();
        throw error;
      } // Uncertain POST: discover, never auto-retry creation.
    });
  }
  cancel(reason: string) {
    return this.mutation(async () => {
      const trip = this.state.trip;
      if (!trip || !isActive(trip) || trip.status === 'in_progress')
        throw new AppError('changed');
      try {
        await this.adopt(
          this.own(
            await this.run((token, signal) =>
              this.api.cancel(token, trip._id, reason, signal),
            ),
          ),
        );
      } finally {
        await this.refreshing;
        await this.refresh();
      }
    });
  }
  dismiss() {
    if (!this.state.trip || isActive(this.state.trip)) return;
    this.focusId = null;
    void this.adopt(null);
  }
}
