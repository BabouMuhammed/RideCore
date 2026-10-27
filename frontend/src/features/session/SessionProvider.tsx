import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type PropsWithChildren,
} from 'react';
import { AppState } from 'react-native';
import { createApi } from '../../services/api';
import { credentialStore } from '../../services/credential-store';
import { SessionController } from './SessionController';
const Context = createContext<SessionController | null>(null);
export function SessionProvider({
  children,
  controller,
}: PropsWithChildren<{ controller?: SessionController }>) {
  const [session] = useState(
    () => controller ?? new SessionController(createApi(), credentialStore),
  );
  useEffect(() => {
    void session.restore();
    let previous = AppState.currentState;
    const subscription = AppState.addEventListener('change', (next) => {
      if (
        next === 'active' &&
        previous !== 'active' &&
        session.getSnapshot().stage === 'ready'
      )
        void session.restore();
      previous = next;
    });
    return () => {
      subscription.remove();
      session.dispose();
    };
  }, [session]);
  return <Context.Provider value={session}>{children}</Context.Provider>;
}
export function useSession() {
  const controller = useContext(Context);
  if (!controller) throw new Error('Session provider missing');
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  return { state, session: controller };
}
