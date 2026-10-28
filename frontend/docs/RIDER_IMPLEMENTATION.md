# Rider implementation plan

The existing password authentication, Gambia phone policy, native SecureStore,
web preview adapter, optional mock OTP and authoritative bootstrap are retained.
No backend changes are currently needed. Existing uncommitted web dependencies
and the web adapter predate this work and are preserved.

1. Foundation: constrain scrolling auth forms; preserve mobile-first widths and
   environment-based API configuration. Verify existing auth/storage tests.
2. Maps: native Mapbox, web review adapter, foreground-only Expo Location,
   address search/reverse geocoding, pins and Directions geometry. Geocoding
   results submitted to stored rides use permanent geocoding; the Mapbox account
   must permit it. Fare calculation remains entirely on the backend.
3. Journey: typed rider API, server estimates for economy/comfort/xl, request,
   persistent map/state-driven sheet, real authenticated sockets, REST recovery
   and fallback polling. No rider-side driver transitions or invented ETAs.
4. Contextual cancellation and sharing: required reason, pre-start only;
   share/revoke and a minimal unauthenticated web recipient route using the
   public snapshot and separate read-only socket namespace.
5. Completion: actual final fare, cash/mock-wallet recording, receipt, rating,
   history/detail and the existing truthful Account flow.
6. Verification/refinement: frontend tests, disposable full backend lifecycle,
   backend regression suite, lint/types/Doctor/exports/prebuild, responsive and
   accessibility review. Native build/device and live Mapbox validation must be
   reported separately from automated success.

Commit each major functional stage after relevant checks. Never stage secrets,
generated native output or verification artifacts. API host is configured by
EXPO_PUBLIC_API_URL; web CORS_ORIGIN must match the preview origin. Public
recipient links require an explicitly configured reachable web origin. No
machine-specific address belongs in application source.
