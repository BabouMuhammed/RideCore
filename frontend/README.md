# RideCore Rider

Android-first React Native + Expo + TypeScript application. Phase 2 implements real password authentication and session restoration. The sibling backend remains unchanged. Phase 3 has not begun.

[Phase 1 report](docs/PHASE_1_REPORT.md) | [Phase 2 report](docs/PHASE_2_REPORT.md)

## Local configuration

Use Node 24.3+ (verified here with 24.11.1), npm and this project's lockfile. Configure `EXPO_PUBLIC_API_URL` locally to the backend URL reachable from the device, ending in `/api`. An Android emulator commonly uses `http://10.0.2.2:5050/api`; a physical device needs the host LAN address or a reachable HTTPS service. Backend port remains 5050. Metro uses 8081.

Do not put passwords, JWTs, backend secrets or private Mapbox credentials in public variables. Never copy backend `.env`. No `.env` was created or modified, and no credential values were printed. `.env.example` contains names with empty values. Missing/invalid configuration produces safe recovery feedback; there is no hidden mock server or default fake login. Release builds require an HTTPS API URL; local HTTP is allowed in development builds.

The public Mapbox token is not used until Phase 3. Its intended native variable is `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN`, not a Vite variable. Never paste or hardcode it. Private SDK download credentials, if needed, belong only in build secrets such as `RNMAPBOX_MAPS_DOWNLOAD_TOKEN`.

## Install, check and run

```powershell
npm ci
npm run typecheck
npm run lint
npm run format:check
npm test
npm run verify:backend-contract
npm run prebuild:android
npm run export:android
```

`verify:backend-contract` runs the real mobile API/session contracts over HTTP against the unchanged backend in a disposable MongoDB replica set, using synthetic fixtures. It does not use backend `.env` or the real database. It uses the local MongoDB binary when available, otherwise mongodb-memory-server may download one. Temporary mobile contract compilation lives only in ignored `.verification/`. The test HTTP listener uses an ephemeral port; the actual backend configuration/port is unchanged.

For Android development, install Android Studio with full SDK platforms/build-tools and an emulator, configure `ANDROID_HOME`, platform-tools on PATH and a compatible JDK (`JAVA_HOME`; React Native recommends 17). Then connect a device or start an emulator:

```powershell
npm run android
npm start
```

A new development build is needed after adding SecureStore. Expo Go is unsupported because native Mapbox is installed. EAS development/preview/production profiles are prepared, but no EAS project, account or cloud build has been created. `com.ridecore.rider` is provisional; select unique identifiers before distribution.

## Application behavior

Native splash -> real loading/bootstrap -> SecureStore credential lookup. No credential opens Welcome and real Sign In/Create Account forms. A stored credential is validated with `GET /auth/me`; only an active rider proceeds to ride-list/detail restoration and then the Rider shell. Storage, network and server failures have recovery states. Only server authentication rejection removes an invalid/expired credential; network failure preserves it.

Registration sends first name, last name, email, phone, password and fixed rider role. Its success confirms account creation and leads to password sign-in; registration never authenticates. Sign-in explicitly chooses email or phone and always uses a password. There is no recovery, social or passwordless login.

All Gambian phone handling uses `src/features/auth/phone.ts`: national seven-digit structures and nine digits beginning 87/83/86, canonical +220 representation, safe separators and masking. No automatic migration prefix is inferred. This is structural validation, not proof of allocation, reachability or real ownership. See the numbering policy in the Phase 2 report.

Authenticated OTP is optional. It uses the existing six-digit backend flow, accurately explains simulated delivery and displays a simulated code only when the backend supplies one. No SMS delivery is claimed or invented. Expiry comes from the response, conservatively measured from request start. A local 60-second resend guard reflects the backend default, without claiming that configurable server cooldown/attempt limits are known. Longer Retry-After responses are honored; backend limits remain authoritative. The API does not expose configured cooldown or remaining attempts. Codes and OTP challenge state are not persisted. On returning from background, session restoration may discard an in-memory challenge; retry respects the server's limits.

Logout clears SecureStore and private session/ride/navigation state, cancels pending private requests and returns to authentication. If secure deletion fails, a retry gate prevents pretending logout succeeded. No backend logout endpoint exists; logout never cancels a ride or claims server token revocation. No realtime subscriptions exist in this phase.

## Architecture and boundaries

- `src/application`: global native providers and error boundary.
- `src/navigation`: typed auth/root/rider stacks and tabs; no Expo Router gallery.
- `src/features/auth`: real forms, central phone/validation logic and optional verification.
- `src/features/session`: explicit controller with cancellation generations, serialized credential operations, restoration/recovery and private-data cleanup.
- `src/services`: API contracts, fetch transport, safe errors and SecureStore adapter.
- `src/components`, `src/theme`: approved RideCore design-system foundations.
- `tests`: retained Phase 1 behavioral checks plus Phase 2 phone, contract, session, forms, storage and OTP coverage.

The restored active ride is retained in memory and acknowledged on Home. There is no active-ride map or booking implementation. No driver lifecycle calls, fake progression, invented ETAs, payment UI, social login, chat, push or emergency dispatch exists. Account does not implement later profile editing/settings.

The original evergreen identity, system typography, safe-area/keyboard layouts, 48dp minimum controls and native sheet foundation are preserved. Future sheet inputs should use Gorhom's BottomSheetTextInput. Per-icon imports keep unused icon modules out of the bundle.

## Verification limits

Jest uses Expo's Android preset and native mocks; it cannot prove SecureStore/Mapbox native compilation, physical-device rendering, TalkBack, keyboard/focus behavior or GPS. Prebuild verifies native configuration; Metro export verifies JS/Hermes compilation. Full device checks remain in `docs/DEVICE_CHECKLIST.md`.

The previously reported Expo CLI/Zod advisories and tooling deprecation warnings must be reviewed before release. Do not describe a passing functional suite as a clean security audit. See the current Phase 2 report for actual check/build results.

## Next phase

Phase 3 requires separate approval: native Mapbox home, location permission/recovery, current-location selection, address search and pickup/destination pin selection. It is not implemented.
