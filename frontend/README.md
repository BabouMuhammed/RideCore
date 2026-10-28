# RideCore Rider

Android-first React Native + Expo + TypeScript mobile application. iOS shares the
native architecture. Web is for PC review and a minimal read-only recipient view.

The real Rider flow includes password authentication, session/active-ride recovery,
Mapbox addresses and pins, server fares, requests, realtime reconciliation,
cancellation, sharing, simulated payments, ratings and recent history. The rider
never calls driver-only transition endpoints.

See [the current report](docs/RIDER_REPORT.md), [journey guide](docs/RIDER_JOURNEY.md)
and [native checklist](docs/DEVICE_CHECKLIST.md). Earlier phase reports are historical.

## Configure locally

Use the Node version in package.json, then `npm ci`. Create `.env` locally from
`.env.example` only if absent. Configure these public runtime names locally:

- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN`
- `EXPO_PUBLIC_SHARE_WEB_URL`

Never paste actual token values into source, documentation, messages or commits.
The API URL ends in `/api` and uses the backend's unchanged port **5050**. The
Android device must reach that host. An emulator commonly uses 10.0.2.2 to reach
the PC; physical devices require a reachable host address. Release URLs use HTTPS.

The backend's existing `CORS_ORIGIN` must match the browser preview/viewer origin.
A PowerShell health request does not prove browser CORS is correct. Restart the
backend with its existing configuration setting; no wildcard or code change is
needed. The initial origin mismatch was corrected for the running development process; persist the matching setting locally when restarting.

The sharing URL must serve this app at a reachable web origin. Localhost cannot
serve recipients on another phone. Share capabilities use a URL fragment; the
recipient branch never reads rider credentials or mounts authenticated bootstrap.

Mapbox uses permanent Geocoding v6 because confirmed addresses are stored in rides.
The account must permit permanent geocoding. Search coverage varies; map pins and
user-entered landmarks remain available. Directions supplies planned street
geometry only; backend fares remain authoritative. No driver ETA is invented.
If native SDK downloads require a private credential, configure build-time
`RNMAPBOX_MAPS_DOWNLOAD_TOKEN` securely. Never put it in an EXPO_PUBLIC variable.

## Run

In `backend`, retain its private environment and MongoDB replica set configuration:

```powershell
npm ci
npm run dev
```

In `frontend`:

```powershell
npm ci
npm start -- --web --port 8081
```

Restart Metro after environment/dependency changes; use `--clear` for stale module
caches. For a complete Android SDK/JDK/device setup use `npm run android`. For an
installed EAS development APK use `npm start -- --lan`. Expo Go cannot provide
native Mapbox. No source fallback to localhost, fixed machine IP or mock API exists.

## Android development build

Existing EAS project/configuration and SecureStore/Mapbox plugins are preserved.
Location adds foreground permission only. From the frontend directory use the
inspected frontend-only upload mode, excluding Git metadata, backend data, private
environments, generated native output and verification/browser artifacts:

```powershell
$env:EAS_NO_VCS = '1'
$env:EAS_PROJECT_ROOT = (Get-Location).Path
eas build --platform android --profile development
```

Local development still uses logical Git commits. No VCS applies only to archive
packaging. Configure runtime variables locally/EAS and private build credentials
through secure build environment settings. Development clients load JS from Metro.

## Verify

```powershell
npm run typecheck
npm run lint
npm run format:check
npm test
npm run verify:backend-contract
npm run verify:rider
npx expo-doctor
npm run export:web
npm run prebuild:android
npm run export:android
```

`verify:rider` compiles the real mobile adapters/controller and executes actual
HTTP/socket operations against an unchanged backend with disposable MongoDB data.
Driver/admin actions exist only in that test harness, never in the application.
It never loads backend `.env` or uses the real database. A local MongoDB binary is
used when available; otherwise mongodb-memory-server needs a supported download.

Native credentials still use device-only SecureStore. Browser localStorage is
for development/UI review only, not production web authentication. OTP remains
optional and explicitly mocked. Payments are simulated cash/mock-wallet records,
not real funds/balances. New fares use GMD; legacy GBP history is not relabelled.

There is no social login, password reset, editable profile, chat, masked calling,
emergency dispatch, push notifications, cards or external payment gateway. There
is no definitive backend no-driver/timeout event, so open requests truthfully keep
waiting or offer cancellation. History exposes the backend's latest-50 window.

Current dependency advisories remain unresolved; do not use audit fix --force.
Passing tests/exports does not certify native device behavior or Mapbox account
access. The report distinguishes verified implementation from demonstration setup.
