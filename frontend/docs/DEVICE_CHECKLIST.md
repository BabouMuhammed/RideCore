# Native Rider checklist

These are required manual checks, not claims of completed device testing.

- Install the current Android development client with Mapbox, Location and
  SecureStore. Configure device-reachable API and public Mapbox credentials locally.
- Cold launch, native splash/loading, authentication and validated session restore.
  Restart during every active status; verify authoritative ride recovery.
- Required registration fields followed by explicit sign-in; email/phone login and
  supported Gambia number formats with a separate +220 prefix.
- Small displays, 200% font scaling, safe areas, keyboard next/done, Android back,
  TalkBack, 48dp targets and scroll-to-submit on long forms.
- Grant/deny foreground location. Search/pins work without GPS. Return from
  Settings and retry GPS. Riders see addresses/landmarks, never coordinates.
- Actual Mapbox tiles/attribution, permanent geocoding and planned road geometry.
  Confirm account access; do not infer fares/arrival ETAs from the street route.
- Server GMD estimates for economy/comfort/xl; explicit single request. Driver
  appears only after real acceptance by an eligible approved driver and vehicle.
- Actual driver-controlled lifecycle and GPS updates, timestamps, socket room
  reconnect and REST reconciliation after background/network recovery.
- Required cancellation reason/confirmation before start; absent after start.
- Share link on a separate unauthenticated device/browser, revoke, expire and end
  the trip. Public trip data must clear; no private rider credential is exposed.
- Driver completion, actual final fare, simulated cash/mock-wallet recording,
  duplicate-payment protection, 1?5 rating/comment and history receipt recovery.
- Optional OTP explicitly mocked; no SMS promise or booking gate.
- Local logout clears credential/state/sockets but leaves a real ride unchanged.
  Network failures preserve credentials; server rejection clears them.
- Native secure storage, process death, sheet/keyboard gestures and map recovery
  require actual device testing. iOS signing/device checks are separate.
