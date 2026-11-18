// Keeps every device on the latest deployed version. A home-screen web app
// on iPhone can keep running an old bundle for a long time, so phone and PC
// drift apart after a release. Whenever the app opens or comes back to the
// screen, it fetches the live index.html and, if it points at a newer
// bundle than the one running, reloads. Trip state lives on the server, so
// a reload loses nothing.
const bundlePattern = /\/_expo\/static\/js\/web\/[^"'\s>]+\.js/;

export function latestBundle(html: string) {
  return html.match(bundlePattern)?.[0] ?? null;
}

function runningBundle() {
  for (const script of Array.from(document.scripts)) {
    const match = script.src.match(bundlePattern);
    if (match) return match[0];
  }
  return null;
}

export function startAppUpdates() {
  const running = runningBundle();
  // Development (Metro) serves a different bundle path; nothing to compare.
  if (!running) return () => undefined;
  let checking = false;
  async function check() {
    if (checking) return;
    checking = true;
    try {
      const response = await fetch('/', { cache: 'no-store' });
      const latest = latestBundle(await response.text());
      if (!latest || latest === running) return;
      // Reload at most once per new version, so a stale CDN edge can't loop.
      const key = 'ridecore-updated-to';
      try {
        if (sessionStorage.getItem(key) === latest) return;
        sessionStorage.setItem(key, latest);
      } catch {
        // Storage can be unavailable; a single reload is still fine.
      }
      window.location.reload();
    } catch {
      // Offline: keep running the current version.
    } finally {
      checking = false;
    }
  }
  const onVisible = () => {
    if (document.visibilityState === 'visible') void check();
  };
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('pageshow', onVisible);
  void check();
  return () => {
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('pageshow', onVisible);
  };
}
