import type { CredentialStore } from '../../services/credential-store';
import type {
  Credentials,
  OtpReply,
  Ride,
  RiderApi,
  User,
} from '../../services/contracts';
import { activeStatuses } from '../../services/contracts';
import { AppError, safeError } from '../../services/errors';
export type SessionState =
  | { stage: 'starting' | 'restoring' }
  | { stage: 'anonymous'; expired?: boolean }
  | { stage: 'ready'; user: User; activeRide: Ride | null }
  | {
      stage: 'recovery';
      step: 'session' | 'rides' | 'storage' | 'logout';
      error: AppError;
    }
  | { stage: 'rejected'; error: AppError };
export class SessionController {
  private state: SessionState = { stage: 'starting' };
  private listeners = new Set<() => void>();
  private epoch = 0;
  private abort = new AbortController();
  private token: string | null = null;
  private storageQueue: Promise<unknown> = Promise.resolve();
  constructor(
    readonly api: RiderApi,
    private store: CredentialStore,
  ) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private emit(state: SessionState) {
    this.state = state;
    this.listeners.forEach((notify) => notify());
  }
  private begin() {
    this.abort.abort();
    this.abort = new AbortController();
    return ++this.epoch;
  }
  private current(epoch: number) {
    return this.epoch === epoch && !this.abort.signal.aborted;
  }
  private storage<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.storageQueue.catch(() => undefined).then(operation);
    this.storageQueue = next;
    return next;
  }
  dispose() {
    this.begin();
    this.token = null;
    this.state = { stage: 'starting' };
  }
  private allowed(user: User) {
    if (!['rider', 'driver', 'admin'].includes(user.role) || !user.isActive)
      throw new AppError('role');
  }
  async restore() {
    const epoch = this.begin();
    this.token = null;
    this.emit({ stage: 'restoring' });
    try {
      const token = await this.storage(() => this.store.get());
      if (!this.current(epoch)) return;
      if (token === null) {
        this.emit({ stage: 'anonymous' });
        return;
      }
      this.token = token;
      await this.restoreToken(epoch, token);
    } catch {
      if (this.current(epoch))
        this.emit({
          stage: 'recovery',
          step: 'storage',
          error: new AppError('storage'),
        });
    }
  }
  async signIn(input: Credentials, audience?: 'admin') {
    const epoch = this.begin();
    const result = await this.api.login(input, this.abort.signal);
    if (!this.current(epoch)) throw new AppError('cancelled');
    // The dedicated admin form must reject other identities before storage.
    // Normal rider/driver login retains its existing bootstrap sequence.
    if (audience === 'admin') {
      const identity = await this.api.me(result.token, this.abort.signal);
      if (!this.current(epoch)) throw new AppError('cancelled');
      if (identity.role !== 'admin' || !identity.isActive)
        throw new AppError('adminRequired');
    }
    try {
      await this.storage(() => this.store.set(result.token));
    } catch {
      if (this.current(epoch)) {
        await this.forget(epoch, false);
      }
      throw new AppError('storage');
    }
    if (!this.current(epoch)) throw new AppError('cancelled');
    this.token = result.token;
    this.emit({ stage: 'restoring' });
    await this.restoreToken(epoch, result.token, audience);
  }
  private async restoreToken(epoch: number, token: string, audience?: 'admin') {
    let step: 'session' | 'rides' = 'session';
    try {
      const user = await this.api.me(token, this.abort.signal);
      if (!this.current(epoch)) return;
      this.allowed(user);
      if (audience === 'admin' && user.role !== 'admin')
        throw new AppError('role');
      if (user.role === 'driver' || user.role === 'admin') {
        // Only riders bootstrap journey recovery. Other roles load their own UI.
        if (this.current(epoch))
          this.emit({ stage: 'ready', user, activeRide: null });
        return;
      }
      step = 'rides';
      const rides = await this.api.rides(token, this.abort.signal);
      if (!this.current(epoch)) return;
      if (rides.some((ride) => ride.rider !== user._id))
        throw new AppError('contract');
      const active = rides.filter((ride) =>
        (activeStatuses as readonly string[]).includes(ride.status),
      );
      if (active.length > 1) throw new AppError('contract');
      let activeRide: Ride | null = null;
      if (active[0]) {
        const detail = await this.api.ride(
          token,
          active[0]._id,
          this.abort.signal,
        );
        if (!this.current(epoch)) return;
        if (detail._id !== active[0]._id || detail.rider !== user._id)
          throw new AppError('contract');
        activeRide = (activeStatuses as readonly string[]).includes(
          detail.status,
        )
          ? detail
          : null;
      }
      if (this.current(epoch)) this.emit({ stage: 'ready', user, activeRide });
    } catch (error) {
      if (!this.current(epoch)) return;
      const failure = safeError(error);
      if (failure.kind === 'unauthenticated' || failure.kind === 'role') {
        await this.forget(
          epoch,
          failure.kind === 'unauthenticated',
          failure.kind === 'role' ? failure : undefined,
        );
      } else this.emit({ stage: 'recovery', step, error: failure });
    }
  }
  private async forget(epoch: number, expired = false, rejection?: AppError) {
    this.token = null;
    try {
      await this.storage(() => this.store.clear());
      if (this.current(epoch))
        this.emit(
          rejection
            ? { stage: 'rejected', error: rejection }
            : { stage: 'anonymous', expired },
        );
    } catch {
      if (this.current(epoch))
        this.emit({
          stage: 'recovery',
          step: 'logout',
          error: new AppError('storage'),
        });
    }
  }
  async logout() {
    const epoch = this.begin();
    this.token = null;
    this.emit({ stage: 'restoring' });
    await this.forget(epoch);
  }
  retry = () =>
    this.state.stage === 'recovery' && this.state.step === 'logout'
      ? this.logout()
      : this.restore();
  private async authorized<T>(
    operation: (token: string, signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    const epoch = this.epoch;
    const token = this.token;
    if (!token || this.state.stage !== 'ready')
      throw new AppError('unauthenticated');
    try {
      const result = await operation(token, this.abort.signal);
      if (!this.current(epoch)) throw new AppError('cancelled');
      return result;
    } catch (error) {
      if (!this.current(epoch)) throw new AppError('cancelled');
      if (
        error instanceof AppError &&
        (error.kind === 'unauthenticated' || error.kind === 'role')
      ) {
        this.emit({ stage: 'restoring' });
        await this.forget(
          epoch,
          error.kind === 'unauthenticated',
          error.kind === 'role' ? error : undefined,
        );
      }
      throw safeError(error);
    }
  }
  requestOtp = (): Promise<OtpReply> =>
    this.authorized((token, signal) => this.api.requestOtp(token, signal));
  // Integration adapters run with the validated session, never persisted copies.
  run<T>(
    operation: (token: string, signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    return this.authorized(operation);
  }
  async verifyOtp(code: string) {
    if (!/^\d{6}$/.test(code)) throw new AppError('otp');
    await this.authorized(async (token, signal) => {
      await this.api.verifyOtp(token, code, signal);
      let user: User;
      try {
        user = await this.api.me(token, signal);
      } catch (error) {
        if (
          !signal.aborted &&
          !(error instanceof AppError && error.kind === 'unauthenticated')
        )
          this.emit({
            stage: 'recovery',
            step: 'session',
            error: safeError(error),
          });
        throw error;
      }
      this.allowed(user);
      // A role that changes during a session needs a fresh sign-in.
      if (this.state.stage === 'ready' && this.state.user.role !== user.role)
        throw new AppError('role');
      if (this.state.stage === 'ready' && !signal.aborted)
        this.emit({ ...this.state, user });
    });
  }
}
