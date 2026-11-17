import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { createAdminApi, type AdminApi } from '../../services/admin-api';
import { AppError, safeError } from '../../services/errors';
import { useSession } from '../session/SessionProvider';

const Context = createContext<{
  api: AdminApi;
  revision: number;
  refresh(): void;
} | null>(null);
export function AdminProvider({
  children,
  api: supplied,
}: PropsWithChildren<{ api?: AdminApi }>) {
  const { state } = useSession();
  const [api] = useState(() => supplied ?? createAdminApi());
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((n) => n + 1), []);
  if (
    state.stage !== 'ready' ||
    state.user.role !== 'admin' ||
    !state.user.isActive
  )
    return null;
  return (
    <Context.Provider value={{ api, revision, refresh }}>
      {children}
    </Context.Provider>
  );
}
export function useAdmin() {
  const value = useContext(Context);
  if (!value) throw new Error('Administrator session required');
  return value;
}
export function useAdminResource<T>(
  load: (token: string, signal: AbortSignal) => Promise<T>,
) {
  const { session } = useSession(),
    { revision, refresh } = useAdmin();
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [settledRevision, setSettledRevision] = useState(-1);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      const abort = new AbortController();
      setLoading(true);
      setData(null);
      setError(undefined);
      void session
        .run((token, sessionSignal) => {
          const cancel = () => abort.abort();
          sessionSignal.addEventListener('abort', cancel);
          if (sessionSignal.aborted) abort.abort();
          return load(token, abort.signal).finally(() =>
            sessionSignal.removeEventListener('abort', cancel),
          );
        })
        .then((result) => {
          if (alive) setData(result);
        })
        .catch((failure) => {
          if (alive && safeError(failure).kind !== 'cancelled')
            setError(safeError(failure).message);
        })
        .finally(() => {
          if (alive) {
            setSettledRevision(revision);
            setLoading(false);
          }
        });
      return () => {
        alive = false;
        abort.abort();
      };
    }, [session, revision, load]),
  );
  // Hide an invalidated record immediately, before the focus effect refetches.
  return {
    data: settledRevision === revision ? data : null,
    error,
    loading: loading || settledRevision !== revision,
    refresh,
  };
}
export type AdminAction = {
  title: string;
  description: string;
  destructive?: boolean;
  work(token: string, signal: AbortSignal): Promise<void>;
};
export function useAdminAction() {
  const { session } = useSession(),
    { refresh } = useAdmin();
  const [action, setAction] = useState<AdminAction | null>(null);
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState<string>();
  const lock = useRef(false);
  const mounted = useRef(true);
  // Mount lifetime also guards mutation completions after session teardown.
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function confirm() {
    if (!action || lock.current) return;
    lock.current = true;
    setBusy(true);
    setNotice(undefined);
    try {
      await session.run(action.work);
      if (mounted.current) setNotice('Change saved. Records refreshed.');
    } catch (failure) {
      if (
        mounted.current &&
        !(failure instanceof AppError && failure.kind === 'cancelled')
      )
        setNotice(
          safeError(failure).kind === 'changed'
            ? 'This change is blocked or the record changed. An active trip or missing licence may prevent approval or account changes. Review the refreshed record.'
            : safeError(failure).message +
                ' Review the refreshed record before trying again.',
        );
    } finally {
      lock.current = false;
      // Reconcile even after an uncertain response; never automatically repeat a mutation.
      if (mounted.current) {
        setBusy(false);
        setAction(null);
        refresh();
      }
    }
  }
  return {
    action,
    choose: (next: AdminAction) => {
      if (!lock.current) {
        setNotice(undefined);
        setAction(next);
      }
    },
    cancel: () => {
      if (!lock.current) setAction(null);
    },
    confirm,
    busy,
    notice,
  };
}
