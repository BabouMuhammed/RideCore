# RideCore Rider

Android-first React Native + Expo + TypeScript mobile application. iOS shares the
native architecture. Web is for PC review and a minimal read-only recipient view.

The real Rider flow includes password authentication, session/active-ride recovery,
OpenStreetMap addresses and pins, server fares, requests, realtime reconciliation,
cancellation, sharing, simulated payments, ratings and recent history.

Driver accounts get **driver mode** in the same app: onboarding (licence and
vehicle, approved by an admin), going online and offline with foreground GPS
(or a map tap when GPS is unavailable), nearby requests checked every few
seconds, accepting, the trip steps (head to pickup, arrived, start, complete),
directions in the phone's maps app, live location shared with the rider over
Socket.IO, cancelling with a reason, rating the rider and today's earnings.
Register as a driver, or use the `npm run seed:dev` driver account.

See [the current report](docs/RIDER_REPORT.md), [journey guide](docs/RIDER_JOURNEY.md)
and [native checklist](docs/DEVICE_CHECKLIST.md). Earlier phase reports are historical.

## Demo mode

Choose **Try demo** on the welcome screen to explore with a sample account,
recent trips, an illustrative offline map and sample places and fares. Set
`EXPO_PUBLIC_DEMO_MODE=true` in `.env.local` and restart Expo to launch directly
into the demo. The default is `false`.

Book a sample ride and use the **Demo:** buttons to advance through driver
matching, pickup, the journey and completion. Payments and ratings stay in
memory. Reloading starts a fresh demo. **Exit demo** returns to the normal
sign-in/session flow without changing saved credentials. Demo mode makes no
backend, map-service or socket requests, does not use GPS, and cannot create public
trip links or request real rides.

## Configure locally

Use the Node version in package.json, then `npm ci`. Create `.env` locally from
`.env.example` only if absent. Configure these public runtime names locally:

- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_SHARE_WEB_URL`
- `EXPO_PUBLIC_DEMO_MODE` (`false` for the real system)

Maps need no account or key. Optionally point these at self-hosted servers:
`EXPO_PUBLIC_MAP_TILE_URL` (a `{z}/{x}/{y}` tile URL), `EXPO_PUBLIC_GEOCODER_URL`
(Nominatim) and `EXPO_PUBLIC_ROUTER_URL` (OSRM). They default to the public
OpenStreetMap services, which suit development and demonstration.
The API URL ends in `/api` and uses the backend's unchanged port **5050**. The
Android device must reach that host. An emulator commonly uses 10.0.2.2 to reach
the PC; physical devices require a reachable host address. Release builds use
HTTPS, except for local-network addresses (see the phone demo section).

The backend's existing `CORS_ORIGIN` must match the browser preview/viewer origin.
A PowerShell health request does not prove browser CORS is correct. Restart the
backend with its existing configuration setting; no wildcard or code change is
needed. The initial origin mismatch was corrected for the running development process; persist the matching setting locally when restarting.

The sharing URL must serve this app at a reachable web origin. Localhost cannot
serve recipients on another phone. Share capabilities use a URL fragment; the
recipient branch never reads rider credentials or mounts authenticated bootstrap.

During an assigned active ride, choose **Share my ride**, create a tracking
link, then send it through the device share menu or copy it in a supported
browser. The link remains available when the panel is closed and reopened in
the same trip screen. **Stop sharing this ride** revokes it through the backend.
After an app restart or an uncertain creation response, stop sharing before
creating a replacement. The backend controls expiry and ends access when the
ride completes or is cancelled. Browser previews use the current origin when
`EXPO_PUBLIC_SHARE_WEB_URL` is absent; native builds need that public URL set.
In demo mode, **Preview friend's view** shows sample tracking details without
creating or sending a public link.

Maps use free, open-source services, as set out in the project proposal: MapLibre
renders OpenStreetMap tiles, Nominatim finds and names places (limited to The
Gambia) and OSRM supplies planned street geometry. Search coverage varies; map
pins and user-entered landmarks remain available. Route lines are for
orientation only; backend fares remain authoritative. No driver ETA is invented.
Keep the OpenStreetMap attribution visible, and stay within the public servers'
fair-use limits (Nominatim allows about one request per second).

## Run

In `backend`, retain its private environment and MongoDB replica set configuration:

```powershell
npm ci
npm run dev
```

In a second terminal, still in `backend`, create the development accounts once
(a rider, an approved driver who is online in Serrekunda, and an admin). It goes
through the real API and is safe to repeat; it refuses to run in production:

```powershell
npm run seed:dev
```

In `frontend`:

```powershell
npm ci
npm start -- --web --port 8081
```

Restart Metro after environment/dependency changes; use `--clear` for stale module
caches. For a complete Android SDK/JDK/device setup use `npm run android`. For an
installed EAS development APK use `npm start -- --lan`. Expo Go cannot load
the native MapLibre map; use the development build. No source fallback to localhost, fixed machine IP or mock API exists.

## Android development build

Existing EAS project/configuration and SecureStore/MapLibre plugins are configured.
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

## Phone demo on local Wi-Fi (real system)

For a live demonstration on phones without deploying the backend, build the
`local-demo` APK once. It runs the real system (no demo mode) and adds a
**Server address** setting on the welcome screen, so the phones can follow the
laptop whatever Wi-Fi you are on:

```powershell
eas build --platform android --profile local-demo
```

On the day:

1. Connect the laptop and phones to the same Wi-Fi or phone hotspot.
2. Start the backend (`npm run dev` in `backend`); run `npm run seed:dev` once.
3. Allow the API through Windows Firewall (once, in an administrator PowerShell):
   `New-NetFirewallRule -DisplayName "RideCore API" -Direction Inbound -LocalPort 5050 -Protocol TCP -Action Allow`
4. Find the laptop's address with `ipconfig` (the IPv4 Address, e.g. 192.168.1.20).
5. On each phone, tap **Server** on the welcome screen, enter that address and
   choose **Check and save**. Sign in as the rider on one phone and the driver
   on another.

Release builds accept plain `http://` only for local-network addresses
(localhost, 10.x, 172.16-31.x, 192.168.x, `.local`); any public server must
use `https://`. The server setting exists only in builds made with
`EXPO_PUBLIC_ALLOW_SERVER_SETTING=true`.

## Shareable demo APK

Latest successful demo build:
[Expo build](https://expo.dev/accounts/baboumaha/projects/ridecore-rider/builds/5129a871-24b8-4116-b758-727d9f962e73)
· [Download APK](https://expo.dev/artifacts/eas/orwkejD10b-TFISFkpitjyxElgoteA24CrT_Ubi0TgU.apk).

From `frontend`, run `eas build --platform android --profile demo`. This uses
the preview environment, enables demo mode explicitly and produces an internally
distributed APK with bundled JavaScript. Recipients can install it from the EAS
build link without Expo Go, Metro, a backend connection. The demo
includes sample rides and a tracking preview; it does not send real tracking links.

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
Admin actions exist only in that test harness and the seed script, never in the application.
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
Passing tests/exports does not certify native device behavior.
 The report distinguishes verified implementation from demonstration setup.
