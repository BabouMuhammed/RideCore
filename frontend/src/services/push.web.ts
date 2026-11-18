import { createTransport, record } from './api';
import { apiUrl } from './server-config';

// Web Push: lock-screen notifications (driver found, driver arrived, new
// ride request) even when RideCore isn't open. On iPhone this works in the
// home-screen app (iOS 16.4+), not in a Safari tab, so we say so.
export type PushState =
  'unsupported' | 'needs-install' | 'default' | 'granted' | 'denied';

const isIos = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isInstalled = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;
const supported = () =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

export function pushState(): PushState {
  if (typeof window === 'undefined') return 'unsupported';
  if (!supported())
    return isIos() && !isInstalled() ? 'needs-install' : 'unsupported';
  return Notification.permission === 'granted'
    ? 'granted'
    : Notification.permission === 'denied'
      ? 'denied'
      : 'default';
}

function keyBytes(base64: string) {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

async function subscribe(token: string) {
  const call = createTransport(apiUrl());
  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  const { publicKey } = record(await call('/push/public-key', 'GET')) as {
    publicKey: string;
  };
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBytes(publicKey),
    }));
  await call('/push/subscriptions', 'POST', subscription.toJSON(), token);
}

/** Ask permission (must follow a tap) and register this device. */
export async function enablePush(token: string): Promise<PushState> {
  if (!supported()) return pushState();
  const permission = await Notification.requestPermission();
  if (permission === 'granted') await subscribe(token);
  return pushState();
}

/** After sign-in: link this device to the signed-in account, if allowed. */
export async function syncPush(token: string) {
  if (pushState() !== 'granted') return;
  try {
    await subscribe(token);
  } catch {
    // Notifications stay off for now; the app works without them.
  }
}

/** On sign-out: stop this device receiving the account's notifications. */
export async function unlinkPush(token: string) {
  try {
    if (!supported()) return;
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;
    await createTransport(apiUrl())(
      '/push/subscriptions',
      'DELETE',
      { endpoint: subscription.endpoint },
      token,
    );
  } catch {
    // Best effort.
  }
}
