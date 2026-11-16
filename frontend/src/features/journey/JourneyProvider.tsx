import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type PropsWithChildren,
} from 'react';
import { AppState } from 'react-native';
import { useSession } from '../session/SessionProvider';
import { createJourneyApi } from '../../services/journey-api';
import { watchRide } from '../../services/realtime';
import { JourneyController } from './JourneyController';
import { useDemo } from '../../demo/DemoProvider';
const Context = createContext<JourneyController | null>(null);
export function JourneyProvider({
  children,
  controller: provided,
}: PropsWithChildren<{ controller?: JourneyController }>) {
  const { session, state } = useSession();
  const { runtime } = useDemo();
  const [controller] = useState(
    () =>
      provided ??
      new JourneyController(
        runtime?.journeyApi ?? createJourneyApi(),
        (work) => session.run(work),
        state.stage === 'ready' ? state.user._id : '',
        state.stage === 'ready' ? (state.activeRide?._id ?? null) : null,
        runtime?.watch ?? watchRide,
      ),
  );
  useEffect(() => {
    void controller.refresh();
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void controller.refresh();
    }, 10000);
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void controller.refresh();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
      controller.dispose();
    };
  }, [controller]);
  return <Context.Provider value={controller}>{children}</Context.Provider>;
}
export function useJourney() {
  const controller = useContext(Context);
  if (!controller) throw new Error('Journey provider missing');
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  return { controller, state };
}
