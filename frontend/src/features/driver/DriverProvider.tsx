import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type PropsWithChildren,
} from 'react';
import { AppState } from 'react-native';
import * as Location from 'expo-location';
import { useSession } from '../session/SessionProvider';
import { createDriverApi } from '../../services/driver-api';
import { connectDriverRide } from '../../services/realtime';
import { DriverController, isActiveRide } from './DriverController';

export type GpsStatus = 'starting' | 'watching' | 'denied' | 'unavailable';
type Value = {
  controller: DriverController;
  gps: GpsStatus;
  retryGps: () => void;
};
const Context = createContext<Value | null>(null);

export function DriverProvider({
  children,
  controller: provided,
}: PropsWithChildren<{ controller?: DriverController }>) {
  const { session } = useSession();
  const [controller] = useState(
    () =>
      provided ??
      new DriverController(
        createDriverApi(),
        (work) => session.run(work),
        connectDriverRide,
      ),
  );
  const [gps, setGps] = useState<GpsStatus>('starting');
  // Bumped by "Use my location" to ask the browser or phone again.
  const [attempt, setAttempt] = useState(0);

  // Reconcile on mount, on return to the foreground, and on a slow timer
  // as a fallback for missed realtime events.
  useEffect(() => {
    void controller.refresh();
    const slow = setInterval(() => {
      if (AppState.currentState === 'active') void controller.refresh();
    }, 10000);
    // New requests are not pushed by the backend, so poll while online.
    const fast = setInterval(() => {
      const state = controller.getSnapshot();
      if (
        AppState.currentState === 'active' &&
        controller.online &&
        !isActiveRide(state.ride)
      )
        void controller.pollRequests();
    }, 5000);
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void controller.refresh();
    });
    return () => {
      clearInterval(slow);
      clearInterval(fast);
      sub.remove();
      controller.dispose();
    };
  }, [controller]);

  // Foreground GPS only, while the app is open. The driver can also set
  // their position by tapping the map when GPS is off or unavailable.
  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;
    void (async () => {
      if (attempt > 0) setGps('starting');
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (permission.status !== 'granted') {
          setGps('denied');
          return;
        }
        // A quick, coarse first fix so the driver isn't kept waiting for
        // high-accuracy GPS. Failure here is fine; the watch continues.
        void Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        })
          .then((position) => {
            if (!cancelled && !controller.getSnapshot().location)
              controller.updateLocation(
                [position.coords.longitude, position.coords.latitude],
                'gps',
              );
          })
          .catch(() => undefined);
        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 4000,
            distanceInterval: 15,
          },
          (position) =>
            controller.updateLocation(
              [position.coords.longitude, position.coords.latitude],
              'gps',
            ),
        );
        if (cancelled) subscription.remove();
        else setGps('watching');
      } catch {
        if (!cancelled) setGps('unavailable');
      }
    })();
    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [controller, attempt]);

  return (
    <Context.Provider
      value={{ controller, gps, retryGps: () => setAttempt((n) => n + 1) }}
    >
      {children}
    </Context.Provider>
  );
}

export function useDriver() {
  const value = useContext(Context);
  if (!value) throw new Error('Driver provider missing');
  const state = useSyncExternalStore(
    value.controller.subscribe,
    value.controller.getSnapshot,
    value.controller.getSnapshot,
  );
  return {
    controller: value.controller,
    gps: value.gps,
    retryGps: value.retryGps,
    state,
  };
}
