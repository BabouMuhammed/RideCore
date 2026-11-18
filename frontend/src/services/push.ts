// Native builds would use Expo push notifications; the web build uses
// Web Push (push.web.ts). Until a native build ships, these are no-ops.
export type PushState =
  'unsupported' | 'needs-install' | 'default' | 'granted' | 'denied';
export function pushState(): PushState {
  return 'unsupported';
}
export async function enablePush(_token: string): Promise<PushState> {
  return 'unsupported';
}
export async function syncPush(_token: string) {}
export async function unlinkPush(_token: string) {}
