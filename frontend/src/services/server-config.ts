import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Which RideCore backend the app talks to.
//
// Normally this is EXPO_PUBLIC_API_URL, fixed at build time. Demo builds
// (EXPO_PUBLIC_ALLOW_SERVER_SETTING=true) also let the person holding the
// phone type the laptop's address, because a laptop's Wi-Fi address changes
// from one network to the next. Release builds never accept plain http to a
// public address; plain http is only for the local network.

const KEY = 'ridecore.serverUrl';
export const serverSettingAllowed =
  process.env.EXPO_PUBLIC_ALLOW_SERVER_SETTING === 'true';

let override: string | null = null;
const listeners = new Set<() => void>();

/** The backend API base URL in use right now, ending in /api. */
export function apiUrl(): string | undefined {
  return override ?? process.env.EXPO_PUBLIC_API_URL;
}
export function serverOverride() {
  return override;
}

/** Localhost, the Android emulator's host alias, and private LAN ranges. */
export function isLocalNetworkHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host === '::1' || host.endsWith('.local'))
    return true;
  const parts = host.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255))
    return false;
  const [a, b] = parts as [number, number, number, number];
  return (
    a === 127 ||
    a === 10 ||
    (a === 192 && b === 168) ||
    (a === 172 && b >= 16 && b <= 31)
  );
}

/**
 * Checks a backend address. Returns the normalised URL, or null when it is
 * not acceptable: wrong shape, credentials in it, not ending in /api, or
 * plain http to a public host outside development.
 */
export function acceptableApiUrl(
  value: string,
  development = typeof __DEV__ !== 'undefined' && __DEV__,
): string | null {
  const trimmed = value.trim().replace(/\/+$/, '');
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !url.pathname.endsWith('/api')
  )
    return null;
  if (url.protocol === 'http:' && !development && !isLocalNetworkHost(url.hostname))
    return null;
  return trimmed;
}

/** Turns "192.168.1.20" or "192.168.1.20:5050" into a full API URL. */
export function expandServerInput(input: string): string {
  let value = input.trim();
  if (!value) return value;
  if (!/^https?:\/\//i.test(value)) value = `http://${value}`;
  try {
    const url = new URL(value);
    if (!url.port && url.protocol === 'http:') url.port = '5050';
    if (!url.pathname.replace(/\/+$/, '').endsWith('/api'))
      url.pathname = url.pathname.replace(/\/+$/, '') + '/api';
    return url.toString().replace(/\/+$/, '');
  } catch {
    return value;
  }
}

async function read(): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      return globalThis.localStorage?.getItem(KEY) ?? null;
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(KEY);
}
async function write(value: string | null) {
  if (Platform.OS === 'web') {
    try {
      if (value) globalThis.localStorage?.setItem(KEY, value);
      else globalThis.localStorage?.removeItem(KEY);
    } catch {
      /* Storage unavailable: the setting lasts for this session only. */
    }
    return;
  }
  if (value) await SecureStore.setItemAsync(KEY, value);
  else await SecureStore.deleteItemAsync(KEY);
}

/** Load a saved address at startup. Ignored unless the build allows it. */
export async function loadServerOverride() {
  if (!serverSettingAllowed) return;
  try {
    const saved = await read();
    override = saved && acceptableApiUrl(saved) ? saved : null;
  } catch {
    override = null;
  }
}

/** Save (or with null, forget) an address and restart the app's services. */
export async function setServerOverride(value: string | null) {
  if (!serverSettingAllowed) throw new Error('Server setting is disabled');
  const next = value === null ? null : acceptableApiUrl(value);
  if (value !== null && !next) throw new Error('Invalid server address');
  await write(next);
  override = next;
  listeners.forEach((notify) => notify());
}

/** Lets the app remount its providers after the server changes. */
export function onServerChange(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Quick reachability check against the backend's health endpoint. */
export async function checkServer(base: string, timeoutMs = 6000) {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeoutMs);
  try {
    const response = await fetch(`${base}/health`, { signal: abort.signal });
    const body = (await response.json().catch(() => null)) as {
      database?: string;
    } | null;
    return response.ok && body?.database === 'connected';
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
