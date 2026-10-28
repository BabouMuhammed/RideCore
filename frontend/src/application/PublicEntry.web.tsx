import { useEffect, useState, type PropsWithChildren } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PublicShareViewer } from '../features/sharing/PublicShareViewer';
import { AppErrorBoundary } from './AppErrorBoundary';
// Public recipients never mount private session bootstrap or read rider credentials.
export function PublicEntry({ children }: PropsWithChildren) {
  const [hash, setHash] = useState(() =>
    typeof window === 'undefined' ? '' : window.location.hash,
  );
  useEffect(() => {
    const changed = () => setHash(window.location.hash);
    window.addEventListener('hashchange', changed);
    const meta = document.createElement('meta');
    meta.name = 'referrer';
    meta.content = 'no-referrer';
    document.head.appendChild(meta);
    return () => {
      window.removeEventListener('hashchange', changed);
      meta.remove();
    };
  }, []);
  if (!hash.startsWith('#track=')) return children;
  const token = hash.slice(7);
  return (
    <SafeAreaProvider>
      <AppErrorBoundary>
        <PublicShareViewer key={token} token={token} />
      </AppErrorBoundary>
    </SafeAreaProvider>
  );
}
